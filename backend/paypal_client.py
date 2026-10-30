import os
import requests
from dotenv import load_dotenv

load_dotenv()

d = {"grant_type" : "client_credentials"}
h = {"Accept": "application/json", "Accept-Language": "en_US", 'content-type':'application/x-www-form-urlencoded'}

client_id = os.getenv('PAYPAL_CLIENT_ID')
client_secret = os.getenv('PAYPAL_CLIENT_SECRET')
base_url = os.getenv('PAYPAL_BASE_URL')

def get_access_token():
    try:
        response = requests.post(f'{base_url}/v1/oauth2/token', auth=(client_id, client_secret), headers=h, data=d)
        response.raise_for_status()
        data = response.json()
        return data['access_token']
    except requests.exceptions.HTTPError as err:
        return f"HTTP Error Occured: {err}"