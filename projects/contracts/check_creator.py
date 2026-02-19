import os
from dotenv import load_dotenv
import algokit_utils

# Load environment variables
load_dotenv()

APP_ID = 755773067  # <-- your current app id

algorand = algokit_utils.AlgorandClient.from_environment()
client = algorand.client.algod

info = client.application_info(APP_ID)

print("Contract deployed by:")
print(info["params"]["creator"])
