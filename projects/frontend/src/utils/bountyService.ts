import algosdk from "algosdk";
import { AlgorandClient, microAlgos } from "@algorandfoundation/algokit-utils";
import { BountyClient, BountyFactory } from "../contracts/Bounty";
import { getAlgodConfigFromViteEnvironment } from "./network/getAlgoClientConfigs";
import { makePaymentTxnWithSuggestedParamsFromObject, getApplicationAddress } from "algosdk";

const ALGOD_SERVER = "https://testnet-api.algonode.cloud";
const ALGOD_TOKEN = "";

/** Status codes: 0=Open, 1=Claimed, 2=Submitted, 3=Approved, 4=Cancelled */
export interface OnChainBountyInfo {
  creator: string;
  worker: string;
  amount: bigint;
  status: number; // 0=Open, 1=Claimed, 2=Submitted, 3=Approved, 4=Cancelled
}

/**
 * Fetch on-chain bounty state (creator, worker, amount, status)
 * by reading the app's global state directly (no signer required).
 */
export async function getBountyOnChainInfo(
  appId: number
): Promise<OnChainBountyInfo> {
  const algorand = getAlgorandClient();
  const client = new BountyClient({ appId: BigInt(appId), algorand });
  const state = await client.state.global.getAll();
  return {
    creator: state.creator ?? "",
    worker: state.worker ?? "",
    amount: state.amount ?? BigInt(0),
    status: Number(state.status ?? 0),
  };
}

/** Create a shared AlgorandClient instance from env config */
function getAlgorandClient(): AlgorandClient {
  return AlgorandClient.fromConfig({ algodConfig: getAlgodConfigFromViteEnvironment() });
}

/**
 * Create a bounty app on Algorand using the REAL Bounty contract (ARC4).
 * This deploys the actual bounty smart contract with escrow logic,
 * funds it with min balance, and calls create_bounty to set the reward.
 */
export async function createBountyWithWallet(
  creatorAddress: string,
  amount: number, // ALGO
  transactionSigner: (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ) => Promise<Uint8Array[]>
): Promise<{ appId: number; appAddress: string; txnId: string }> {
  try {
    const algorand = getAlgorandClient();
    algorand.setDefaultSigner(transactionSigner);

    const amountMicroAlgos = Math.round(amount * 1_000_000);

    // Step 1: Deploy the real Bounty contract (bare create)
    console.log("📍 Step 1: Deploying Bounty ARC4 contract...");
    const factory = new BountyFactory({ defaultSender: creatorAddress, algorand });
    const { appClient } = await factory.send.create.bare();
    const appId = Number(appClient.appId);
    const appAddr = getApplicationAddress(appId);
    console.log(`✅ App Created! ID: ${appId}, Address: ${appAddr}`);

    // Step 2: Fund the app account with min balance (0.1 ALGO)
    console.log("📍 Step 2: Funding app with minimum balance...");
    await algorand.send.payment({
      sender: creatorAddress,
      receiver: String(appAddr),
      amount: microAlgos(100_000),
      signer: transactionSigner,
    });
    console.log("✅ App funded with 0.1 ALGO min balance");

    // Step 3: Call create_bounty ABI method with a grouped payment txn
    console.log("📍 Step 3: Calling create_bounty method with payment...");
    const sp = await algorand.client.algod.getTransactionParams().do();
    const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
      sender: creatorAddress,
      receiver: appAddr,
      amount: amountMicroAlgos,
      suggestedParams: sp,
    });

    const client = new BountyClient({
      appId: BigInt(appId),
      algorand,
      defaultSigner: transactionSigner,
    });
    const result = await client.send.createBounty({
      args: {
        payment: { txn: payTxn, signer: transactionSigner },
        amount: BigInt(amountMicroAlgos),
      },
      sender: creatorAddress,
    });
    console.log(`✅ create_bounty called! Reward: ${amount} ALGO escrowed in app`);

    return {
      appId,
      appAddress: String(appAddr),
      txnId: result.transaction.txID(),
    };
  } catch (error) {
    console.error("❌ Error creating bounty:", error);
    throw error;
  }
}

