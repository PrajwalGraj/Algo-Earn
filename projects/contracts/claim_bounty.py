import os
from dotenv import load_dotenv

from algosdk import account
from algosdk.mnemonic import to_private_key
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)
from algosdk.abi import Contract

from algokit_utils import AlgorandClient


# =========================
# CONFIG
# =========================

APP_ID = 755780805


# =========================
# LOAD ENV
# =========================

load_dotenv()

WORKER_MNEMONIC = os.getenv("WORKER_MNEMONIC")
if not WORKER_MNEMONIC:
    raise ValueError("Set WORKER_MNEMONIC in .env file")


# =========================
# CLIENT SETUP
# =========================

algorand = AlgorandClient.from_environment()
client = algorand.client.algod

worker_private_key = to_private_key(WORKER_MNEMONIC)
worker_address = account.address_from_private_key(worker_private_key)

signer = AccountTransactionSigner(worker_private_key)

print("Worker:", worker_address)


# =========================
# LOAD CONTRACT
# =========================

with open(
    "smart_contracts/artifacts/bounty/Bounty.arc56.json"
) as f:
    contract_json = f.read()

contract = Contract.from_json(contract_json)

method = contract.get_method_by_name("claim")


# =========================
# BUILD ATC
# =========================

sp = client.suggested_params()

atc = AtomicTransactionComposer()

atc.add_method_call(
    app_id=APP_ID,
    method=method,
    sender=worker_address,
    sp=sp,
    signer=signer,
    method_args=[],
)

print("Calling claim()...")

result = atc.execute(client, 4)

print("✅ Claimed successfully!")
print("Tx ID:", result.tx_ids)
