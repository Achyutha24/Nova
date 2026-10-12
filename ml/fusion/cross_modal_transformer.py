import torch
import torch.nn as nn
import numpy as np
from typing import Dict, Any, Tuple, Optional

MODALITY_ORDER = ["voice", "face", "gaze", "text", "rppg"]

class ModalityProjection(nn.Module):
    def __init__(self, input_dim: int, d_model: int):
        super().__init__()
        self.proj = nn.Sequential(
            nn.Linear(input_dim, d_model),
            nn.LayerNorm(d_model),
            nn.GELU()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.proj(x)

class CrossModalTransformer(nn.Module):
    def __init__(self, d_model: int = 128, n_heads: int = 4, n_layers: int = 2, dropout: float = 0.1):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads

        # Modality projection encoders (matching preprocessing vector dimensions)
        self.voice_proj = ModalityProjection(input_dim=20, d_model=d_model)
        self.face_proj = ModalityProjection(input_dim=18, d_model=d_model)
        self.gaze_proj = ModalityProjection(input_dim=6, d_model=d_model)
        self.text_proj = ModalityProjection(input_dim=768, d_model=d_model)
        self.rppg_proj = ModalityProjection(input_dim=4, d_model=d_model)

        # Modality type embeddings (0: CLS, 1: voice, 2: face, 3: gaze, 4: text, 5: rppg)
        self.modality_embeddings = nn.Embedding(6, d_model)
        self.cls_token = nn.Parameter(torch.randn(1, 1, d_model) * 0.02)

        # Transformer encoder layers with cross-modal multi-head attention
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=d_model * 4,
            dropout=dropout,
            activation="gelu",
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)

        # Assessment prediction head (continuous distress score / PHQ-8 indicator)
        self.assessment_head = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1)
        )

    def forward(self, vectors: Dict[str, torch.Tensor], mask: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Args:
            vectors: Dict with keys 'voice', 'face', 'gaze', 'text', 'rppg' each (batch_size, dim)
            mask: Binary tensor (batch_size, 5) where 1 indicates present and 0 indicates masked/missing
        Returns:
            fused_z: (batch_size, d_model)
            prediction: (batch_size, 1)
            attention_weights: (batch_size, 5)
        """
        batch_size = mask.shape[0]

        # Project modalities to d_model
        t_voice = self.voice_proj(vectors["voice"]).unsqueeze(1)
        t_face = self.face_proj(vectors["face"]).unsqueeze(1)
        t_gaze = self.gaze_proj(vectors["gaze"]).unsqueeze(1)
        t_text = self.text_proj(vectors["text"]).unsqueeze(1)
        t_rppg = self.rppg_proj(vectors["rppg"]).unsqueeze(1)

        # Add modality identity embeddings
        device = mask.device
        t_voice = t_voice + self.modality_embeddings(torch.tensor(1, device=device))
        t_face = t_face + self.modality_embeddings(torch.tensor(2, device=device))
        t_gaze = t_gaze + self.modality_embeddings(torch.tensor(3, device=device))
        t_text = t_text + self.modality_embeddings(torch.tensor(4, device=device))
        t_rppg = t_rppg + self.modality_embeddings(torch.tensor(5, device=device))

        # Concatenate CLS token + 5 modality tokens: shape (batch_size, 6, d_model)
        cls_tokens = self.cls_token.expand(batch_size, -1, -1) + self.modality_embeddings(torch.tensor(0, device=device))
        tokens = torch.cat([cls_tokens, t_voice, t_face, t_gaze, t_text, t_rppg], dim=1)

        # Construct key_padding_mask: True indicates element should NOT attend (is masked out)
        # CLS token (index 0) is never masked
        cls_mask = torch.ones(batch_size, 1, device=device)
        full_mask = torch.cat([cls_mask, mask], dim=1)  # shape (batch_size, 6)
        key_padding_mask = (full_mask < 0.5)  # True = ignore

        # Handle edge case: if all modalities are masked, allow attending to CLS only
        all_masked = (mask.sum(dim=1) == 0)
        if all_masked.any():
            key_padding_mask[all_masked, 0] = False

        # Execute Transformer
        out_tokens = self.transformer(tokens, src_key_padding_mask=key_padding_mask)

        # Fused state z_t is the CLS representation
        fused_z = out_tokens[:, 0, :]  # (batch_size, d_model)

        # Prediction score through assessment head
        logits = self.assessment_head(fused_z)
        pred = torch.sigmoid(logits)

        # Estimate explainability attention weights using dot-product similarity between CLS and each modality
        modality_tokens = out_tokens[:, 1:6, :]  # (batch_size, 5, d_model)
        sim = torch.bmm(modality_tokens, fused_z.unsqueeze(-1)).squeeze(-1) / np.sqrt(self.d_model)  # (batch_size, 5)
        # Apply mask to similarities before softmax so missing channels have 0 weight
        sim = sim.masked_fill(mask < 0.5, -1e9)
        attn_weights = torch.softmax(sim, dim=-1)
        # If all modalities are masked, set all weights to 0
        attn_weights = attn_weights * (mask.sum(dim=-1, keepdim=True) > 0).float()

        return fused_z, pred, attn_weights

class CrossModalTransformerService:
    def __init__(self, d_model: int = 128, device: Optional[str] = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = CrossModalTransformer(d_model=d_model).to(self.device)
        self.model.eval()

    def fuse(self, aligned_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Accepts output from TemporalTurnAligner.
        Returns fused state vector z_t, assessment prediction score, and per-modality attention weights.
        """
        vectors = aligned_dict["vectors"]
        mask_vec = aligned_dict["mask_vector"]

        # Convert to torch tensors
        tensor_vecs = {
            k: torch.tensor(v, dtype=torch.float32, device=self.device).unsqueeze(0)
            for k, v in vectors.items()
        }
        tensor_mask = torch.tensor(mask_vec, dtype=torch.float32, device=self.device).unsqueeze(0)

        with torch.no_grad():
            fused_z, pred, attn = self.model(tensor_vecs, tensor_mask)

        z_np = fused_z.squeeze(0).cpu().numpy().tolist()
        pred_val = float(pred.squeeze().item())
        attn_np = attn.squeeze(0).cpu().numpy()

        attn_dict = {
            MODALITY_ORDER[i]: round(float(attn_np[i]), 4)
            for i in range(len(MODALITY_ORDER))
        }

        # Calibrated confidence: higher when more modalities available and prediction is definitive
        num_avail = float(np.sum(mask_vec))
        base_conf = 0.5 + 0.1 * num_avail
        conf_val = float(min(0.98, max(0.3, base_conf * (0.5 + abs(pred_val - 0.5)))))

        return {
            "fused_state": [round(x, 4) for x in z_np],
            "prediction_score": round(pred_val, 4),
            "confidence": round(conf_val, 4),
            "attention_weights": attn_dict,
            "modalities_attended": [MODALITY_ORDER[i] for i in range(len(MODALITY_ORDER)) if mask_vec[i] > 0.5]
        }
