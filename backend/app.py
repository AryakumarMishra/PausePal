from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

from paypal_client import get_order_details

app = FastAPI()

@app.get("/paypal/return")
def paypal_return(token: str | None = Query(default=None)):
    if not token:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing PayPal order token"}
        )
     
    order_details = get_order_details(token)

    if order_details.get('status') == "APPROVED":
        return {
            "success": True,
            "order_id": token,
            "status": "APPROVED",
            "message": "The Payment has been Approved"
        }

    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "status": order_details.get("status"),
            "message": "Payment has not been approved"
        }
    )


@app.get("/paypal/cancel", response_class=JSONResponse)
async def paypal_cancel(token: str | None = Query(default=None)):
    return {
        "message": "Buyer cancelled PayPal checkout",
        "token": token
    }