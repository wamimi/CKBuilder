import React, { useEffect, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import {
  CAPSULE_TRANSITION_GUARD,
  CapsuleMintError,
  CapsuleTransactionInspector,
  capacityOf,
  DecodedCapsule,
  generateAccountFromPrivateKey,
  getCapsuleCellDeps,
  getCapsuleTypeScript,
  mintCapsule,
  readCapsule,
  readRawCell,
  shannonToCKB,
  wait,
} from "./lib";
import { Script } from "@ckb-ccc/core";

declare global {
  interface Window {
    __CAPSULE_NOTES_ROOT__?: Root;
  }
}

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found");
}

const root = window.__CAPSULE_NOTES_ROOT__ ?? createRoot(container);
window.__CAPSULE_NOTES_ROOT__ = root;
root.render(<App />);

function safeJsonStringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, nestedValue) => {
      if (typeof nestedValue === "bigint") {
        return nestedValue.toString();
      }

      return nestedValue;
    },
    2
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d8dee4",
  borderRadius: 8,
  padding: 16,
  margin: "16px 0",
};

const mutedStyle: React.CSSProperties = {
  color: "#57606a",
  fontSize: 14,
};

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        background: "#f6f8fa",
        border: "1px solid #d8dee4",
        borderRadius: 6,
        maxHeight: 320,
        overflow: "auto",
        padding: 12,
        whiteSpace: "pre-wrap",
      }}
    >
      {safeJsonStringify(value)}
    </pre>
  );
}

