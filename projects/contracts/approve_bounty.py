import os
from dotenv import load_dotenv

from algosdk import account
from algosdk.mnemonic import to_private_key
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)
from algosdk.abi import Contract
from algosdk.logic import get_application_address
from algosdk.v2client import algod


# ==============================
# CONFIG
# ==============================

APP_ID = 755780805


# ==============================
# LOAD ENV
# ==============================

load_dotenv()

CREATOR_MNEMONIC = os.getenv("CREATOR_MNEMONIC")
WORKER_MNEMONIC = os.getenv("WORKER_MNEMONIC")

if not CREATOR_MNEMONIC:
    raise ValueError("Set CREATOR_MNEMONIC in .env")

if not WORKER_MNEMONIC:
    raise ValueError("Set WORKER_MNEMONIC in .env")


# ==============================
# SETUP CLIENT
# ==============================

ALGOD_SERVER = os.getenv("ALGOD_SERVER")
ALGOD_TOKEN = os.getenv("ALGOD_TOKEN")

client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_SERVER)

print("Connected to:", ALGOD_SERVER)


# ==============================
# ACCOUNTS
# ==============================

creator_private_key = to_private_key(CREATOR_MNEMONIC)
creator_address = account.address_from_private_key(creator_private_key)

worker_private_key = to_private_key(WORKER_MNEMONIC)
worker_address = account.address_from_private_key(worker_private_key)

signer = AccountTransactionSigner(creator_private_key)

print("Creator:", creator_address)
print("Worker:", worker_address)
print("App Address:", get_application_address(APP_ID))


# ==============================
# LOAD CONTRACT ABI
# ==============================

with open(
    "smart_contracts/artifacts/bounty/Bounty.arc56.json"
) as f:
    contract_json = f.read()

contract = Contract.from_json(contract_json)
method = contract.get_method_by_name("approve")


# ==============================
# BUILD TRANSACTION
# ==============================

sp = client.suggested_params()

# 🔥 IMPORTANT: Increase fee for inner transaction execution
sp.flat_fee = True
sp.fee = 2000  # 1000 outer + 1000 inner


atc = AtomicTransactionComposer()

atc.add_method_call(
    app_id=APP_ID,
    method=method,
    sender=creator_address,
    sp=sp,
    signer=signer,
    method_args=[],
    accounts=[worker_address],  # required for inner payment receiver
)


# ==============================
# EXECUTE
# ==============================

print("Calling approve()...")

result = atc.execute(client, 4)

print("✅ Approved successfully!")
print("Tx ID:", result.tx_ids)
