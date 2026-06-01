# Week 2 Simple Lock Observations

## Experiment

Build, deploy, fund, and attempt to unlock a custom `hash_lock` Lock Script on local OffCKB devnet.

## Build

```sh
pnpm build
```

Artifacts:

```txt
dist/hash-lock.js
dist/hash-lock.bc
```

## Deploy

```sh
pnpm run deploy --network devnet
```

Deployment transaction:

```txt
0xd0a2f822f1758da66a57cceb17788bf10b7ca623748b81e8e75ad60b39303ea4
```

Deployment artifacts:

```txt
deployment/devnet/hash-lock.bc/
deployment/scripts.json
```

## Frontend

```sh
cd frontend
pnpm i
pnpm run dev
```

URL:

```txt
http://localhost:3000
```

## Hash Lock

Preimage:

```txt
Hello World
```

Hash:

```txt
106911e4f83e790e1eb2f39bdff23c1db43ed5af9219f763e571389af21259ca
```

Hash-lock address:

```txt
ckt1qzkymvxscq5t5rtnmmy7uhn28sxf3lxle2y4gq4r9pwksr5kfh95vqgqqrxjvt9nnk0g8a372s26263rnqhmdtnehxf78nehrsf044ca6g63jqssdyg7f7p70y8pavhnn00ly0qaksldttujr8mk8et38zd0yyjeegzhwqfh
```

Lock Script:

```json
{
  "codeHash": "0xac4db0d0c028ba0d73dec9ee5e6a3c0c98fcdfca895402a3285d680e964dcb46",
  "hashType": "type",
  "args": "0x0000cd262cb39d9e83f63e5415a56a23982fb6ae79b993e3cf371c12fad71dd2351902106911e4f83e790e1eb2f39bdff23c1db43ed5af9219f763e571389af21259ca"
}
```

## Funding

Observed frontend balances:

```txt
300 CKB
600 CKB
```

## Blocker

Attempting to unlock with the correct preimage failed with:

```txt
TransactionFailedToResolve: Resolve failed Unknown(OutPoint(...))
```

Problem OutPoint:

```txt
tx_hash: 0x4309def4700f30d10cd1a08c74a1e84ddf49394036556350742a337f801570ff
index: 0x0
```

`get_live_cell` returned:

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

## Interpretation

The failure happened in the resolve phase, not the script verification phase.

```txt
Wrong preimage = script runs and rejects witness
Unknown OutPoint = node cannot find input Cell, so script does not run
```

## Next Debugging Steps

- inspect how the frontend collects live Cells for the hash-lock address
- check whether the frontend is caching stale OutPoints
- compare displayed balance source with selected spending Cell
- query live Cells for the hash-lock Lock Script directly
- reproduce from fresh devnet state
- use OffCKB debug once a valid transaction candidate exists
