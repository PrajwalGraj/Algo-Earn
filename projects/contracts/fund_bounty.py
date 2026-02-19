import os
import json
import base64
from dotenv import load_dotenv

from algosdk import account, transaction
from algosdk.mnemonic import to_private_key
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    TransactionWithSigner,
    AccountTransactionSigner,
)
from algosdk.abi import Contract
from algosdk.logic import get_application_address

from algosdk.v2client import algod


# ==============================
# CONFIG
# ==============================

APP_ID = 755780805
BOUNTY_AMOUNT = 1_000_000  # 1 ALGO in microAlgos

ALGOD_ADDRESS = "https://testnet-api.algonode.network"
ALGOD_TOKEN = ""


# ==============================
# LOAD ENV
# ==============================

load_dotenv()

CREATOR_MNEMONIC = os.getenv("CREATOR_MNEMONIC")
if not CREATOR_MNEMONIC:
    raise ValueError("Set CREATOR_MNEMONIC in your .env file")

creator_private_key = to_private_key(CREATOR_MNEMONIC)
creator_address = account.address_from_private_key(creator_private_key)
signer = AccountTransactionSigner(creator_private_key)


# ==============================
# CONNECT CLIENT
# ==============================

client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)
print("Connected to:", ALGOD_ADDRESS)

app_address = get_application_address(APP_ID)

print("APP_ID:", APP_ID)
print("Creator:", creator_address)
print("App Address:", app_address)


# ==============================
# CHECK BALANCE BEFORE
# ==============================

info_before = client.account_info(app_address)
print("Escrow balance BEFORE:", info_before["amount"])


# ==============================
# SUGGESTED PARAMS
# ==============================

sp = client.suggested_params()
sp.flat_fee = True
sp.fee = 3000


# ==============================
# BUILD PAYMENT TXN
# ==============================

payment_txn = transaction.PaymentTxn(
    sender=creator_address,
    sp=sp,
    receiver=app_address,
    amt=BOUNTY_AMOUNT,
    note=os.urandom(16),  # ensures unique tx hash
)

payment_with_signer = TransactionWithSigner(payment_txn, signer)


# ==============================
# LOAD ABI
# ==============================

with open("smart_contracts/artifacts/bounty/Bounty.arc56.json") as f:
    contract_json = json.load(f)

contract = Contract.from_json(json.dumps(contract_json))

method = contract.get_method_by_name("create_bounty")


# ==============================
# ATOMIC GROUP
# ==============================

atc = AtomicTransactionComposer()

atc.add_method_call(
    app_id=APP_ID,
    method=method,
    sender=creator_address,
    sp=sp,
    signer=signer,
    method_args=[payment_with_signer, BOUNTY_AMOUNT],
)


# ==============================
# EXECUTE
# ==============================

try:
    result = atc.execute(client, 4)
    print("✅ Bounty funded successfully!")
    print("Transaction ID:", result.tx_ids)

except Exception as e:
    print("❌ Transaction failed:")
    print(e)
    raise


# ==============================
# CHECK BALANCE AFTER
# ==============================

info_after = client.account_info(app_address)
print("Escrow balance AFTER:", info_after["amount"])
