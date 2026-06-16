import { ccc, Script } from "@ckb-ccc/core";
import { cccClient } from "./ccc-client";
import { CAPSULE_TRANSITION_GUARD } from "./deployment";

export { CAPSULE_TRANSITION_GUARD } from "./deployment";

type Account = {
  lockScript: Script;
  address: string;
  pubKey: string;
};

export type CapsuleOutPoint = {
  txHash: string;
  index: string;
};

export type DecodedCapsule = {
  magic: string;
  version: number;
  capsuleId: string;
  body: string;
};

export type MintCapsuleResult = {
  txHash: string;
  outPoint: CapsuleOutPoint;
  capsule: DecodedCapsule;
  rawOutputData: string;
};

export type CapsuleCellStatus = "live" | "dead-or-missing";

const MAGIC = "CAPSULE_V1";
const BAD_MAGIC = "BAD_MAGIC1";

const MAGIC_LEN = 10;
const VERSION_LEN = 4;
const CAPSULE_ID_LEN = 32;
const HEADER_LEN = MAGIC_LEN + VERSION_LEN + CAPSULE_ID_LEN;

const MAX_BODY_BYTES = 512;

export const generateAccountFromPrivateKey = async (
  privKey: string
): Promise<Account> => {
  const signer = new ccc.SignerCkbPrivateKey(cccClient, privKey);
  const lock = await signer.getAddressObjSecp256k1();

  return {
    lockScript: lock.script,
    address: lock.toString(),
    pubKey: signer.publicKey,
  };
};

export async function capacityOf(address: string): Promise<bigint> {
  const addr = await ccc.Address.fromString(address, cccClient);
  return await cccClient.getBalance([addr.script]);
}

export function shannonToCKB(amount: bigint) {
  return amount / 100000000n;
}

