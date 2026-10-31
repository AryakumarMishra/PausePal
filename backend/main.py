import uuid
from paypal_client import create_order

request_id = str(uuid.uuid4())


order = create_order(6, 'USD', request_id)
print(f"Successfully processed the Order Creation")
print(f"Order ID: {order['id']}\nStatus: {order['status']}\nApproval URL: {order['links'][1]['href']}")