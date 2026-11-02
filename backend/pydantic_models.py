from pydantic import BaseModel, Field
from decimal import Decimal

class CheckoutRequest(BaseModel):
    amount: Decimal = Field(gt=0, description="Checkout amount must be greater than 0")
    currency: str = Field(min_length=3, max_length=3)