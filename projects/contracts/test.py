import os
from dotenv import load_dotenv
import algokit_utils

load_dotenv()  

algorand = algokit_utils.AlgorandClient.from_environment()

print("ALGOD_SERVER:", os.getenv("ALGOD_SERVER"))

status = algorand.client.algod.status()

print("Connected successfully!")
print(status)
