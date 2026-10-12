from fastapi import APIRouter
import platform
import os
import psutil
import torch

router = APIRouter(prefix="/system", tags=["System"])

@router.get("/health")
def get_system_health():
    cuda_available = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if cuda_available else "CPU (Fallback)"
    
    # Process memory
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    
    return {
        "status": "healthy",
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "torch_device": device_name,
        "cuda_available": cuda_available,
        "memory_total_gb": round(mem.total / (1024**3), 2),
        "memory_used_gb": round(mem.used / (1024**3), 2),
        "memory_percent": mem.percent,
        "disk_free_gb": round(disk.free / (1024**3), 2),
        "active_models": {
            "asr": "Whisper (base)",
            "text": "DistilRoBERTa",
            "voice": "Acoustic DSP (MFCC/Pitch/Jitter/Shimmer/HNR)",
            "face": "MediaPipe FaceMesh",
            "gaze": "MediaPipe Iris",
            "rppg": "Isolated (Disabled by Flag)",
            "fusion": "Cross-Modal Transformer",
            "rl": "PPO Adaptive Policy"
        }
    }
