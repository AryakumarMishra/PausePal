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

    transaction = db.execute(statement).scalar_one_or_none()

    return transaction


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