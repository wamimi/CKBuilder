# Capsule Notes

Capsule Notes is a small CKB dApp built during Week 4 of my CKBuilder journey.

It demonstrates how to mint a note as a typed CKB Cell using a deployed Rust Type Script called `capsule-transition-guard`.

The goal is to show a key difference between CKB and Ethereum-style dApp development:

```txt
Ethereum frontend:
call a contract function

CKB frontend:
construct a transaction whose output Cell uses a deployed script
```

In this project, the frontend creates a transaction that mints a live Capsule Cell. The Cell uses:

```txt
lock: user account Lock Script
type: deployed capsule-transition-guard Type Script
data: encoded Capsule note
cellDep: deployed script Cell
```

## What This Demo Shows

Capsule Notes demonstrates:

```txt
frontend transaction construction
typed Cell creation
custom binary Cell data encoding
deployed Type Script usage
CellDep usage
OutPoint-based Cell reading
Lock Script vs Type Script separation
valid and invalid state-transition tests
```

The core lesson:

> A CKB frontend does not mutate contract storage. It proposes a Cell transition, and scripts verify whether that transition is valid.

## Capsule Cell Format

A valid Capsule Cell stores binary data in this format:

```txt
[0..10]   magic: CAPSULE_V1
[10..14]  version: u32 little-endian
[14..46]  capsule_id: 32 bytes
[46..]    note body bytes
```

Example decoded Capsule:

```txt
Magic: CAPSULE_V1
Version: 1
Capsule ID: 0x...
Body: State is not mutated. It is consumed and recreated as a new Cell.
```

## Week 4 Project Structure

The Week 4 experiment folder contains:

```txt
capsule-notes
template-retry
```

### `capsule-notes`

The frontend dApp.

It started from the Nervos Store Data on Cell example, then evolved into a typed Cell demo that attaches a custom Type Script to the output Cell.


### `template-retry`

The Rust script workspace.

This is where I generated, compiled, debugged, and deployed the practice scripts and the main `capsule-transition-guard` Type Script.

## Requirements

You need:

```txt
Node.js
npm
OffCKB
A running OffCKB devnet
The deployed capsule-transition-guard script info
```

This project uses local OffCKB devnet accounts. Do not use devnet private keys on mainnet.

## 1. Start OffCKB Devnet

In one terminal:

```bash
offckb node
```

Keep this terminal running.

OffCKB usually exposes:

```txt
CKB RPC:        http://127.0.0.1:8114
CKB RPC Proxy:  http://127.0.0.1:28114
```

## 2. Check Devnet Accounts

In another terminal:

```bash
offckb accounts
```

The app currently uses an OffCKB devnet account private key:

```txt
0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6
```

This is a local development key only.

## 3. Confirm Deployment Info

The frontend expects `deployment.ts` to contain the deployed `capsule-transition-guard` script info.

Current deployment:

```ts
export const CAPSULE_TRANSITION_GUARD = {
  codeHash:
    "0xdc518bd84b206230910343addafd49fd718a99d6b9b56f53ca112d37560f3734",
  hashType: "data2",
  cellDeps: [
    {
      outPoint: {
        txHash:
          "0x11f20dc0cf0266bf9cdcaff7472a4c41101829d21281a9ce66fad1d02c8a39cd",
        index: "0x0",
      },
      depType: "code",
    },
  ],
} as const;
```

If the script has been redeployed, update `deployment.ts` using the latest values from:

```bash
../template-retry/ckb-rust-script-fresh/deployment/scripts.json
```

## 4. Install Dependencies

From inside `capsule-notes`:

```bash
npm install
```

## 5. Run the Frontend

```bash
NETWORK=devnet npm start
```

The app should start at:

```txt
http://localhost:1234
```

## 6. Mint a Valid Capsule

In the browser:

1. Confirm the account address and balance are visible.
2. Confirm the Account Lock Script is displayed.
3. Confirm the deployed Capsule Type Script is displayed.
4. Confirm the Capsule CellDep is displayed.
5. Click:

```txt
Mint Valid Capsule
```

Expected result:

```txt
A transaction hash is returned.
The Capsule Cell is minted.
The app decodes the Capsule data.
```

You should see decoded data like:

```txt
Magic: CAPSULE_V1
Version: 1
Capsule ID: 0x...
Body: State is not mutated. It is consumed and recreated as a new Cell.
```

## 7. Read the Capsule by OutPoint

After minting, click:

```txt
Read Capsule by OutPoint
```

The app reads the Cell using:

```txt
txHash + output index
```

The output index is usually:

```txt
0x0
```

If the Cell does not appear immediately, wait a few seconds and click the read button again.

## 8. Test Invalid Capsule Rejection

Click:

```txt
Mint Invalid Capsule Test
```

This intentionally uses the wrong magic prefix:

```txt
BAD_MAGIC1
```

Expected result:

```txt
The transaction should fail.
```

This is important because it proves the deployed Type Script is actually being executed. If invalid Capsule data succeeds, the Type Script is not enforcing the expected rule.

## 9. Troubleshooting

### `TransactionFailedToResolve` / Unknown OutPoint

This usually means the frontend is referencing a script CellDep that the current devnet cannot find.

Fix:

1. Make sure `offckb node` is running.
2. Redeploy the script from the Rust workspace.
3. Copy the new `codeHash`, `txHash`, and `index` into `deployment.ts`.
4. Restart the frontend.

Redeploy from the script workspace:

```bash
cd ../template-retry/ckb-rust-script-fresh

offckb deploy \
  --network devnet \
  --target build/release/capsule-transition-guard \
  --output deployment
```

Then inspect:

```bash
cat deployment/scripts.json
```

### BigInt JSON Serialization

If React throws:

```txt
TypeError: Do not know how to serialize a BigInt
```

it means the raw Cell object contains BigInt values.

The frontend handles this with a safe JSON stringify helper that converts BigInt values to strings before rendering them.

### Cell Not Found Immediately After Minting

The transaction may need a few seconds to be committed.

Wait and click:

```txt
Read Capsule by OutPoint
```

again.

## What This Project Proves

This project proves that I can:

```txt
write a Rust CKB Type Script
compile it into a CKB-VM binary
deploy it to devnet
reference it through CellDeps
attach it as an output Type Script
encode custom Cell data
mint a typed Cell from a frontend
read the Cell back by OutPoint
decode the raw Cell data
test valid and invalid state transitions
```

The main takeaway:

> CKB dApps are built around explicit state transitions. The frontend proposes the transition; the Type Script verifies whether it is valid.
