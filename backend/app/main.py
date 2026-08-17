from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.billing.router import router as billing_router
from app.appointments.router import router as appointments_router
from app.config import get_settings
from app.clinical.router import router as clinical_router
from app.dashboard import router as dashboard_router
from app.finance import router as finance_router
from app.laboratory import router as laboratory_router
from app.patients.router import router as patients_router
from app.reports import router as reports_router
from app.staff import router as staff_router

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
)
app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(dashboard_router)
app.include_router(staff_router)
app.include_router(appointments_router)
app.include_router(clinical_router)
app.include_router(billing_router)
app.include_router(laboratory_router)
app.include_router(finance_router)
app.include_router(reports_router)


@app.get("/api/health", tags=["operations"])
async def health() -> dict[str, str]:
    return {"status": "healthy"}
