from decimal import Decimal, InvalidOperation


def verify_order_details(order_details, transaction_details) -> bool:
    if order_details.get("id") != transaction_details.paypal_order_id:
        return False

    if order_details.get("status") != "APPROVED":
        return False

    if order_details.get("intent") != "AUTHORIZE":
        return False

    purchase_units = order_details.get("purchase_units")

    if not isinstance(purchase_units, list) or len(purchase_units) != 1:
        return False

    purchase_unit = purchase_units[0]
    amount_details = purchase_unit.get("amount")

    if not isinstance(amount_details, dict):
        return False

    paypal_currency = amount_details.get("currency_code")
    paypal_amount = amount_details.get("value")

    transaction_currency = transaction_details.currency
    transaction_amount = transaction_details.amount

    if paypal_currency != transaction_currency:
        return False

    try:
        paypal_amount = Decimal(str(paypal_amount))
        transaction_amount = Decimal(str(transaction_amount))

        if not paypal_amount.is_finite() or not transaction_amount.is_finite():
            return False

    except (InvalidOperation, TypeError, ValueError):
        return False

    if paypal_amount != transaction_amount:
        return False

    return True



def verify_authorization_response(response, transaction_details) -> bool:
    if not isinstance(response, dict):
        return False

    if response.get('id') != transaction_details.paypal_order_id:
        return False
    
    purchase_units = response.get("purchase_units")

    if not isinstance(purchase_units, list) or len(purchase_units) != 1:
        return False

    purchase_unit = purchase_units[0]

    if not isinstance(purchase_unit, dict):
        return False

    payments = purchase_unit.get("payments")

    if not isinstance(payments, dict):
        return False

    authorizations = payments.get("authorizations")

    if not isinstance(authorizations, list) or len(authorizations) != 1:
        return False

    authorization = authorizations[0]

    if not isinstance(authorization, dict):
        return False

    # Validate authorization status
    if authorization.get("status") != "CREATED":
        return False

    # Validate authorization ID
    authorization_id = authorization.get("id")

    if not authorization_id:
        return False

    # Validate amount details
    amount_details = authorization.get("amount")

    if not isinstance(amount_details, dict):
        return False

    paypal_currency = amount_details.get("currency_code")
    paypal_amount = amount_details.get("value")

    transaction_currency = transaction_details.currency
    transaction_amount = transaction_details.amount

    if paypal_currency != transaction_currency:
        return False

    try:
        paypal_amount = Decimal(str(paypal_amount))
        transaction_amount = Decimal(str(transaction_amount))

        if not paypal_amount.is_finite() or not transaction_amount.is_finite():
            return False

    except (InvalidOperation, TypeError, ValueError):
        return False

    if paypal_amount != transaction_amount:
        return False

    return True