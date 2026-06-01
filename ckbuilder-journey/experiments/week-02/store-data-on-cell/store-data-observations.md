# Week 2 Store Data on Cell Observations

## Experiment

Write a custom message into a Cell's data field, retrieve the Cell by OutPoint, and manually decode the stored bytes.

## Custom Message

```txt
capsule-v0: zk-attestation-placeholder
```

## Transaction Hash

```txt
0x857ac1137643c2c9b7160474d765982898c5a5ed1e5b64178c1c0c468aa4b881
```

## OutPoint

```txt
tx_hash: 0x857ac1137643c2c9b7160474d765982898c5a5ed1e5b64178c1c0c468aa4b881
index: 0x0
```

## get_live_cell Result

```txt
status: live
```

## Stored Data

```txt
data.content:
0x63617073756c652d76303a207a6b2d6174746573746174696f6e2d706c616365686f6c646572

data.hash:
0x492c2b8a71d82ddff30aaaf59a5ff685266cce7307aec836027ec47bf23abac4
```

## Manual Decode

```sh
node decode-hex.js 0x63617073756c652d76303a207a6b2d6174746573746174696f6e2d706c616365686f6c646572
```

Output:

```txt
capsule-v0: zk-attestation-placeholder
```

## Cell Output

```txt
capacity: 0x24e160300 = 99 CKB
lock args: 0x8e42b1999f265a0078503c4acec4d5e134534297
type: null
```

## Main Lesson

```txt
Cell data is arbitrary bytes.
CKB stores the bytes and exposes a hash of the bytes.
Meaning comes from application interpretation or Type Script enforcement.
```

Because `type` was `null`, this Cell stores the message but does not enforce any protocol-level meaning for it.

## Protocol Interpretation

```txt
Data without a Type Script = stored information
Data with a Type Script = constrained protocol state
```

For a future ZK or attestation design, a Cell could store public proof-related state such as a commitment, nullifier, state root, proof reference, capsule identifier, or metadata hash.

But private witness data should remain off-chain. The on-chain Cell should carry only public state or verification material, while a Type Script enforces valid state transitions.

Possible mapping:

```txt
cell.data      = public commitment / attestation state / nullifier / state root
witness        = public verification evidence, possibly proof bytes
type script    = verifies that the state transition is valid
off-chain data = private witness used to generate the proof
```
