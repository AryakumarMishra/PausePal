from sqlalchemy import String, Numeric, DateTime
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped, mapped_column
from decimal import Decimal
from datetime import datetime


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
    grace_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    void_request_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    capture_request_id: Mapped[str | None] = mapped_column(String(50), nullable=True)