import uuid
from paypal_client import create_order

request_id = str(uuid.uuid4())


order = create_order(6.00, 'USD', request_id)

approval_url = next(
    link['href'] for link in order['links']
    if link['rel'] == 'approve'
)

print(f"Successfully processed the Order Creation")

print(f"Order ID: {order["id"]}")
print(f"Order Status: {order["status"]}")
print(f"Approval URL: {approval_url}")
print("Intent:", order["intent"])

for unit in order.get("purchase_units", []):
    print("Payee:", unit.get("payee"))
    print("Amount:", unit.get("amount"))