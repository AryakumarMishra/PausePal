from sqlalchemy import select, update
from sqlalchemy.orm import Session
from decimal import Decimal

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
def authorize_transaction(db: Session, paypal_order_id: str, paypal_authorization_id: str) -> bool:
    try:
        statement = update(Transaction).where(
            Transaction.paypal_order_id == paypal_order_id,
            Transaction.status == "CREATED",
        ).values(
            status="AUTHORIZED",
            paypal_authorization_id=paypal_authorization_id,
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