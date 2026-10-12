from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.database.database import init_db
from backend.app.api import participants, sessions, system, models, turns, experiments
from question_bank.manager import question_bank

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="NOVA: Embodied Conversational Agent for Mental Health Research with Multimodal Signal Fusion and Adaptive Questioning"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(participants.router, prefix=settings.API_V1_PREFIX)
app.include_router(sessions.router, prefix=settings.API_V1_PREFIX)
app.include_router(turns.router, prefix=settings.API_V1_PREFIX)
app.include_router(system.router, prefix=settings.API_V1_PREFIX)
app.include_router(models.router, prefix=settings.API_V1_PREFIX)
app.include_router(experiments.router, prefix=settings.API_V1_PREFIX)
# Also register WebSocket at root /ws/dashboard/{session_id}
app.add_api_websocket_route("/ws/dashboard/{session_id}", turns.dashboard_websocket_endpoint)

@app.get("/api/questions")
def get_safe_question_bank():
    return question_bank.list_all_questions(enabled_only=True)

@app.on_event("startup")
def startup_event():
    logger.info("Initializing NOVA research platform database...")
    init_db()
    logger.info(f"Loaded {len(question_bank.list_all_questions())} clinically reviewed safe questions.")
    logger.info("NOVA FastAPI backend initialized and ready.")

# Mount Dashboard Static Files if built
DASHBOARD_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dashboard", "dist"))
if os.path.exists(DASHBOARD_DIST):
    app.mount("/dashboard", StaticFiles(directory=DASHBOARD_DIST, html=True), name="dashboard")
    logger.info(f"Mounted Researcher Dashboard at /dashboard from {DASHBOARD_DIST}")

@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "status": "operational",
        "docs": "/docs",
        "health": f"{settings.API_V1_PREFIX}/system/health",
        "dashboard": "/dashboard" if os.path.exists(DASHBOARD_DIST) else "Not built"
    }

