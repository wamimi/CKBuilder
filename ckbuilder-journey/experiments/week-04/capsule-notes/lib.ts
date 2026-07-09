import { ccc, Script } from "@ckb-ccc/core";
import {
  decodeCapsuleMolecule,
  encodeCapsuleMolecule,
} from "./capsule-molecule";
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
  inspector: CapsuleTransactionInspector;
};

export type CapsuleCellStatus = "live" | "dead-or-missing";

export type CapsuleProtocolCheck = {
  label: string;
  ok: boolean;
  expected?: string;
  actual?: string;
  detail?: string;
};

export type CapsuleCapacitySummary = {
  inputShannons: string;
  outputShannons: string;
  feeShannons: string | null;
  inputCKB: string;
  outputCKB: string;
  feeCKB: string | null;
};

export type CapsuleTransactionSnapshot = {
  label: string;
  hash: string;
  inputsCount: number;
  outputsCount: number;
  outputsDataCount: number;
  cellDepsCount: number;
  headerDepsCount: number;
  witnessesCount: number;
  inputs: unknown[];
  outputs: unknown[];
  outputsData: string[];
  cellDeps: unknown[];
  headerDeps: unknown[];
  witnesses: unknown[];
  capacitySummary: CapsuleCapacitySummary;
};

export type CapsuleTransactionInspector = {
  mode: "valid" | "invalid";
  accountLockScript: Script;
  capsuleTypeScript: Script;
  cellDeps: ReturnType<typeof getCapsuleCellDeps>;
  outputData: string;
  outputDataBytes: number;
  decodedCapsule: DecodedCapsule | null;
  localRuleChecks: CapsuleProtocolCheck[];
  beforeFunding: CapsuleTransactionSnapshot;
  afterFunding: CapsuleTransactionSnapshot;
  txHash?: string;
  outPoint?: CapsuleOutPoint;
  liveCellStatus?: CapsuleCellStatus | "unknown";
  rawLiveCell?: unknown;
  rejection?: string;
};

export type CapsuleMintError = Error & {
  inspector?: CapsuleTransactionInspector;
};

const MAGIC = "CAPSULE_V1";
const BAD_MAGIC = "BAD_MAGIC1";

const CAPSULE_ID_LEN = 32;

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

function shannonToCKBString(amount: bigint): string {
  const whole = amount / 100000000n;
  const fraction = amount % 100000000n;

  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
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

function randomCapsuleId(): Uint8Array {
  const id = new Uint8Array(CAPSULE_ID_LEN);
  crypto.getRandomValues(id);
  return id;
}

function outputDataByteLength(hex: string): number {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return clean.length / 2;
}

function capacityToBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  if (typeof value === "string" && value.length > 0) {
    return BigInt(value);
  }

  return 0n;
}

function sumInputCapacity(inputs: unknown[]): bigint {
  return inputs.reduce<bigint>((sum, input) => {
    const candidate = input as {
      cellOutput?: {
        capacity?: unknown;
      };
    };

    return sum + capacityToBigInt(candidate.cellOutput?.capacity);
  }, 0n);
}

function sumOutputCapacity(outputs: unknown[]): bigint {
  return outputs.reduce<bigint>((sum, output) => {
    const candidate = output as {
      capacity?: unknown;
    };

    return sum + capacityToBigInt(candidate.capacity);
  }, 0n);
}

function snapshotTransaction(
  label: string,
  tx: ccc.Transaction
): CapsuleTransactionSnapshot {
  const txView = tx as unknown as {
    hash: () => string;
    inputs: unknown[];
    outputs: unknown[];
    outputsData: string[];
    cellDeps: unknown[];
    headerDeps: unknown[];
    witnesses: unknown[];
  };

  const inputs = txView.inputs ?? [];
  const outputs = txView.outputs ?? [];
  const outputsData = txView.outputsData ?? [];
  const cellDeps = txView.cellDeps ?? [];
  const headerDeps = txView.headerDeps ?? [];
  const witnesses = txView.witnesses ?? [];

  const inputShannons = sumInputCapacity(inputs);
  const outputShannons = sumOutputCapacity(outputs);
  const feeShannons =
    inputShannons > 0n && inputShannons >= outputShannons
      ? inputShannons - outputShannons
      : null;

  return {
    label,
    hash: txView.hash(),
    inputsCount: inputs.length,
    outputsCount: outputs.length,
    outputsDataCount: outputsData.length,
    cellDepsCount: cellDeps.length,
    headerDepsCount: headerDeps.length,
    witnessesCount: witnesses.length,
    inputs,
    outputs,
    outputsData,
    cellDeps,
    headerDeps,
    witnesses,
    capacitySummary: {
      inputShannons: inputShannons.toString(),
      outputShannons: outputShannons.toString(),
      feeShannons: feeShannons?.toString() ?? null,
      inputCKB: shannonToCKBString(inputShannons),
      outputCKB: shannonToCKBString(outputShannons),
      feeCKB: feeShannons == null ? null : shannonToCKBString(feeShannons),
    },
  };
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
    outputData: cell.outputData,
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

  const capsuleId = params.capsuleId ?? randomCapsuleId();

  if (capsuleId.length !== CAPSULE_ID_LEN) {
    throw new Error("Capsule ID must be exactly 32 bytes");
  }

  return encodeCapsuleMolecule({
    magic: params.useBadMagic ? BAD_MAGIC : MAGIC,
    version: params.version,
    capsuleId: bytesToHex(capsuleId),
    body: params.body,
  });
}

