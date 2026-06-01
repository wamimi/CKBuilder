# Week 2 Notes — Custom Lock Script: Hash Lock

**Focus:** Moving from existing scripts to custom Lock Script verification.

---

## Question I am investigating

The main question for this experiment was:

```txt
How does a custom Lock Script define its own spending condition?
```

The previous tutorials helped me understand Cell composition, data storage, xUDT token state, and Type Scripts. The `Build a Simple Lock` tutorial introduced a different kind of verification: instead of spending a Cell using the default `secp256k1_blake160_sighash_all` signature path, the Cell is protected by a custom hash-lock condition.

## Hash-lock mental model

The custom script used in this tutorial is a `hash_lock` script.

Its verification idea is:

```txt
script_args = expected hash
witness = supplied preimage
script code = verifier that hashes the witness preimage and compares it to script_args
return 0 = valid spend
return non-zero = invalid spend
```

This was my first practical example of a custom Lock Script where `script_args` carried the public verification condition and the witness was expected to carry the unlocking input.

## Build and deployment

Build command:

```sh
pnpm build
```

The build succeeded and produced:

```txt
dist/hash-lock.js
dist/hash-lock.bc
```

Deployment command:

```sh
pnpm run deploy --network devnet
```

Deployment succeeded with transaction hash:

```txt
0xd0a2f822f1758da66a57cceb17788bf10b7ca623748b81e8e75ad60b39303ea4
```

Deployment artifacts were generated under:

```txt
deployment/devnet/hash-lock.bc/
deployment/scripts.json
```

## Frontend

I then ran the frontend:

```sh
cd frontend
pnpm i
pnpm run dev
```

The frontend started successfully on:

```txt
http://localhost:3000
```

## Generated hash lock

Default preimage:

```txt
Hello World
```

Generated hash:

```txt
106911e4f83e790e1eb2f39bdff23c1db43ed5af9219f763e571389af21259ca
```

Generated hash-lock address:

```txt
ckt1qzkymvxscq5t5rtnmmy7uhn28sxf3lxle2y4gq4r9pwksr5kfh95vqgqqrxjvt9nnk0g8a372s26263rnqhmdtnehxf78nehrsf044ca6g63jqssdyg7f7p70y8pavhnn00ly0qaksldttujr8mk8et38zd0yyjeegzhwqfh
```

Current Lock Script:

```json
{
  "codeHash": "0xac4db0d0c028ba0d73dec9ee5e6a3c0c98fcdfca895402a3285d680e964dcb46",
  "hashType": "type",
  "args": "0x0000cd262cb39d9e83f63e5415a56a23982fb6ae79b993e3cf371c12fad71dd2351902106911e4f83e790e1eb2f39bdff23c1db43ed5af9219f763e571389af21259ca"
}
```

## Funding

I funded the hash-lock address with devnet CKB.

The frontend first showed:

```txt
Total capacity: 300 CKB
```

After another deposit, it showed:

```txt
Total capacity: 600 CKB
```

## Transfer blocker

When I attempted to transfer from the hash-lock address using the correct preimage:

```txt
Hello World
```

the transaction failed with:

```txt
TransactionFailedToResolve: Resolve failed Unknown(OutPoint(...))
```

I inspected the OutPoint from the error:

```txt
tx_hash:
0x4309def4700f30d10cd1a08c74a1e84ddf49394036556350742a337f801570ff

index:
0x0
```

Then I queried the Cell directly with `get_live_cell`.

Result:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "cell": null,
    "status": "unknown"
  },
  "id": 42
}
```

## What the blocker means

This clarified that the issue was not a wrong preimage.

If the preimage were wrong, the custom Lock Script would execute and reject the witness during script verification. In this case, the transaction failed earlier because the node could not resolve the referenced input Cell.

This gave me a clearer layered model of CKB transaction validation:

```txt
1. Resolve phase:
   Can the node find the input Cells and cell dependencies referenced by the transaction?

2. Script phase:
   Can the relevant Lock Scripts and Type Scripts execute successfully?

3. Commit phase:
   Can the valid transaction be accepted and committed on-chain?
```

The blocker happened in the resolve phase, before the hash-lock verifier could actually test the preimage.

This helped me separate two failure classes:

```txt
Wrong preimage:
The Cell is found, the script runs, but the witness fails verification.

Unknown OutPoint:
The Cell cannot be resolved, so the script does not even get to run.
```

## Recovery attempts

I attempted:

- refreshing the frontend
- clearing stale browser state
- restarting the frontend
- depositing again to the same generated hash-lock address

The frontend balance updated, but the transfer path still attempted to resolve an unknown OutPoint.

I am recording this as an unresolved blocker for next week.

## Blocker to investigate next week

The simple-lock frontend appears to be selecting or caching an OutPoint that the current OffCKB devnet node cannot resolve, even though the generated hash-lock address shows funded capacity.

Next steps:

- inspect how the frontend collects live Cells for the hash-lock address
- check whether the frontend is caching stale OutPoints
- compare the displayed balance source with the actual Cell selected for spending
- query live Cells for the hash-lock Lock Script directly
- try reproducing the unlock flow from a fresh devnet state
- use OffCKB debug once a valid transaction candidate is available

## Why this still mattered

Even though the unlock transaction did not complete, this experiment moved me closer to understanding custom verification logic on CKB.

The key idea is that a CKB Lock Script can act like a small verifier:

```txt
read public parameters from script_args
read unlocking data from the witness
perform computation
return 0 only if the spend is valid
```

## ZK / cryptography connection

The hash-lock is not private because the preimage is eventually revealed in the witness, but the structure is close to a proof-verifier pattern:

```txt
public condition: hash stored in script_args
private/unlocking input: preimage supplied in witness
verifier: custom Lock Script
result: spend allowed only if verification passes
```

A future ZK-oriented version would replace "reveal the preimage" with "prove knowledge of a valid secret or state transition without revealing the secret."

That makes this tutorial a useful conceptual bridge between basic CKB scripts and privacy-preserving state transitions.
