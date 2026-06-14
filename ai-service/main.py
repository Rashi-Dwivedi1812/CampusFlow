from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

from routes.ai_routes import router as ai_router
from services.scheduler_service import start_scheduler

app = FastAPI(title="CampusFlow AI Service")

app.include_router(ai_router, prefix="/api/ai")
start_scheduler()


@app.get("/health")
def health():
    return {"status": "ok", "service": "campusflow-ai"}
