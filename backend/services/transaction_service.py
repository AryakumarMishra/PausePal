from sqlalchemy import select
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
    except:
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