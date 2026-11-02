from sqlalchemy import String, Numeric
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped, mapped_column
from decimal import Decimal


class Base(DeclarativeBase):
    pass


class Transaction(Base):
    __tablename__ = 'transactions'

    id: Mapped[int] = mapped_column(primary_key=True)
    paypal_order_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    paypal_authorization_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    paypal_capture_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    authorization_request_id: Mapped[str | None] = mapped_column(String(50), nullable=True)