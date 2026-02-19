import os
import sys
from dotenv import load_dotenv
import algokit_utils

def _get_app_id() -> int:
	app_id_value = sys.argv[1] if len(sys.argv) > 1 else os.getenv("APP_ID")
	if not app_id_value:
		raise ValueError("Set APP_ID in .env or pass it as the first argument.")
	return int(app_id_value)


# Load environment variables
load_dotenv()

APP_ID = _get_app_id()

algorand = algokit_utils.AlgorandClient.from_environment()
client = algorand.client.algod

info = client.application_info(APP_ID)

print("Contract deployed by:")
print(info["params"]["creator"])
