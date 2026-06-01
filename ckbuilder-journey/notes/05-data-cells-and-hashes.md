# Week 2 Notes — Data Cells and Hashes

## Question I am investigating

The question for this experiment was:

```txt
How does CKB move from Cell as value to Cell as state?
```

The simple transfer experiment showed capacity moving through input and output Cells. This experiment showed that a Cell can also store arbitrary bytes in its data field.

## What I ran

I ran the Store Data on Cell tutorial on local OffCKB devnet.

The app was running at:

```txt
http://localhost:1234
```

The local OffCKB RPC proxy was:

```txt
http://127.0.0.1:28114
```

I used a custom message instead of a generic tutorial string:

```txt
capsule-v0: zk-attestation-placeholder
```

I chose this message because I wanted the exercise to connect to my longer-term interest in attestations, ZK, and proof-related state. It is not a real ZK design yet, but it let me treat the tutorial as a small builder notebook rather than only copying the default example.

## Transaction hash

The transaction hash for the data Cell was:

```txt
0x857ac1137643c2c9b7160474d765982898c5a5ed1e5b64178c1c0c468aa4b881
```

## What an OutPoint means

To retrieve the stored message, I queried the Cell using:

```txt
tx_hash + output index
```

This pair is the OutPoint.

For this experiment:

```txt
tx_hash: 0x857ac1137643c2c9b7160474d765982898c5a5ed1e5b64178c1c0c468aa4b881
index: 0x0
```

My mental model:

```txt
OutPoint = exact pointer to a specific output Cell created by a previous transaction
```

## get_live_cell query

I queried the output Cell directly:

```sh
curl -s -X POST http://127.0.0.1:28114 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 42,
    "jsonrpc": "2.0",
    "method": "get_live_cell",
    "params": [
      {
        "tx_hash": "0x857ac1137643c2c9b7160474d765982898c5a5ed1e5b64178c1c0c468aa4b881",
        "index": "0x0"
      },
      true
    ]
  }' | jq
```

The node returned:

```txt
status: live
```

That means the output Cell still exists and has not been consumed yet.

## Retrieved Cell data

The returned `data.content` was:

```txt
0x63617073756c652d76303a207a6b2d6174746573746174696f6e2d706c616365686f6c646572
```

The returned `data.hash` was:

```txt
0x492c2b8a71d82ddff30aaaf59a5ff685266cce7307aec836027ec47bf23abac4
```

This gave me two levels:

```txt
data.content = actual stored state bytes
data.hash    = hash / fingerprint of those bytes
```

That was a useful cryptographic observation. The chain stores the bytes, but also exposes a hash of those bytes for efficient identification and verification.

## Manual hex decode

I manually decoded the Cell data:

```sh
node -e "console.log(Buffer.from('63617073756c652d76303a207a6b2d6174746573746174696f6e2d706c616365686f6c646572', 'hex').toString('utf8'))"
```

Decoded output:

```txt
capsule-v0: zk-attestation-placeholder
```

This proved the full path:

```txt
custom message -> hex bytes -> Cell data -> OutPoint retrieval -> manual decode
```

## Cell output

The Cell output had capacity:

```txt
0x24e160300
```

Decoded:

```txt
9,900,000,000 shannons = 99 CKB
```

This capacity is not only money. It is also the storage budget for the Cell.

The Cell lock args were:

```txt
0x8e42b1999f265a0078503c4acec4d5e134534297
```

That means this data Cell is locked to my account.

The Cell type was:

```txt
type: null
```

This is one of the most important observations from the experiment.

The Cell stores data, but there is no Type Script enforcing what that data means or how it can change. My message is valid as arbitrary stored bytes, but CKB itself does not know that it is a "capsule," "attestation," or "ZK placeholder."

That meaning currently comes from my application convention.

## What outputData means

`outputs_data` is the data stored in each output Cell.

My current model:

```txt
outputs[i]      = Cell shell: capacity, lock, optional type
outputs_data[i] = bytes stored inside that Cell
```

