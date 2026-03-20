from fastapi import APIRouter, HTTPException
from backend.models import CustomerProfile
from backend.database import list_customers, get_customer, save_customer, delete_customer

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerProfile])
def get_customers():
    return list_customers()


@router.get("/{customer_id}", response_model=CustomerProfile)
def get_customer_by_id(customer_id: str):
    profile = get_customer(customer_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Customer not found")
    return profile


@router.post("", response_model=CustomerProfile)
def create_customer(profile: CustomerProfile):
    save_customer(profile)
    return profile


@router.delete("/{customer_id}")
def remove_customer(customer_id: str):
    if not delete_customer(customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"status": "deleted", "customer_id": customer_id}
