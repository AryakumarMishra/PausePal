"""
This file is currently just for small, unstructured, messy testing purposes.
Not part of the main code.
"""


import uuid
from paypal_client import create_order, authorize_order, capture_authorization, void_authorization

# order_request_id = str(uuid.uuid4())

# order = create_order(6.00, 'USD', order_request_id)

# approval_url = next(
#     link['href'] for link in order['links']
#     if link['rel'] == 'approve'
# )

# order_id = order["id"]

# print(f"Successfully processed the Order Creation")

# print(f"Order ID: {order_id}")
# print(f"Order Status: {order["status"]}")
# print(f"Approval URL: {approval_url}\n")




# authorization_request_id = str(uuid.uuid4())

# order_id = ""

# authorization = authorize_order(order_id, authorization_request_id)

# print(f"Order ID: {authorization["id"]}")
# print(f"Order Status: {authorization["status"]}\n")

# authorization_details = (
#     authorization["purchase_units"][0]["payments"]["authorizations"][0]
# )

# print("Authorization ID:", authorization_details["id"])
# print("Authorization Status:", authorization_details["status"])
# print("Authorized Amount:", authorization_details["amount"])





# capture_request_id = str(uuid.uuid4())

# authorization_id = ""

# capture = capture_authorization(authorization_id, capture_request_id)

# print("Capture ID:", capture["id"])
# print("Capture Status:", capture["status"])
# print("Amount:", capture["amount"])
# print("Final Capture:", capture["final_capture"])






# void_request_id = str(uuid.uuid4())

# authorization_id = ""

# void = void_authorization(authorization_id, void_request_id)

# print("Authorization ID:", void["id"])
# print("Authorization Status:", void["status"])