In this experiment:

```txt
outputs[0]      = the data Cell
outputs_data[0] = encoded message bytes
```

## What makes Cell data meaningful?

Cell data is arbitrary bytes. CKB can store the bytes and expose their hash, but the protocol does not automatically know what those bytes mean.

This made me ask a deeper question:

> If Cell data is arbitrary bytes, what actually makes those bytes meaningful?

My answer is that Cell data becomes meaningful through interpretation and constraint.

A frontend can interpret the bytes. An indexer can classify them. A community can define a convention around them. But for the meaning to become protocol-enforced, a Type Script must define the rules for how that data can be created, consumed, or transformed.

The bytes can be interpreted by:

- an application frontend
- an off-chain convention or indexer
- an on-chain Type Script that enforces rules around how the data may be created or transformed

My current mental model:

```txt
Cell data = bytes
Application convention = interpretation
Type Script = enforceable state transition rules
```

Without a Type Script:

```txt
data = bytes
```

With a Type Script:

```txt
data = protocol state with enforced transition rules
```

That distinction feels important:

```txt
Data without a Type Script = stored information
Data with a Type Script = constrained protocol state
```

## Difference between Cell data, script hash, and code hash

### Cell data

Cell data is the arbitrary bytes stored inside a Cell. It can represent text, a token amount, a commitment, a state root, metadata, or anything else, but CKB does not automatically know what it means.

A data hash identifies those exact stored bytes.

### Script hash

A script hash is the hash of a serialized Script structure. It identifies a specific script configuration:

```txt
code_hash + hash_type + args
```

The script hash is calculated as:

```txt
ckbhash(molecule_encode(script))
```

This means the same code can produce different script hashes when used with different args.

This is especially important for Lock Scripts. Alice and Bob may use the same `secp256k1_blake160` lock code, but their script hashes differ because their args differ.

### Code hash

A code hash is the hash of the actual executable code bytes stored in a code Cell. It identifies the program that can be loaded and executed by CKB-VM.

The code hash is calculated as:

```txt
ckbhash(data)
```

where `data` is the executable code binary stored in a code Cell.

The important distinction:

```txt
Cell data   = state/data bytes
Script hash = identity of a script configuration
Code hash   = identity of executable code
```

My simple model:

```txt
code hash   = behavior/program identity
script hash = configured behavior identity
data hash   = stored bytes identity
```

CKB uses `ckbhash`, its configured BLAKE2b hash, with a 32-byte output digest and the personalization string `ckb-default-hash`.

## ZK / attestation reflection

Using `capsule-v0: zk-attestation-placeholder` made me think about how CKB could represent public proof-related state.

A future attestation Cell could store:

- a public commitment
- a nullifier
- a state root
- a proof reference
- a capsule identifier
- a metadata hash

However, this experiment also showed the limitation: storing bytes is not enough.

If the Cell has no Type Script, the bytes are only meaningful by convention. For a real ZK/attestation design, a Type Script would need to enforce what counts as a valid transition from one commitment/state to another, while the private ZK witness remains off-chain.

A possible future model could be:

```txt
cell.data      = public commitment / attestation state / nullifier / state root
witness        = public verification evidence, possibly proof bytes
type script    = verifies that the state transition is valid
off-chain data = private witness used to generate the proof
```

My current takeaway:

> CKB lets me store arbitrary bytes, but protocol meaning comes from constraints.

For ZK-style apps, Cell data could hold commitments or public proof-related state, while Type Scripts enforce whether transitions between those states are valid.

The main takeaway from this experiment is that CKB gives developers a very flexible state container, but that flexibility also creates responsibility. If I store arbitrary bytes, I must also decide who interprets them, who validates them, and what prevents invalid state transitions.

That is where Type Scripts become important.

This experiment helped me move from "CKB can store data" to a more precise understanding:

> CKB Cells can hold arbitrary state bytes, but protocol meaning comes from constraints. A Cell becomes part of an application-level state machine when its data is interpreted and its transitions are enforced.