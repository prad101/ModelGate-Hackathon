from fastapi import APIRouter, HTTPException
from backend.models import RequestLogEntry, CustomerStats
from backend.database import get_request_logs, get_customer_stats, get_customer

router = APIRouter(tags=["logs"])


@router.get("/logs/{customer_id}", response_model=list[RequestLogEntry])
def get_logs(customer_id: str, limit: int = 100):
    if not get_customer(customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")
    return get_request_logs(customer_id, limit)


@router.get("/stats/{customer_id}", response_model=CustomerStats)
def get_stats(customer_id: str):
    if not get_customer(customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")
    stats = get_customer_stats(customer_id)
    return CustomerStats(**stats)
