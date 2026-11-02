from sqlalchemy import select, update
from sqlalchemy.orm import Session

from models import Transaction


# Inserting a Transaction into the Database
def create_transaction(db: Session, paypal_order_id: str, status: str):
    new_transaction = Transaction(
        paypal_order_id = paypal_order_id,
        status = status
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