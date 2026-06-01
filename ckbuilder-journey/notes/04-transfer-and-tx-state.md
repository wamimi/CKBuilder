# Week 2 Notes — Transfer CKB and Query Transaction State

## Question I was investigating

The core question for this experiment was:

```txt
What actually happens between building a CKB transfer locally, broadcasting it, and confirming that it is committed on-chain?
```

In Week 1, I understood CKB conceptually:

```txt
old live Cells -> transaction verification -> new live Cells
```

In Week 2, I wanted to see that model in code and RPC output.

## Why this matters

When a transaction is sent, receiving a transaction hash does not automatically mean the transaction is committed.

The transaction lifecycle has separate stages:

```txt
local construction
-> broadcast / tx hash returned
-> query transaction state
-> confirm pending / proposed / committed status
```

This matters because `send_transaction` is asynchronous. A tx hash proves that a transaction object was submitted, but the chain state is only updated once the transaction is committed.

## Tooling used

- OffCKB local devnet
- CCC JavaScript/TypeScript SDK
- Local RPC proxy: `http://127.0.0.1:28114`
- JSON-RPC method: `get_transaction`
- `curl`
- `jq`

## Code instrumentation

I modified the transfer helper to log transaction structure at each stage.

The helper logged:

- transaction hash
- input count
- output count
- outputs data count
- cell deps count
- header deps count
- witness count
- inputs
- outputs
- outputs data
- cell deps
- witnesses

This helped me see the transaction evolve rather than treating CCC as a black box.

The important logging helper was:

```ts
function logTx(label: string, tx: ccc.Transaction) {
  logSection(label);

  console.log("Transaction hash:", tx.hash());

  console.log("Inputs count:", tx.inputs.length);
  console.log("Outputs count:", tx.outputs.length);
  console.log("Outputs data count:", tx.outputsData.length);
  console.log("Cell deps count:", tx.cellDeps.length);
  console.log("Header deps count:", tx.headerDeps.length);
  console.log("Witnesses count:", tx.witnesses.length);

  console.log("Inputs:", stringifyWithBigInt(tx.inputs));
  console.log("Outputs:", stringifyWithBigInt(tx.outputs));
  console.log("Outputs data:", stringifyWithBigInt(tx.outputsData));
  console.log("Cell deps:", stringifyWithBigInt(tx.cellDeps));
  console.log("Witnesses:", stringifyWithBigInt(tx.witnesses));
}
```

## Transfer details

Sender address:

```txt
ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqvwg2cen8extgq8s5puft8vf40px3f599cytcyd8
```

Receiver address:

```txt
ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew
```

Amount:

```txt
67 CKB
```

Amount in shannons:

```txt
6,700,000,000
```

## Transaction construction stages

### Stage 1: Initial construction

The transaction started with one output and no inputs.

```txt
Transaction hash: 0x8c2affddfa808f2173756a19bd348e0e5ef895ada67855868892a36635017a55
Inputs count: 0
Outputs count: 1
Cell deps count: 0
Witnesses count: 0
```

At this point, CCC had created the transaction intention, but no funding Cell had been selected yet.

### Stage 2: Output capacity set

After setting the output capacity to 67 CKB, the transaction hash changed:

```txt
Transaction hash: 0xd9df56fb9e462895180e1348d61a2181a25c7d8c25df676ce931d8101b2c7313
Output capacity: 6,700,000,000 shannons
```

This was an important observation:

```txt
Changing output capacity changed the transaction hash.
```

That helped me see the transaction hash as a commitment to transaction structure.

### Stage 3: Inputs completed

After `completeInputsByCapacity`, CCC selected one live Cell controlled by the signer:

```txt
Transaction hash: 0x3b6023b4437f837d122afb90c1676174a3de070744c8f746db6c49fc2bc09c0c
Inputs count: 1
Outputs count: 1
Witnesses count: 0
```

Input OutPoint:

```txt
tx_hash: 0x7b7d25523501b8cf5ddc41a1f4bd6d3d1abf2dcc6db2aa562bffd2735d7620ff
index: 1
```

Input capacity:

```txt
4,199,877,599,998,140 shannons
```

This made the Cell model concrete:

```txt
The transaction does not subtract from an account.
It consumes a specific previous output Cell.
```

### Stage 4: Fee completed

After `completeFeeBy`, CCC added the change output, cell dependency, and witness placeholder:

```txt
Transaction hash: 0x61921431e12086f92f015c5bf75d94dda46b6b4b64264c8b582c199143623657
Inputs count: 1
Outputs count: 2
Outputs data count: 2
Cell deps count: 1
Witnesses count: 1
```

Outputs:

```txt
Receiver output: 6,700,000,000 shannons = 67 CKB
Change output: 4,199,870,899,997,675 shannons = 41,998,708.99997675 CKB
```

Computed fee:

```txt
Input total:  4,199,877,599,998,140 shannons
Output total: 4,199,877,599,997,675 shannons
Fee:          465 shannons
```

The change output was locked back to the sender.

## Sent transaction

The transaction was broadcast and returned this transaction hash:

```txt
0x61921431e12086f92f015c5bf75d94dda46b6b4b64264c8b582c199143623657
```

At this stage, the important lesson is:

```txt
The tx hash is not the same thing as finality.
```

It was the value I needed in order to query the node and inspect the transaction state.

## Querying transaction state

I queried the local OffCKB devnet RPC proxy:

```sh
curl -s -X POST http://127.0.0.1:28114 \
  -H "Content-Type: application/json" \
  -d '{
    "id": 42,
    "jsonrpc": "2.0",
    "method": "get_transaction",
    "params": [
      "0x61921431e12086f92f015c5bf75d94dda46b6b4b64264c8b582c199143623657"
    ]
  }' | jq
```

