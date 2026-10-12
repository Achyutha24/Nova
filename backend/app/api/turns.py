import base64
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Optional, List
from backend.app.database.database import get_db
from backend.app.schemas.turn import TurnCreate, TurnResponse
from backend.app.services.pipeline_service import MultimodalPipelineService
from backend.app.websocket.dashboard_ws import dashboard_ws_manager

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Request

router = APIRouter(tags=["Turns"])

@router.post("/sessions/{session_id}/turn")
async def process_session_turn(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            body = await request.json()
            turn_data = TurnCreate(**body)
        elif "multipart/form-data" in content_type:
            form = await request.form()
            audio_file = form.get("audio_file")
            video_file = form.get("video_file")
            transcript_text = form.get("transcript_text") or form.get("transcript_override")
            question_id = form.get("question_id") or form.get("question_id_answered")
            turn_index = int(form.get("turn_index", 1))
            req_id = form.get("request_id")
            inp_src = form.get("input_source") or ("speech" if audio_file else "manual_text")

            b64_audio = None
            if audio_file and hasattr(audio_file, "read"):
                content = await audio_file.read()
                if content:
                    b64_audio = base64.b64encode(content).decode("utf-8")

            b64_frames = []
            if video_file and hasattr(video_file, "read"):
                content = await video_file.read()
                if content:
                    b64_frames = [base64.b64encode(content).decode("utf-8")]

            turn_data = TurnCreate(
                turn_index=turn_index,
                question_id_answered=str(question_id) if question_id else None,
                audio_base64=b64_audio,
                video_frames_base64=b64_frames if b64_frames else None,
                transcript_override=str(transcript_text) if transcript_text else None,
                input_source=str(inp_src) if inp_src else None,
                request_id=str(req_id) if req_id else None
            )
        else:
            # Default fallback try json
            body = await request.json()
            turn_data = TurnCreate(**body)

        result = MultimodalPipelineService.process_turn(db, session_id, turn_data)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline processing error: {str(e)}")


@router.post("/sessions/{session_id}/audio")
async def upload_turn_audio(
    session_id: str,
    question_id_answered: Optional[str] = Form(None),
    request_id: Optional[str] = Form(None),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    audio_bytes = await audio_file.read()
    b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
    turn_data = TurnCreate(
        question_id_answered=question_id_answered,
        audio_base64=b64_audio,
        input_source="speech",
        request_id=request_id
    )
    return MultimodalPipelineService.process_turn(db, session_id, turn_data)

@router.post("/sessions/{session_id}/response")
def submit_response_lightweight(
    session_id: str,
    turn_data: TurnCreate,
    db: Session = Depends(get_db)
):
    return MultimodalPipelineService.process_turn(db, session_id, turn_data)

@router.websocket("/ws/dashboard/{session_id}")
async def dashboard_websocket_endpoint(websocket: WebSocket, session_id: str):
    await dashboard_ws_manager.connect(session_id, websocket)
    try:
        while True:
            # Keep socket open and receive ping/heartbeat
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        dashboard_ws_manager.disconnect(session_id, websocket)
