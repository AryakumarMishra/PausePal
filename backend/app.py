import uuid
from fastapi import FastAPI, Query, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from paypal_client import create_order, get_order_details, authorize_order
from database import get_db
from services.transaction_service import create_transaction, get_transaction, authorize_transaction
from services.payment_verification import verify_order_details, verify_authorization_response
from pydantic_models import CheckoutRequest

app = FastAPI()


# Checkout creation endpoint
@app.post("/checkout/create")
def checkout_create(request: CheckoutRequest, db: Session = Depends(get_db)):
    amount = request.amount
    currency = request.currency
    order_request_id = str(uuid.uuid4())

    # Creating a PayPal Order
    order = create_order(amount, currency, order_request_id)

    # Retrieving Approval URL, Order ID, and Status
    approval_url = next(
        link['href'] for link in order['links']
        if link['rel'] == 'approve'
    )
    order_id = order["id"]
    status = order['status']

    # Saving the transaction in SQLite Database
    create_transaction(db, order_id, status, amount, currency)

    return {
        "success": True,
        "order_id": order_id,
        "approval_url": approval_url,
    }


# Return Endpoint
@app.get("/paypal/return")
def paypal_return(db: Session = Depends(get_db), token: str | None = Query(default=None)):
    if not token:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing PayPal order token"}
        )

    # Retrieving the transaction details from the database
    transaction_details = get_transaction(db, token)
    
    if not transaction_details:
        return JSONResponse(
            status_code=404,
            content={"error": "Transaction not found"}
        )

    # Checking internal transaction state
    if transaction_details.status == "AUTHORIZED":
        return {
            "success": True,
            "order_id": token,
            "status": "AUTHORIZED",
            "message": "Payment is already authorized"
        }

    if transaction_details.status != "CREATED":
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "status": transaction_details.status,
                "message": "Transaction cannot be authorized"
            }
        )

    # Retrieving the Order details
    try:
        order_details = get_order_details(token)
    except Exception:
        return JSONResponse(
            status_code=502,
            content={
                "success": False,
                "message": "Unable to retrieve PayPal Order details"
            }
        )

    if not verify_order_details(order_details, transaction_details):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "PayPal order verification failed"
            }
        )

    # Generating authorization request id
    if transaction_details.authorization_request_id:
        authorization_request_id = transaction_details.authorization_request_id
    else:
        authorization_request_id = str(uuid.uuid4())
        transaction_details.authorization_request_id = authorization_request_id

        try:
            db.commit()
            db.refresh(transaction_details)
        except Exception:
            db.rollback()
            raise

    # Authorizing the order
    try:
        authorization_response = authorize_order(token, authorization_request_id)
    except Exception:
        return JSONResponse(
            status_code=502,
            content={
                "success": False,
                "message": "Unable to Authorize PayPal Order"
            }
        )

    if not verify_authorization_response(authorization_response, transaction_details):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "PayPal authorization response verification failed"
            }
        )

    authorization_id = authorization_response["purchase_units"][0]["payments"]["authorizations"][0]["id"]

    # Saving authorization details in Database
    saved = authorize_transaction(db, token, authorization_id)

    if not saved:
        db.expire_all()
        current_transaction = get_transaction(db, token)

        if (current_transaction
            and current_transaction.status == "AUTHORIZED"
            and current_transaction.paypal_authorization_id == authorization_id
        ):
            return {
                "success": True,
                "order_id": token,
                "authorization_id": authorization_id,
                "status": "AUTHORIZED",
                "message": "Payment is already authorized"
            }

        
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "PayPal authorization succeeded but database update failed"
            }
        )

    return {
        "success": True,
        "order_id": token,
        "authorization_id": authorization_id,
        "status": "AUTHORIZED",
        "message": "Payment successfully authorized"
    }


# Cancel Endpoint
@app.get("/paypal/cancel", response_class=JSONResponse)
async def paypal_cancel(token: str | None = Query(default=None)):
    return {
        "message": "Buyer cancelled PayPal checkout",
        "token": token
    }