The transaction came back as committed:

```txt
status: committed
block_number: 0x4c6e
block_hash: 0x3e48b2bf26fcd8849ed1e5545ad3741393d1f95f22f9a5752aeb95e02f4168ce
tx_index: 0x1
```

This confirmed that the transaction had moved beyond local construction and broadcast. It had been included in a block on my local devnet.

## What the committed transaction showed

The node returned the full transaction structure:

- `cell_deps`
- `header_deps`
- `inputs`
- `outputs`
- `outputs_data`
- `witnesses`
- `tx_status`

The queried hash matched the hash returned by the transfer:

```txt
0x61921431e12086f92f015c5bf75d94dda46b6b4b64264c8b582c199143623657
```

That closed the loop:

```txt
constructed transaction -> broadcast transaction -> committed transaction returned by RPC
```

## Input Cell

The committed transaction consumed one input Cell:

```txt
previous_output:
  tx_hash: 0x7b7d25523501b8cf5ddc41a1f4bd6d3d1abf2dcc6db2aa562bffd2735d7620ff
  index: 0x1
since: 0x0
```

This reinforced the OutPoint model:

```txt
input = reference to a specific previous output Cell
```

## Output Cells

The committed transaction created two output Cells:

```txt
Output 0 capacity: 0x18f59e300
Output 1 capacity: 0xeebc2a518cbeb
```

Decoded:

```txt
Output 0 = 6,700,000,000 shannons = 67 CKB
Output 1 = 4,199,870,899,997,675 shannons = 41,998,708.99997675 CKB
```

Output 0 was the receiver Cell. Output 1 was the sender change Cell.

## Ownership through Lock Script args

Receiver output lock args:

```txt
0x758d311c8483e0602dfad7b69d9053e3f917457d
```

Sender change output lock args:

```txt
0x8e42b1999f265a0078503c4acec4d5e134534297
```

This made ownership concrete:

```txt
The receiver owns the newly created Cell because the output is locked with the receiver's Lock Script args.
The sender receives change because the second output is locked back to the sender's Lock Script args.
```

## cell_deps

The transaction included one `cell_dep`:

```txt
dep_type: dep_group
tx_hash: 0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293
index: 0x0
```

This connected directly to my Week 1 study:

```txt
Script references code through code_hash/hash_type.
cell_deps make the referenced code available during verification.
```

The transaction has to bring its verification dependencies with it.

## witnesses

The committed transaction had one witness:

```txt
0x55000000100000005500000055000000410000000b8fc7b3a37a635ac6018ee201e819b37a8f91ac22b3170fe06c891c700091cd243fdb4bb3c3fc6f90b87671981c3cf4fbef86cfca8121243e81963ce77232b101
```

This was the unlocking evidence used by the default Lock Script.

This kept my witness distinction clear:

```txt
CKB witness = public transaction evidence readable by scripts
ZK witness = private off-chain input used to generate a proof
```

For a normal transfer, the CKB witness carries signature-related evidence. In a future ZK-style design, a CKB witness could carry proof bytes, but it should not carry raw private witness data.

## Main takeaway

This experiment closed the loop between transaction construction and on-chain verification.

My final mental model:

```txt
CCC builds the transaction.
CCC selects input Cells and creates change.
The transaction is broadcast and returns a tx hash.
The tx hash is queried with get_transaction.
The node returns the committed transaction structure and tx_status.
```

The strongest protocol lesson:

```txt
Transaction finality must be observed, not assumed.
```

The stronger debugging habit:

```txt
Do not only trust the UI or the returned tx hash.
Query the node and inspect the committed transaction structure.
```

## Required reflection questions

### Why can I have a tx hash before confirmation?

A transaction hash can exist before confirmation because the hash identifies the transaction object, not necessarily its final on-chain state.

When a transaction is broadcast, the node can return the transaction hash after accepting the transaction for processing. But the transaction still has to move through the network and eventually be included in a block.

So the hash means:

```txt
this is the transaction I submitted
```

It does not automatically mean:

```txt
this transaction is already committed
```

That is why `get_transaction` matters. It lets me check whether the transaction is pending, proposed, committed, rejected, or unknown.

### Why does the tx hash exclude witnesses?

The transaction hash is based on the raw transaction structure, while witnesses are handled separately. This design matters because witnesses often contain signatures, and signatures are created after the raw transaction structure has been prepared.

If the signature were part of the same hash being signed, there would be a circular dependency:

```txt
the transaction hash would need the signature
but the signature would need the transaction hash
```

So CKB separates the raw transaction from witness data. The raw transaction hash commits to the core transaction structure:

- `inputs`
- `outputs`
- `outputs_data`
- `cell_deps`
- `header_deps`
- `version`

Then the signing process uses that transaction hash together with witness data to produce the signature message.

This made me understand why witnesses are not "irrelevant" even though they are excluded from the raw transaction hash. They are still committed during signing through the signature hash process.

This connects well to the signing docs, because CKB's signing flow hashes the transaction hash, then hashes serialized witness data with length prefixes, then signs that final message. The signature is placed back into the witness.

## Open questions

- What exactly is signed when witnesses are involved?
- Why is the transaction hash based on the raw transaction rather than the final witness-filled transaction?
- How does the default secp256k1 Lock Script parse and verify the witness?
- How do input groups affect signing when multiple inputs share the same Lock Script?
- How should a ZK-style CKB application place proof bytes in witnesses while keeping private witness data off-chain?