function ProtocolChecks({
  inspector,
}: {
  inspector: CapsuleTransactionInspector;
}) {
  return (
    <ul>
      {inspector.localRuleChecks.map((check) => (
        <li key={check.label}>
          <strong>{check.ok ? "PASS" : "FAIL"}:</strong> {check.label}
          {(check.expected || check.actual || check.detail) && (
            <div style={mutedStyle}>
              {check.expected && <span>Expected: {check.expected}. </span>}
              {check.actual && <span>Actual: {check.actual}. </span>}
              {check.detail && <span>{check.detail}</span>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function SnapshotSummary({
  snapshot,
}: {
  snapshot: CapsuleTransactionInspector["beforeFunding"];
}) {
  return (
    <div style={sectionStyle}>
      <h4>{snapshot.label}</h4>
      <ul>
        <li>
          <strong>Transaction hash:</strong> {snapshot.hash}
        </li>
        <li>
          <strong>Inputs:</strong> {snapshot.inputsCount}
        </li>
        <li>
          <strong>Outputs:</strong> {snapshot.outputsCount}
        </li>
        <li>
          <strong>Outputs data:</strong> {snapshot.outputsDataCount}
        </li>
        <li>
          <strong>CellDeps:</strong> {snapshot.cellDepsCount}
        </li>
        <li>
          <strong>Witnesses:</strong> {snapshot.witnessesCount}
        </li>
        <li>
          <strong>Input capacity:</strong>{" "}
          {snapshot.capacitySummary.inputCKB} CKB
        </li>
        <li>
          <strong>Output capacity:</strong>{" "}
          {snapshot.capacitySummary.outputCKB} CKB
        </li>
        <li>
          <strong>Fee:</strong>{" "}
          {snapshot.capacitySummary.feeCKB ?? "not known yet"} CKB
        </li>
      </ul>

      <details>
        <summary>Raw snapshot JSON</summary>
        <JsonBlock value={snapshot} />
      </details>
    </div>
  );
}

function TransactionInspector({
  title,
  inspector,
}: {
  title: string;
  inspector: CapsuleTransactionInspector | null;
}) {
  if (!inspector) {
    return (
      <div style={sectionStyle}>
        <h3>{title}</h3>
        <p style={mutedStyle}>
          No transaction has been inspected yet. Mint a valid Capsule or run the
          invalid rejection test to populate this section.
        </p>
      </div>
    );
  }

  return (
    <div style={sectionStyle}>
      <h3>{title}</h3>

      <ul>
        <li>
          <strong>Mode:</strong> {inspector.mode}
        </li>
        <li>
          <strong>Tx hash:</strong> {inspector.txHash ?? "not broadcast"}
        </li>
        <li>
          <strong>OutPoint:</strong>{" "}
          {inspector.outPoint
            ? `${inspector.outPoint.txHash}:${inspector.outPoint.index}`
            : "not created"}
        </li>
        <li>
          <strong>Live Cell status:</strong>{" "}
          {inspector.liveCellStatus ?? "unknown"}
        </li>
        <li>
          <strong>Output data bytes:</strong> {inspector.outputDataBytes}
        </li>
      </ul>

      {inspector.rejection && (
        <>
          <h4>Rejection</h4>
          <pre style={{ whiteSpace: "pre-wrap", color: "crimson" }}>
            {inspector.rejection}
          </pre>
        </>
      )}

      <h4>Local Protocol Checks</h4>
      <ProtocolChecks inspector={inspector} />

      <h4>Cell Flow</h4>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {[
          "Input Cells",
          "  funding Cells selected by CCC",
          "        |",
          "        v",
          "Output Cells",
          "  [0] Capsule Cell: lock = account lock, type = capsule-transition-guard",
          "  [1] Change Cell: lock = account lock, type = null",
        ].join("\n")}
      </pre>

      <SnapshotSummary snapshot={inspector.beforeFunding} />
      <SnapshotSummary snapshot={inspector.afterFunding} />

      <details>
        <summary>Account Lock Script</summary>
        <JsonBlock value={inspector.accountLockScript} />
      </details>

      <details>
        <summary>Capsule Type Script</summary>
        <JsonBlock value={inspector.capsuleTypeScript} />
      </details>

      <details>
        <summary>CellDeps</summary>
        <JsonBlock value={inspector.cellDeps} />
      </details>

      <details>
        <summary>Output data hex</summary>
        <JsonBlock value={inspector.outputData} />
      </details>

      <details>
        <summary>Decoded Capsule data</summary>
        <JsonBlock value={inspector.decodedCapsule} />
      </details>

      {inspector.rawLiveCell && (
        <details open>
          <summary>Raw live Cell from OutPoint lookup</summary>
          <JsonBlock value={inspector.rawLiveCell} />
        </details>
      )}
    </div>
  );
}

export function App() {
  const [privKey, setPrivKey] = useState(
    "0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6"
  );

  const [fromAddr, setFromAddr] = useState("");
  const [fromLock, setFromLock] = useState<Script>();
  const [balance, setBalance] = useState("0");

  const [body, setBody] = useState(
    "State is not mutated. It is consumed and recreated as a new Cell."
  );

  const [txHash, setTxHash] = useState("");
  const [outPointIndex, setOutPointIndex] = useState("0x0");

  const [capsule, setCapsule] = useState<DecodedCapsule | null>(null);
  const [status, setStatus] = useState<"live" | "dead-or-missing" | "unknown">(
    "unknown"
  );

  const [inspector, setInspector] =
    useState<CapsuleTransactionInspector | null>(null);
  const [invalidInspector, setInvalidInspector] =
    useState<CapsuleTransactionInspector | null>(null);

  const [rawCell, setRawCell] = useState<any>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [lastAction, setLastAction] = useState("");
  const [lastError, setLastError] = useState("");

  useEffect(() => {
    const updateFromInfo = async () => {
      try {
        const { lockScript, address } = await generateAccountFromPrivateKey(
          privKey
        );

        const capacity = await capacityOf(address);

        setFromAddr(address);
        setFromLock(lockScript);
        setBalance(shannonToCKB(capacity).toString());
      } catch (err) {
        console.error(err);
        setLastError(String(err));
      }
    };

    if (privKey) {
      updateFromInfo();
    }
  }, [privKey]);

  const onInputPrivKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const priv = e.target.value;
    const privateKeyRegex = /^0x[0-9a-fA-F]{64}$/;

    if (privateKeyRegex.test(priv)) {
      setPrivKey(priv);
      setLastError("");
    } else {
      alert(
        "Invalid private key: must start with 0x and be 32 bytes long. Use a valid private key from the OffCKB accounts list."
      );
    }
  };

  const readAndDisplayCapsule = async (targetTxHash: string, targetIndex: string) => {
    const raw = await readRawCell(targetTxHash, targetIndex);

    setRawCell(raw);
    setInspector((previous) =>
      previous
        ? {
            ...previous,
            liveCellStatus: raw ? "live" : "dead-or-missing",
            rawLiveCell: raw,
          }
        : previous
    );

    if (!raw) {
      setStatus("dead-or-missing");
      setCapsule(null);
      return null;
    }

    setStatus("live");

    const decoded = await readCapsule(targetTxHash, targetIndex);

    if (decoded) {
      setCapsule(decoded);
    } else {
      setCapsule(null);
    }

    return decoded;
  };

  const onMintCapsule = async () => {
    setIsWorking(true);
    setLastError("");
    setRawCell(null);
    setCapsule(null);
    setStatus("unknown");
    setLastAction("Minting valid Capsule...");
    setInspector(null);

    try {
      const result = await mintCapsule(privKey, body);

      setTxHash(result.txHash);
      setOutPointIndex(result.outPoint.index);
      setCapsule(result.capsule);
      setInspector(result.inspector);

      setLastAction(
        `Valid Capsule transaction sent: ${result.txHash}. Waiting for Cell to become readable...`
      );

      let decoded: DecodedCapsule | null = null;

      for (let attempt = 1; attempt <= 6; attempt++) {
        await wait(2);

        setLastAction(
          `Valid Capsule transaction sent: ${result.txHash}. Reading attempt ${attempt}/6...`
        );

        decoded = await readAndDisplayCapsule(
          result.outPoint.txHash,
          result.outPoint.index
        );

        if (decoded) {
          setLastAction(
            `Capsule minted and read successfully at ${result.outPoint.txHash}:${result.outPoint.index}`
          );
          break;
        }
      }

      if (!decoded) {
        setLastAction(
          `Capsule transaction was sent, but the Cell was not readable yet. Try clicking "Read Capsule by OutPoint" again in a few seconds. Tx: ${result.txHash}`
        );
      }

      alert(`Capsule minted!\nTx hash: ${result.txHash}`);
    } catch (err) {
      console.error(err);
      setLastError(String(err));
      alert(`Mint failed: ${String(err)}`);
    } finally {
      setIsWorking(false);
    }
  };

  const onMintInvalidCapsule = async () => {
    setIsWorking(true);
    setLastError("");
    setLastAction(
      "Trying invalid Capsule mint. This should fail if the deployed Type Script is executing..."
    );
    setInvalidInspector(null);

    try {
      const result = await mintCapsule(privKey, body, { useBadMagic: true });

      setTxHash(result.txHash);
      setOutPointIndex(result.outPoint.index);

      alert(
        "Unexpected: invalid Capsule transaction succeeded. Check your Type Script logic."
      );
    } catch (err) {
      console.error(err);
      const mintError = err as CapsuleMintError;

      if (mintError.inspector) {
        setInvalidInspector(mintError.inspector);
      }

      setLastError(String(err));
      alert(
        "Good: invalid Capsule was rejected. This proves the deployed Type Script is being executed."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const onReadCapsule = async () => {
    if (!txHash) {
      alert("No tx hash available yet");
      return;
    }

    setIsWorking(true);
    setLastError("");
    setLastAction(`Reading Capsule Cell at ${txHash}:${outPointIndex}...`);

    try {
      const decoded = await readAndDisplayCapsule(txHash, outPointIndex);

      if (!decoded) {
        alert("Capsule Cell not found. It may not be committed yet.");
        return;
      }

      setLastAction(`Capsule read successfully at ${txHash}:${outPointIndex}`);
    } catch (err) {
      console.error(err);
      setLastError(String(err));
      alert(`Read failed: ${String(err)}`);
    } finally {
      setIsWorking(false);
    }
  };

  const enabled =
    !isWorking && +balance > 0 && body.trim().length > 0 && body.length <= 512;

  const enabledRead = !isWorking && txHash.length > 0;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1>Capsule Notes</h1>

      <p>
        This app mints a note as a typed CKB Cell using the deployed{" "}
        <code>capsule-transition-guard</code> Type Script.
      </p>

      <hr />

      <h2>Account</h2>

      <label htmlFor="private-key">Private Key:</label>
      <br />
      <input
        id="private-key"
        type="text"
        value={privKey}
        onChange={onInputPrivKey}
        style={{ width: "100%" }}
      />

      <ul>
        <li>
          <strong>CKB Address:</strong> {fromAddr}
        </li>

        <li>
          <strong>Total capacity:</strong> {balance} CKB
        </li>

        <li>
          <strong>Current Account Lock Script:</strong>
          <pre>{safeJsonStringify(fromLock)}</pre>
        </li>

        <li>
          <strong>Deployed Capsule Type Script:</strong>
          <pre>{safeJsonStringify(getCapsuleTypeScript())}</pre>
        </li>

        <li>
          <strong>Capsule CellDeps used in tx:</strong>
          <pre>{safeJsonStringify(getCapsuleCellDeps())}</pre>
        </li>

        <li>
          <strong>Raw Deployment Constant:</strong>
          <pre>{safeJsonStringify(CAPSULE_TRANSITION_GUARD)}</pre>
        </li>
      </ul>

      <hr />

      <h2>Mint Capsule</h2>

      <label htmlFor="capsule-body">Capsule body:</label>
      <br />
      <textarea
        id="capsule-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        style={{ width: "100%" }}
      />

      <p>
        <small>
          Body length: {body.length}/512 chars. Tx fee estimate: 0.001 CKB.
        </small>
      </p>

      <button disabled={!enabled} onClick={onMintCapsule}>
        {isWorking ? "Working..." : "Mint Valid Capsule"}
      </button>

      {"  "}

      <button disabled={!enabled} onClick={onMintInvalidCapsule}>
        Mint Invalid Capsule Test
      </button>

      <p>
        <small>
          The invalid test intentionally uses the wrong magic prefix. It should
          fail if the deployed Type Script is actually being executed.
        </small>
      </p>

      <hr />

      <h2>Read Capsule</h2>

      <label htmlFor="tx-hash">Tx Hash:</label>
      <br />
      <input
        id="tx-hash"
        type="text"
        value={txHash}
        onChange={(e) => setTxHash(e.target.value)}
        style={{ width: "100%" }}
      />

      <br />
      <br />

      <label htmlFor="outpoint-index">Output Index:</label>
      <br />
      <input
        id="outpoint-index"
        type="text"
        value={outPointIndex}
        onChange={(e) => setOutPointIndex(e.target.value)}
      />

      <br />
      <br />

      <button disabled={!enabledRead} onClick={onReadCapsule}>
        Read Capsule by OutPoint
      </button>

      <hr />

      <h2>Capsule Result</h2>

      {txHash && (
        <ul>
          <li>
            <strong>Tx Hash:</strong> {txHash}
          </li>
          <li>
            <strong>OutPoint:</strong> {txHash}:{outPointIndex}
          </li>
          <li>
            <strong>Status:</strong> {status}
          </li>
        </ul>
      )}

      {capsule ? (
        <div>
          <h3>Decoded Capsule Data</h3>
          <ul>
            <li>
              <strong>Magic:</strong> {capsule.magic}
            </li>
            <li>
              <strong>Version:</strong> {capsule.version}
            </li>
            <li>
              <strong>Capsule ID:</strong> {capsule.capsuleId}
            </li>
            <li>
              <strong>Body:</strong> {capsule.body}
            </li>
          </ul>
        </div>
      ) : (
        <p>No capsule loaded yet.</p>
      )}

      {rawCell && (
        <div>
          <h3>Raw Live Cell</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {safeJsonStringify(rawCell)}
          </pre>
        </div>
      )}

      {lastAction && (
        <>
          <hr />
          <h2>Last Action</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{lastAction}</pre>
        </>
      )}

      {lastError && (
        <>
          <hr />
          <h2>Last Error / Debug Info</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "crimson" }}>
            {lastError}
          </pre>
        </>
      )}

      <hr />

      <h2>Capsule Transaction Inspector v0</h2>

      <p>
        The inspector captures the real CCC transaction shape before and after
        input selection and fee completion. It exposes the Lock Script, Type
        Script, CellDeps, output data, decoded Capsule bytes, capacity flow,
        OutPoint lookup, live/dead status, and the invalid-mint rejection path.
      </p>

      <TransactionInspector
        title="Valid Capsule Transaction"
        inspector={inspector}
      />

      <TransactionInspector
        title="Invalid Capsule Rejection"
        inspector={invalidInspector}
      />

      <hr />

      <h2>What this demonstrates</h2>

      <p>
        A valid Capsule mint is not just arbitrary data storage. The output Cell
        uses the deployed Rust script as its Type Script. The transaction only
        succeeds if the Cell data satisfies the script rule: it must start with{" "}
        <code>CAPSULE_V1</code>, use version <code>1</code>, include a 32-byte
        capsule ID, and contain a non-empty body.
      </p>

      <p>
        The account Lock Script controls ownership. The Capsule Type Script
        controls the validity of the Capsule state.
      </p>
    </div>
  );
}
