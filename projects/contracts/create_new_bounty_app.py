#!/usr/bin/env python3

import base64
import json
import os

from dotenv import load_dotenv

from algosdk import account, transaction
from algosdk.abi import Contract
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
    TransactionWithSigner,
)
from algosdk.logic import get_application_address
from algosdk.mnemonic import to_private_key
from algosdk.v2client import algod


# ==============================
# CONFIG
# ==============================

BOUNTY_AMOUNT = 1_000_000  # 1 ALGO in microAlgos
MIN_BALANCE = 100_000  # 0.1 ALGO in microAlgos

APPROVAL_TEAL_PATH = "smart_contracts/artifacts/bounty/Bounty.approval.teal"
CLEAR_TEAL_PATH = "smart_contracts/artifacts/bounty/Bounty.clear.teal"
APP_SPEC_PATH = "smart_contracts/artifacts/bounty/Bounty.arc56.json"


# ==============================
# LOAD ENV
# ==============================

load_dotenv()

CREATOR_MNEMONIC = os.getenv("CREATOR_MNEMONIC")
if not CREATOR_MNEMONIC:
    raise ValueError("Set CREATOR_MNEMONIC in your .env file.")

ALGOD_SERVER = os.getenv("ALGOD_SERVER", "https://testnet-api.algonode.cloud")
ALGOD_TOKEN = os.getenv("ALGOD_TOKEN", "")


# ==============================
# CLIENT SETUP
# ==============================

client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_SERVER)
print("Connected to:", ALGOD_SERVER)

creator_private_key = to_private_key(CREATOR_MNEMONIC)
creator_address = account.address_from_private_key(creator_private_key)
print("Creator:", creator_address)


# ==============================
# HELPERS
# ==============================


def _compile_teal(teal_path: str) -> bytes:
    with open(teal_path, "r", encoding="utf-8") as teal_file:
        teal_source = teal_file.read()
    compile_result = client.compile(teal_source)
    return base64.b64decode(compile_result["result"])


def _load_schema(app_spec_path: str) -> tuple[transaction.StateSchema, transaction.StateSchema]:
    with open(app_spec_path, "r", encoding="utf-8") as spec_file:
        app_spec = json.load(spec_file)
    global_schema = app_spec["state"]["schema"]["global"]
    local_schema = app_spec["state"]["schema"]["local"]
    return (
        transaction.StateSchema(
            num_uints=global_schema["ints"],
            num_byte_slices=global_schema["bytes"],
        ),
        transaction.StateSchema(
            num_uints=local_schema["ints"],
            num_byte_slices=local_schema["bytes"],
        ),
    )


# ==============================
# CREATE NEW APP
# ==============================

approval_program = _compile_teal(APPROVAL_TEAL_PATH)
clear_program = _compile_teal(CLEAR_TEAL_PATH)

global_schema, local_schema = _load_schema(APP_SPEC_PATH)

sp = client.suggested_params()
create_txn = transaction.ApplicationCreateTxn(
    sender=creator_address,
    sp=sp,
    on_complete=transaction.OnComplete.NoOpOC,
    approval_program=approval_program,
    clear_program=clear_program,
    global_schema=global_schema,
    local_schema=local_schema,
)

signed_create_txn = create_txn.sign(creator_private_key)
create_txid = client.send_transaction(signed_create_txn)
create_result = transaction.wait_for_confirmation(client, create_txid, 4)

app_id = create_result["application-index"]
app_address = get_application_address(app_id)

print("New APP_ID:", app_id)
print("App Address:", app_address)


# ==============================
# FUND MIN BALANCE
# ==============================

min_balance_txn = transaction.PaymentTxn(
    sender=creator_address,
    sp=client.suggested_params(),
    receiver=app_address,
    amt=MIN_BALANCE,
)

min_balance_txid = client.send_transaction(min_balance_txn.sign(creator_private_key))
transaction.wait_for_confirmation(client, min_balance_txid, 4)

print("Min balance funded:", MIN_BALANCE)


# ==============================
# CALL create_bounty
# ==============================

with open(APP_SPEC_PATH, "r", encoding="utf-8") as spec_file:
    contract = Contract.from_json(spec_file.read())

method = contract.get_method_by_name("create_bounty")

signer = AccountTransactionSigner(creator_private_key)

payment_txn = transaction.PaymentTxn(
    sender=creator_address,
    sp=client.suggested_params(),
    receiver=app_address,
    amt=BOUNTY_AMOUNT,
)

atc = AtomicTransactionComposer()
atc.add_method_call(
    app_id=app_id,
    method=method,
    sender=creator_address,
    sp=client.suggested_params(),
    signer=signer,
    method_args=[TransactionWithSigner(payment_txn, signer), BOUNTY_AMOUNT],
)

result = atc.execute(client, 4)
print("Bounty funded. Transaction IDs:", result.tx_ids)

print("Done. Use this APP_ID:", app_id)
