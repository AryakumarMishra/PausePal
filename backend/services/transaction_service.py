from sqlalchemy import select, update
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime, timezone
import uuid

from models import Transaction


# Inserting a Transaction into the Database
def create_transaction(
        db: Session, 
        paypal_order_id: str, 
        status: str,
        amount: Decimal,
        currency: str,
    ):
    new_transaction = Transaction(
        paypal_order_id = paypal_order_id,
        status = status,
        amount = amount,
        currency = currency
    )
    try:
        db.add(new_transaction)
        db.commit()
        db.refresh(new_transaction)
    except Exception:
        db.rollback()
        raise

    return new_transaction


# Reading a Transactionn from the Database
def get_transaction(db: Session, paypal_order_id: str):
    statement = select(Transaction).where(
        Transaction.paypal_order_id == paypal_order_id
    )

    transaction_details = db.execute(statement).scalar_one_or_none()

    return transaction_details


# Authorizing the Transaction in Database
def authorize_transaction(
        db: Session, 
        paypal_order_id: str, 
        paypal_authorization_id: str, 
        grace_deadline: datetime
    ) -> bool:
    try:
        statement = update(Transaction).where(
            Transaction.paypal_order_id == paypal_order_id,
            Transaction.status == "CREATED",
        ).values(
            status="AUTHORIZED",
            paypal_authorization_id=paypal_authorization_id,
            grace_deadline=grace_deadline
        )

        result = db.execute(statement)

        if result.rowcount != 1:
            db.rollback()
            return False
        
        db.commit()
        return True

    except Exception:
        db.rollback()
        raise


# Implementing Atomic State Transition
def transition_transaction_status(
        db:Session, 
        paypal_order_id: str, 
        expected_status: str, 
        new_status: str
    ) -> bool:
    statement = update(Transaction).where(
        Transaction.paypal_order_id == paypal_order_id,
        Transaction.status == expected_status
    ).values(status = new_status)

    try:
        result = db.execute(statement)
        db.commit()

        return result.rowcount == 1
    except Exception:
        db.rollback()
        raise



# Claiming the Void transaction
def claim_void_transaction(
        db: Session, 
        paypal_order_id: str,
    ) -> str | None:
    void_request_id = str(uuid.uuid4())

    statement = update(Transaction).where(
        Transaction.paypal_order_id == paypal_order_id,
        Transaction.status == "AUTHORIZED",
        Transaction.grace_deadline > datetime.now(timezone.utc)
    ).values(
        status = "VOID_PENDING",
        void_request_id = void_request_id,
    ).execution_options(synchronize_session=False)

    try:
        result = db.execute(statement)

        if result.rowcount != 1:
            db.rollback()
            return None
        
        db.commit()
        return void_request_id
    
    except Exception:
        db.rollback()
        raise


def complete_void_transaction(
        db: Session, 
        paypal_order_id: str,
    ) -> bool:
    statement = update(Transaction).where(
        Transaction.paypal_order_id == paypal_order_id,
        Transaction.status == "VOID_PENDING",
    ).values(status = "VOIDED")

    try:
        result = db.execute(statement)

        if result.rowcount != 1:
            db.rollback()
            return False
        
        db.commit()

        return True
    
    except Exception:
        db.rollback()
        raise



# Claiming the Capture transaction
def claim_capture_transaction(
        db: Session, 
        paypal_order_id: str,
    ) -> str | None:
    capture_request_id = str(uuid.uuid4())

    statement = update(Transaction).where(
        Transaction.paypal_order_id == paypal_order_id,
        Transaction.status == "AUTHORIZED",
        Transaction.grace_deadline <= datetime.now(timezone.utc)
    ).values(
        status = "CAPTURE_PENDING",
        capture_request_id = capture_request_id,
    ).execution_options(synchronize_session=False)

    try:
        result = db.execute(statement)

        if result.rowcount != 1:
            db.rollback()
            return None
        
        db.commit()
        return capture_request_id
    
    except Exception:
        db.rollback()
        raise


def complete_capture_transaction(
        db: Session, 
        paypal_order_id: str,
        paypal_capture_id: str,
    ) -> bool:
    statement = update(Transaction).where(
        Transaction.paypal_order_id == paypal_order_id,
        Transaction.status == "CAPTURE_PENDING",
    ).values(
        status = "CAPTURED",
        paypal_capture_id = paypal_capture_id
    )

    try:
        result = db.execute(statement)

        if result.rowcount != 1:
            db.rollback()
            return False
        
        db.commit()

        return True
    
    except Exception:
        db.rollback()
        raise



# Retrieving expired Transactions.
def get_expired_transactions(db: Session):
    current_time = datetime.now(timezone.utc)
    
    statement = select(Transaction).where(
            Transaction.status == "AUTHORIZED",
            Transaction.grace_deadline <= current_time
        )
    
    expired_transations = db.execute(statement).scalars().all()

    return expired_transations
