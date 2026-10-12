import asyncio
import json
from typing import Dict, List, Any
from fastapi import WebSocket
from backend.app.core.logging import logger

class DashboardWebSocketManager:
    def __init__(self):
        # Maps session_id to list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)
        logger.info(f"Dashboard WebSocket connected for session {session_id}. Active: {len(self.active_connections[session_id])}")

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        logger.info(f"Dashboard WebSocket disconnected for session {session_id}.")

    async def broadcast(self, session_id: str, message: Dict[str, Any]):
        if session_id in self.active_connections:
            dead_sockets = []
            for ws in self.active_connections[session_id]:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.debug(f"Failed to send to WebSocket: {e}")
                    dead_sockets.append(ws)
            for ws in dead_sockets:
                self.disconnect(session_id, ws)

    def broadcast_sync(self, session_id: str, message: Dict[str, Any]):
        """Safe synchronous broadcast trigger from standard request handlers."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self.broadcast(session_id, message))
            else:
                loop.run_until_complete(self.broadcast(session_id, message))
        except Exception:
            # If no running event loop or called in background thread
            pass

dashboard_ws_manager = DashboardWebSocketManager()
