
import asyncio
import logging

from database import SessionLocal
from paypal_client import capture_authorization
from services.transaction_service import (
    get_expired_transactions,
    claim_capture_transaction,
    complete_capture_transaction,
)

logger = logging.getLogger(__name__)


def process_expired_transactions():
    db = SessionLocal()

    try:
        transactions = get_expired_transactions(db)

        for transaction in transactions:
            order_id = transaction.paypal_order_id
            authorization_id = transaction.paypal_authorization_id

            if not authorization_id:
                logger.error(f"Missing authorization ID for order {order_id}")
                continue

            try:
                # Atomically claiming the transaction
                capture_request_id = claim_capture_transaction(db, order_id)

                if not capture_request_id:
                    continue

                # Calling PayPal Capture API
                response = capture_authorization(authorization_id, capture_request_id)

                if not isinstance(response, dict):
                    logger.error(f"Invalid PayPal response for order {order_id}")
                    continue

                # Verifying PayPal response
                status = response.get("status")

                if status == "COMPLETED":
                    capture_id = response.get("id")

                    if not capture_id:
                        logger.error(f"PayPal confirmed COMPLETED but no capture ID was found for order {order_id}")
                        continue

                    # Persisting successful capture
                    saved = complete_capture_transaction(db, order_id, capture_id)

                    if not saved:
                        logger.error(f"PayPal capture succeeded but database update failed for order {order_id}")
                        continue

                    logger.info(
                        f"Successfully captured order {order_id}. Capture ID: {capture_id}")

                elif status == "PENDING":
                    logger.info(f"Capture pending for order {order_id}")

                else:
                    logger.warning(f"Unexpected PayPal capture status '{status}' for order {order_id}")

            except Exception:
                logger.exception(f"Failed to process capture for order {order_id}")

    finally:
        db.close()


# Background Capture Worker
async def capture_worker():
    while True:
        try:
            await asyncio.to_thread(process_expired_transactions)

        except Exception:
            logger.exception("Capture worker cycle failed")

        await asyncio.sleep(1)