/**
 * Call the create_bounty method on an already-deployed bounty app.
 * Uses proper ARC4 ABI encoding via the typed BountyClient.
 */
export async function callCreateBountyMethod(
  appId: number,
  creatorAddress: string,
  bountyAmount: number, // ALGO
  transactionSigner: (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ) => Promise<Uint8Array[]>
): Promise<string> {
  try {
    const algorand = getAlgorandClient();
    algorand.setDefaultSigner(transactionSigner);

    const amountMicroAlgos = Math.round(bountyAmount * 1_000_000);

    const sp = await algorand.client.algod.getTransactionParams().do();
    const appAddr = getApplicationAddress(appId);
    const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
      sender: creatorAddress,
      receiver: appAddr,
      amount: amountMicroAlgos,
      suggestedParams: sp,
    });

    const client = new BountyClient({
      appId: BigInt(appId),
      algorand,
      defaultSigner: transactionSigner,
    });
    console.log("📍 Calling create_bounty ABI method...");
    const result = await client.send.createBounty({
      args: {
        payment: { txn: payTxn, signer: transactionSigner },
        amount: BigInt(amountMicroAlgos),
      },
      sender: creatorAddress,
    });
    console.log("✅ create_bounty method called!");
    return result.transaction.txID();
  } catch (error) {
    console.error("❌ Error calling create_bounty:", error);
    throw error;
  }
}

/**
 * Call the claim method on the bounty contract
 * Uses typed BountyClient for proper ARC4 ABI encoding
 */
export async function callClaimMethod(
  appId: number,
  sender: string,
  transactionSigner: (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ) => Promise<Uint8Array[]>
): Promise<string> {
  const algorand = AlgorandClient.fromConfig({ algodConfig: getAlgodConfigFromViteEnvironment() });
  algorand.setDefaultSigner(transactionSigner);
  const client = new BountyClient({
    appId: BigInt(appId),
    algorand,
    defaultSigner: transactionSigner,
  });
  console.log("Sending claim transaction for appId:", appId);
  const result = await client.send.claim({
    args: [],
    sender,
  });
  console.log("Claim confirmed:", result);
  return result.transaction.txID();
}

/**
 * Call the submit_work method on the bounty contract
 * Uses typed BountyClient for proper ARC4 ABI encoding
 */
export async function callSubmitWorkMethod(
  appId: number,
  sender: string,
  transactionSigner: (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ) => Promise<Uint8Array[]>
): Promise<string> {
  const algorand = AlgorandClient.fromConfig({ algodConfig: getAlgodConfigFromViteEnvironment() });
  algorand.setDefaultSigner(transactionSigner);
  const client = new BountyClient({
    appId: BigInt(appId),
    algorand,
    defaultSigner: transactionSigner,
  });
  console.log("Sending submit_work transaction for appId:", appId);
  const result = await client.send.submitWork({
    args: [],
    sender,
  });
  console.log("Submit confirmed:", result);
  return result.transaction.txID();
}

/**
 * Call the approve method on the bounty contract.
 * Uses typed BountyClient for proper ARC4 ABI encoding.
 * The approve() method issues an inner payment transaction that transfers
 * the escrowed ALGO from the app account to the worker.
 * extraFee covers the inner transaction fee.
 */
export async function callApproveMethod(
  appId: number,
  sender: string,
  transactionSigner: (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ) => Promise<Uint8Array[]>,
  workerAddress: string
): Promise<string> {
  const algorand = AlgorandClient.fromConfig({ algodConfig: getAlgodConfigFromViteEnvironment() });
  algorand.setDefaultSigner(transactionSigner);
  const client = new BountyClient({
    appId: BigInt(appId),
    algorand,
    defaultSigner: transactionSigner,
  });
  console.log("Sending approve transaction for appId:", appId, "worker:", workerAddress);
  const result = await client.send.approve({
    args: [],
    sender,
    extraFee: microAlgos(1000), // Cover the inner payment transaction fee
  });
  console.log("Approve confirmed:", result);
  return result.transaction.txID();
}
