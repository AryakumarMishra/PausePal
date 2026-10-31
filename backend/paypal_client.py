import os
import requests
from dotenv import load_dotenv

load_dotenv()

d = {"grant_type" : "client_credentials"}
h = {"Accept": "application/json", "Accept-Language": "en_US", 'content-type':'application/x-www-form-urlencoded'}

client_id = os.getenv('PAYPAL_CLIENT_ID')
client_secret = os.getenv('PAYPAL_CLIENT_SECRET')
base_url = os.getenv('PAYPAL_BASE_URL')


# Getting OAuth Access Token
def get_access_token():
    try:
        response = requests.post(f'{base_url}/v1/oauth2/token', auth=(client_id, client_secret), headers=h, data=d)
        response.raise_for_status()
        data = response.json()
        return data['access_token']
    except requests.exceptions.HTTPError as err:
        raise 


# Creating PayPal order
def create_order(amount, currency, request_id):
    access_token = get_access_token()
    url = f"{base_url}/v2/checkout/orders"
    headers = {
        "Content-Type": "application/json", 
        "PayPal-Request-Id": f"{request_id}",
        "Authorization": f"Bearer {access_token}",
    }
    body = {
        "intent": "AUTHORIZE",
        "purchase_units": [{
            "amount": {
                "currency_code": f"{currency}",
                "value": f"{amount}",
            },
        }],
        "application_context": {
            "return_url": "http://localhost:8000/paypal/return",
            "cancel_url": "http://localhost:8000/paypal/cancel"
        }
    }

    try:
        response = requests.post(url, json = body, headers = headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        return data
    except requests.exceptions.HTTPError as err:
        raise
    except requests.exceptions.Timeout:
        raise
    except requests.exceptions.ConnectionError:
        raise
    except requests.exceptions.RequestException:
        raise