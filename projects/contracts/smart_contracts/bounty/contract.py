from algopy import *
from algopy.arc4 import ARC4Contract, abimethod


class Bounty(ARC4Contract):

    creator: Account
    worker: Account
    amount: UInt64
    status: UInt64
    # 0=Open, 1=Claimed, 2=Submitted, 3=Approved, 4=Cancelled

    def __init__(self) -> None:
        self.creator = Txn.sender
        self.worker = Global.zero_address
        self.amount = UInt64(0)
        self.status = UInt64(0)

    @abimethod()
    def create_bounty(self, payment: gtxn.PaymentTransaction, amount: UInt64) -> None:
        assert Txn.sender == self.creator
        assert self.amount == UInt64(0)
        assert self.status == UInt64(0)

        assert payment.sender == self.creator
        assert payment.receiver == Global.current_application_address
        assert payment.amount == amount

        self.amount = amount

    @abimethod()
    def claim(self) -> None:
        assert self.status == UInt64(0)
        assert Txn.sender != self.creator

        self.worker = Txn.sender
        self.status = UInt64(1)

    @abimethod()
    def submit_work(self) -> None:
        assert Txn.sender == self.worker
        assert self.status == UInt64(1)

        self.status = UInt64(2)

    @abimethod()
    def approve(self) -> None:
        assert Txn.sender == self.creator
        assert self.status == UInt64(2)

        itxn.Payment(
            receiver=self.worker,
            amount=self.amount,
        ).submit()

        self.amount = UInt64(0)
        self.status = UInt64(3)

    @abimethod()
    def cancel(self) -> None:
        assert Txn.sender == self.creator
        assert self.status == UInt64(0)

        itxn.Payment(
            receiver=self.creator,
            amount=self.amount,
        ).submit()

        self.amount = UInt64(0)
        self.status = UInt64(4)

    @abimethod(readonly=True)
    def get_bounty_info(self) -> tuple[Account, Account, UInt64, UInt64]:
        return self.creator, self.worker, self.amount, self.status