export async function wait(seconds: number) {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;

  if (clean.length % 2 !== 0) {
    throw new Error("Invalid hex string: length must be even");
  }

  const bytes = new Uint8Array(clean.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

function u32ToLeBytes(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Version must be a non-negative integer");
  }

  const bytes = new Uint8Array(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  bytes[2] = (value >> 16) & 0xff;
  bytes[3] = (value >> 24) & 0xff;
  return bytes;
}

function leBytesToU32(bytes: Uint8Array): number {
  if (bytes.length !== 4) {
    throw new Error("Expected exactly 4 bytes for u32");
  }

  return (
    bytes[0] |
    (bytes[1] << 8) |
    (bytes[2] << 16) |
    (bytes[3] << 24)
  );
}

function randomCapsuleId(): Uint8Array {
  const id = new Uint8Array(CAPSULE_ID_LEN);
  crypto.getRandomValues(id);
  return id;
}

export function getCapsuleTypeScript(): Script {
  return ccc.Script.from({
    codeHash: CAPSULE_TRANSITION_GUARD.codeHash,
    hashType: CAPSULE_TRANSITION_GUARD.hashType,
    args: "0x",
  });
}

export function getCapsuleCellDeps() {
  return [
    {
      outPoint: {
        txHash: CAPSULE_TRANSITION_GUARD.cellDeps[0].outPoint.txHash,
        index: CAPSULE_TRANSITION_GUARD.cellDeps[0].outPoint.index,
      },
      depType: CAPSULE_TRANSITION_GUARD.cellDeps[0].depType,
    },
  ];
}

export async function assertDeploymentCellIsLive(): Promise<void> {
  const dep = CAPSULE_TRANSITION_GUARD.cellDeps[0];

  const cell = await cccClient.getCellLive(
    {
      txHash: dep.outPoint.txHash,
      index: dep.outPoint.index,
    },
    true
  );

  if (cell == null) {
    throw new Error(
      [
        "Deployment CellDep is not live on the frontend RPC.",
        "",
        `Missing deployment outPoint: ${dep.outPoint.txHash}:${dep.outPoint.index}`,
        "",
        "Your terminal showed this Cell live on 8114/28114, so if this fails in the browser, ccc-client.ts is pointing to a different RPC.",
      ].join("\n")
    );
  }

  console.log("Deployment CellDep is live:", {
    outPoint: dep.outPoint,
    dataHash: cell.data?.hash,
    expectedCodeHash: CAPSULE_TRANSITION_GUARD.codeHash,
  });
}

export function encodeCapsuleData(params: {
  version: number;
  body: string;
  capsuleId?: Uint8Array;
  useBadMagic?: boolean;
}): string {
  const bodyBytes = new TextEncoder().encode(params.body);

  if (bodyBytes.length === 0) {
    throw new Error("Capsule body cannot be empty");
  }

  if (bodyBytes.length > MAX_BODY_BYTES) {
    throw new Error(`Capsule body must be <= ${MAX_BODY_BYTES} bytes`);
  }

  const magic = params.useBadMagic ? BAD_MAGIC : MAGIC;
  const magicBytes = new TextEncoder().encode(magic);

  if (magicBytes.length !== MAGIC_LEN) {
    throw new Error("Magic prefix must be exactly 10 bytes");
  }

  const versionBytes = u32ToLeBytes(params.version);
  const capsuleId = params.capsuleId ?? randomCapsuleId();

  if (capsuleId.length !== CAPSULE_ID_LEN) {
    throw new Error("Capsule ID must be exactly 32 bytes");
  }

  const data = new Uint8Array(HEADER_LEN + bodyBytes.length);

  data.set(magicBytes, 0);
  data.set(versionBytes, MAGIC_LEN);
  data.set(capsuleId, MAGIC_LEN + VERSION_LEN);
  data.set(bodyBytes, HEADER_LEN);

  return bytesToHex(data);
}

export function decodeCapsuleData(hex: string): DecodedCapsule {
  const data = hexToBytes(hex);

  if (data.length <= HEADER_LEN) {
    throw new Error("Capsule data too short");
  }

  const magic = new TextDecoder().decode(data.slice(0, MAGIC_LEN));
  const version = leBytesToU32(data.slice(MAGIC_LEN, MAGIC_LEN + VERSION_LEN));
  const capsuleId = bytesToHex(data.slice(MAGIC_LEN + VERSION_LEN, HEADER_LEN));
  const body = new TextDecoder().decode(data.slice(HEADER_LEN));

  return {
    magic,
    version,
    capsuleId,
    body,
  };
}

export async function mintCapsule(
  privateKey: string,
  body: string,
  options?: {
    useBadMagic?: boolean;
  }
): Promise<MintCapsuleResult> {
  await assertDeploymentCellIsLive();

  const signer = new ccc.SignerCkbPrivateKey(cccClient, privateKey);
  const signerAddress = await signer.getAddressObjSecp256k1();

  const capsuleType = getCapsuleTypeScript();
  const cellDeps = getCapsuleCellDeps();

  const outputData = encodeCapsuleData({
    version: 1,
    body,
    useBadMagic: options?.useBadMagic ?? false,
  });

  const tx = ccc.Transaction.from({
    cellDeps,
    outputs: [
      {
        lock: signerAddress.script,
        type: capsuleType,
      },
    ],
    outputsData: [outputData],
  });

  console.log("Capsule transaction before funding:", tx);
  console.log("Using Capsule Type Script:", capsuleType);
  console.log("Using Capsule CellDeps:", cellDeps);
  console.log("Capsule output data:", outputData);

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  console.log("Capsule transaction after funding and fee:", tx);

  const txHash = await signer.sendTransaction(tx);

  console.log("Capsule mint transaction hash:", txHash);

  return {
    txHash,
    outPoint: {
      txHash,
      index: "0x0",
    },
    capsule: decodeCapsuleData(outputData),
    rawOutputData: outputData,
  };
}

export async function readCapsule(
  txHash: string,
  index = "0x0"
): Promise<DecodedCapsule | null> {
  const cell = await cccClient.getCellLive({ txHash, index }, true);

  if (cell == null) {
    return null;
  }

  return decodeCapsuleData(cell.outputData);
}

export async function readRawCell(txHash: string, index = "0x0") {
  return await cccClient.getCellLive({ txHash, index }, true);
}

export async function checkCapsuleStatus(
  txHash: string,
  index = "0x0"
): Promise<CapsuleCellStatus> {
  const cell = await cccClient.getCellLive({ txHash, index }, true);
  return cell == null ? "dead-or-missing" : "live";
}