export function decodeCapsuleData(hex: string): DecodedCapsule {
  return decodeCapsuleMolecule(hex);
}

export function inspectCapsuleData(hex: string): {
  decodedCapsule: DecodedCapsule | null;
  outputDataBytes: number;
  checks: CapsuleProtocolCheck[];
} {
  const outputDataBytes = outputDataByteLength(hex);
  const checks: CapsuleProtocolCheck[] = [
    {
      label: "Cell data is long enough to contain a Molecule CapsuleNote table",
      ok: outputDataBytes > 20,
      expected: "> 20 bytes",
      actual: `${outputDataBytes} bytes`,
    },
  ];

  try {
    const decodedCapsule = decodeCapsuleData(hex);
    const bodyBytes = new TextEncoder().encode(decodedCapsule.body).length;

    checks.push(
      {
        label: "Magic prefix is CAPSULE_V1",
        ok: decodedCapsule.magic === MAGIC,
        expected: MAGIC,
        actual: decodedCapsule.magic,
      },
      {
        label: "Version is 1",
        ok: decodedCapsule.version === 1,
        expected: "1",
        actual: decodedCapsule.version.toString(),
      },
      {
        label: "Capsule ID is 32 bytes",
        ok: outputDataByteLength(decodedCapsule.capsuleId) === CAPSULE_ID_LEN,
        expected: `${CAPSULE_ID_LEN} bytes`,
        actual: `${outputDataByteLength(decodedCapsule.capsuleId)} bytes`,
      },
      {
        label: "Body is non-empty",
        ok: bodyBytes > 0,
        expected: "> 0 bytes",
        actual: `${bodyBytes} bytes`,
      },
      {
        label: "Body fits the local 512-byte limit",
        ok: bodyBytes <= MAX_BODY_BYTES,
        expected: `<= ${MAX_BODY_BYTES} bytes`,
        actual: `${bodyBytes} bytes`,
      }
    );

    return {
      decodedCapsule,
      outputDataBytes,
      checks,
    };
  } catch (err) {
    checks.push({
      label: "Cell data decodes as a Capsule",
      ok: false,
      detail: String(err),
    });

    return {
      decodedCapsule: null,
      outputDataBytes,
      checks,
    };
  }
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

  const dataInspection = inspectCapsuleData(outputData);

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

  const beforeFunding = snapshotTransaction("Before completeInputsByCapacity", tx);

  console.log("Capsule transaction before funding:", tx);
  console.log("Using Capsule Type Script:", capsuleType);
  console.log("Using Capsule CellDeps:", cellDeps);
  console.log("Capsule output data:", outputData);

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  const afterFunding = snapshotTransaction("After completeInputsByCapacity + completeFeeBy", tx);

  console.log("Capsule transaction after funding and fee:", tx);

  const inspectorBase: CapsuleTransactionInspector = {
    mode: options?.useBadMagic ? "invalid" : "valid",
    accountLockScript: signerAddress.script,
    capsuleTypeScript: capsuleType,
    cellDeps,
    outputData,
    outputDataBytes: dataInspection.outputDataBytes,
    decodedCapsule: dataInspection.decodedCapsule,
    localRuleChecks: [
      {
        label: "Capsule output has a Type Script",
        ok: Boolean((tx.outputs[0] as { type?: unknown }).type),
      },
      {
        label: "Transaction includes the Capsule script CellDep",
        ok:
          cellDeps.length === 1 &&
          cellDeps[0].outPoint.txHash ===
            CAPSULE_TRANSITION_GUARD.cellDeps[0].outPoint.txHash &&
          cellDeps[0].outPoint.index ===
            CAPSULE_TRANSITION_GUARD.cellDeps[0].outPoint.index,
        expected: `${CAPSULE_TRANSITION_GUARD.cellDeps[0].outPoint.txHash}:${CAPSULE_TRANSITION_GUARD.cellDeps[0].outPoint.index}`,
        actual: `${cellDeps[0]?.outPoint.txHash}:${cellDeps[0]?.outPoint.index}`,
      },
      ...dataInspection.checks,
    ],
    beforeFunding,
    afterFunding,
    liveCellStatus: "unknown",
  };

  let txHash: string;

  try {
    txHash = await signer.sendTransaction(tx);
  } catch (err) {
    const failure = err instanceof Error ? err : new Error(String(err));
    const mintError = failure as CapsuleMintError;
    mintError.inspector = {
      ...inspectorBase,
      rejection: String(err),
    };
    throw mintError;
  }

  console.log("Capsule mint transaction hash:", txHash);

  return {
    txHash,
    outPoint: {
      txHash,
      index: "0x0",
    },
    capsule: dataInspection.decodedCapsule ?? decodeCapsuleData(outputData),
    rawOutputData: outputData,
    inspector: {
      ...inspectorBase,
      txHash,
      outPoint: {
        txHash,
        index: "0x0",
      },
    },
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
