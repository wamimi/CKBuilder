# CKBuilder Weekly Report — Week 2

**Name:** Nelly Njeri  
**Week Ending:** 31 May 2026  


## 1. Weekly Thesis

Week 2 was about making the CKB Cell model visible in code.

In Week 1, I built the theory foundation: Cells, capacity, scripts, witnesses, `cell_deps`, transaction anatomy, CKB-VM, OffCKB, and CCC. This week I moved from reading the model to testing it through four practical layers:

```txt
CKB transfer -> data Cell -> typed token Cell -> custom Lock Script
```

The question guiding the week was:

> How does CKB move from value transfer, to arbitrary state storage, to typed state with validation rules, to custom verification logic?

I tried not to treat the tutorials as black boxes. For each experiment, I inspected what was happening structurally: which Cells were consumed, which Cells were created, what data was stored, what script controlled meaning, what evidence was supplied, and where transaction validation failed when something broke.

The strongest shift this week was that CKB stopped feeling like "a blockchain with unusual accounts" and started feeling like a verification system for explicit state transitions.


## 2. Work Completed

This week I completed:

- A 67 CKB transfer on local OffCKB devnet.
- A `get_transaction` query proving the transfer was committed.
- A Store Data on Cell experiment using a custom message.
- A `get_live_cell` query proving the data Cell was live and contained the expected bytes.
- A script-hash/code-hash study to clarify what different hashes identify.
- An xUDT issue and transfer experiment showing Type Scripts in practice.
- A custom `hash_lock` build/deploy experiment.
- A debugging investigation of a simple-lock unlock blocker.

The main artifacts are:

```txt
notes/04-transfer-and-tx-state.md
notes/05-data-cells-and-hashes.md
notes/06-signing-and-witness-anatomy.md
notes/07-xudt-and-type-scripts.md
notes/08-custom-lock-hash-lock.md
experiments/week-02/simple-transfer/
experiments/week-02/store-data-on-cell/
experiments/week-02/xudt/
experiments/week-02/simple-lock/
screenshots/week-02
```

The detailed command logs and full observations are in the notes and experiment folders.


## 3. Transfer Lab: Transaction Lifecycle

The first experiment was a simple 67 CKB transfer on local OffCKB devnet.

Final transaction hash:

```txt
0x61921431e12086f92f015c5bf75d94dda46b6b4b64264c8b582c199143623657
```

I instrumented the CCC transfer helper so I could observe the transaction at each construction stage. The transaction hash changed as the transaction structure changed:

```txt
Initial construction:        0x8c2affddfa808f2173756a19bd348e0e5ef895ada67855868892a36635017a55
After setting capacity:      0xd9df56fb9e462895180e1348d61a2181a25c7d8c25df676ce931d8101b2c7313
After input selection:       0x3b6023b4437f837d122afb90c1676174a3de070744c8f746db6c49fc2bc09c0c
After fee/change completed:  0x61921431e12086f92f015c5bf75d94dda46b6b4b64264c8b582c199143623657
```

This made the transaction hash feel less like a random identifier and more like a commitment to a specific transaction structure.

After `completeInputsByCapacity`, CCC selected a live Cell controlled by the sender:

```txt
previous tx_hash: 0x7b7d25523501b8cf5ddc41a1f4bd6d3d1abf2dcc6db2aa562bffd2735d7620ff
index: 1
```

After fee completion, the final accounting was:

```txt
Receiver output: 67 CKB
Sender change: 41,998,708.99997675 CKB
Fee: 465 shannons
```

The practical lesson was:

```txt
CKB does not subtract from an account.
It consumes specific previous output Cells and creates new output Cells.
```

### Transaction State Query

After broadcasting, I did not stop at the returned transaction hash. I queried the node with `get_transaction`.

The transaction status was:

```txt
status: committed
block_number: 0x4c6e
block_hash: 0x3e48b2bf26fcd8849ed1e5545ad3741393d1f95f22f9a5752aeb95e02f4168ce
tx_index: 0x1
```

This gave me a much clearer transaction lifecycle model:

```txt
1. Transaction composition: the transaction is built locally.
2. Transaction broadcast: the node returns a transaction hash.
3. Transaction commitment: get_transaction confirms inclusion in a block.
```

The important distinction is that a transaction hash can exist before confirmation. The hash identifies the transaction object, not necessarily its final on-chain state. A tx hash means "this is the transaction I submitted." It does not automatically mean "this transaction is committed."

This also connected to signing. The transaction hash is based on the raw transaction structure, while witnesses are handled separately. If a signature were part of the exact same hash being signed, there would be a circular dependency: the hash would need the signature, but the signature would need the hash. CKB avoids this by separating the raw transaction hash from witness data, then committing witness data during the signature-hash process.

That was the first major protocol lesson of the week:

> Finality must be observed, not assumed.


## 4. Data Cell Lab: From Bytes to State

The second experiment was the Store Data on Cell tutorial.

I used a custom message:

```txt
capsule-v0: zk-attestation-placeholder
```

Transaction hash:

```txt
0x857ac1137643c2c9b7160474d765982898c5a5ed1e5b64178c1c0c468aa4b881
```

I retrieved the created Cell by OutPoint:

```txt
tx_hash: 0x857ac1137643c2c9b7160474d765982898c5a5ed1e5b64178c1c0c468aa4b881
index: 0x0
```

The node returned:

```txt
status: live
```

The Cell data was:

```txt
data.content:
0x63617073756c652d76303a207a6b2d6174746573746174696f6e2d706c616365686f6c646572

data.hash:
0x492c2b8a71d82ddff30aaaf59a5ff685266cce7307aec836027ec47bf23abac4
```

Manually decoding `data.content` reconstructed the original message:

```txt
capsule-v0: zk-attestation-placeholder
```

That closed the loop:

```txt
custom message -> encoded bytes -> Cell data -> OutPoint retrieval -> manual decode
```

The Cell had:

```txt
capacity: 0x24e160300 = 99 CKB
type: null
```

The `type: null` field was the most important part. It means the Cell stores bytes, but no Type Script enforces what those bytes mean or how they may change.

My current model is:

```txt
Cell data = bytes
Application convention = interpretation
Type Script = enforceable state transition rules
```

So the message is meaningful to me and to the tutorial app, but not inherently meaningful to the CKB protocol. Without a Type Script, it is stored information. With a Type Script, it can become constrained protocol state.

This experiment also made the hash vocabulary clearer:

```txt
data hash   = fingerprint of stored bytes
code hash   = fingerprint of executable code bytes
script hash = fingerprint of a configured Script structure
```

A code hash identifies the executable program. A script hash identifies a configured instance of that program:

```txt
code_hash + hash_type + args
```

This matters because Alice and Bob can use the same `secp256k1_blake160` lock code, but their script hashes differ because their `args` differ. Same behavior, different configured identity.

This distinction felt important for future protocol work:

```txt
Code hash asks: Which executable program is this?
Script hash asks: Which configured instance of this program is this?
Data hash asks: Which exact bytes are stored here?
```


## 5. xUDT Lab: Typed Token State

The third experiment was the `Create a Fungible Token` tutorial.

This was the bridge from arbitrary bytes to typed state. In the data-cell experiment, my Cell had `type: null`. In the xUDT experiment, Cell data represented a token amount because a Type Script constrained its meaning.

I issued an xUDT with amount:

```txt
42
```

Issue transaction:

```txt
0x0f7441d2d1ca474ab4ac21b07727e6f93718d1b1c6f437c457972eeda9e287d3
```

xUDT args:

```txt
0x7de82d61a7eb2ec82b0dc653e558ba120efcbfbb44dac87c12972d05bf25065300000000
```

My current framing is:

```txt
xUDT Type Script + xUDT args = token class identity
```

The issued token Cell had:

```txt
Capacity: 146 CKB
Token amount: 42
outputsData: 0x2a000000000000000000000000000000
```

The Type Script was:

```json
{
  "codeHash": "0x1a1e4fef34f5982906f745b048fe7b1089647e82346074e0f32c2ece26cf6b1e",
  "hashType": "type",
  "args": "0x7de82d61a7eb2ec82b0dc653e558ba120efcbfbb44dac87c12972d05bf25065300000000"
}
```

This made the division of responsibility concrete:

```txt
Lock Script = who controls the token Cell
Type Script = what token class/rules the Cell belongs to
Cell data = how many tokens the Cell contains
```

The sharpest comparison for me was:

```txt
Ethereum ERC-20:
balances[address] = amount

CKB xUDT:
Cell.lock = who controls this token Cell
Cell.type = which token class this Cell belongs to
Cell.data = how many tokens this Cell contains
```

During transfer, I initially hit an `Invalid bytes` error because there was a leading space before the xUDT args. Removing the whitespace fixed it. Small bug, useful lesson: when working close to serialized protocol data, formatting mistakes become byte-level parsing failures.

The xUDT transfer made token accounting feel Cell-native. I observed:

```txt
Input UDT balance: 54
Output UDT balance: 5
Token change balance: 49
```

The receiver Lock Script args were different from the sender's:

```txt
sender:   0x8e42b1999f265a0078503c4acec4d5e134534297
receiver: 0x9665e6bc1966ec2bfcca4f11782d2b906f38438f
```

This mattered because token transfer is not only about amounts. The Type Script preserves token class and validates token accounting, but the Lock Script determines ownership of each output Cell.

The main xUDT lesson:

```txt
Cell data by itself is storage.
Cell data with a Type Script becomes protocol state.
```


## 6. Custom Lock Lab: Hash Lock and Debugging

The final practical experiment moved from using existing scripts into building and deploying a custom Lock Script.

The tutorial's `hash_lock` script uses this verification pattern:

```txt
script_args = expected hash
witness = supplied preimage
script code = hashes the preimage and compares it to script_args
return 0 = valid spend
return non-zero = invalid spend
```

I built and deployed the contract on local OffCKB devnet.

Build artifacts:

```txt
dist/hash-lock.js
dist/hash-lock.bc
```

Deploy transaction:

```txt
0xd0a2f822f1758da66a57cceb17788bf10b7ca623748b81e8e75ad60b39303ea4
```

Generated preimage and hash:

```txt
preimage: Hello World
hash: 106911e4f83e790e1eb2f39bdff23c1db43ed5af9219f763e571389af21259ca
```

Generated hash-lock address:

```txt
ckt1qzkymvxscq5t5rtnmmy7uhn28sxf3lxle2y4gq4r9pwksr5kfh95vqgqqrxjvt9nnk0g8a372s26263rnqhmdtnehxf78nehrsf044ca6g63jqssdyg7f7p70y8pavhnn00ly0qaksldttujr8mk8et38zd0yyjeegzhwqfh
```

I funded the address two times. The frontend showed:

```txt
Total capacity: 600 CKB
```

However, the unlock attempt failed with:

```txt
TransactionFailedToResolve: Resolve failed Unknown(OutPoint(...))
```

Problem OutPoint:

```txt
tx_hash: 0x4309def4700f30d10cd1a08c74a1e84ddf49394036556350742a337f801570ff
index: 0x0
```

Querying that OutPoint with `get_live_cell` returned:

```json
{
  "cell": null,
  "status": "unknown"
}
```

This was a useful blocker, not just a failure. It showed that the transaction failed before script verification.

If the preimage were wrong, the Cell would be resolved, the script would run, and the witness would fail verification. Here, the node could not find the referenced input Cell, so the script never got to test the preimage.

That gave me a clearer validation model:

```txt
1. Resolve phase: can the node find inputs and dependencies?
2. Script phase: do Lock/Type Scripts execute successfully?
3. Commit phase: can the transaction be accepted on-chain?
```

The blocker is now a concrete debugging task for next week:

- inspect how the frontend collects live Cells for the hash-lock address
- check whether the frontend is caching stale OutPoints
- compare the displayed balance source with the selected spending Cell
- query live Cells for the hash-lock Lock Script directly
- reproduce from a fresh devnet state
- use OffCKB debug once a valid transaction candidate exists

Even though the unlock transaction did not complete, the experiment moved me closer to understanding custom verification logic. A custom Lock Script can act like a small verifier: it reads public parameters from `script_args`, reads unlocking data from the `witness`, performs computation, and decides whether the Cell can be consumed.

---

## 7. Protocol Synthesis

Across the four experiments, the Cell model became progressively more concrete:

```txt
Transfer:
  Cells move value through input consumption and output creation.

Store Data:
  Cells hold arbitrary bytes, but meaning is only by convention unless constrained.

xUDT:
  Type Scripts turn Cell data into protocol-enforced token state.

Hash Lock:
  Lock Scripts can define custom spending conditions.
```

My current model of CKB application design is:

```txt
Cell.lock = who can consume this Cell
Cell.type = what rules govern this Cell's state
Cell.data = what state bytes are stored here
witness = what evidence is supplied for verification
cell_deps = where verification code/dependencies come from
```

This is the protocol-engineering insight I am taking from Week 2:

> CKB development is not only writing transactions. It is designing state, evidence, and verification boundaries.



## 8. ZK, Privacy, and Cryptography Reflection

Last week, my ZK reflections were mostly conceptual. This week they became more grounded because I touched the pieces that a future privacy-oriented design would need: Cell data, witnesses, Type Scripts, Lock Scripts, and custom verification.

The data-cell experiment showed that Cell data can store public state bytes:

```txt
commitment
nullifier
state root
proof reference
capsule identifier
metadata hash
```

The xUDT experiment showed that a Type Script can enforce rules over Cell data. That is important because a ZK-oriented application would need more than stored bytes. It would need a verifier that accepts only valid state transitions.

The hash-lock experiment added another bridge. It is not private because the preimage is eventually revealed in the witness, but the shape is close to a proof-verifier pattern:

```txt
public condition: hash stored in script_args
unlocking input: preimage supplied in witness
verifier: custom Lock Script
result: spend allowed only if verification passes
```

A future ZK-oriented version would replace "reveal the preimage" with "prove knowledge of a valid secret or state transition without revealing the secret."

My current privacy design sketch is:

```txt
cell.data = public commitment / nullifier / state root
witness = public proof bytes or verifier inputs
type script = verifies valid transition
lock script = controls spend/update authority
off-chain witness = private data used to generate proof
```

The important caution is that CKB does not make data private by default. It gives flexible verification primitives. Privacy still has to be designed intentionally.


## 9. Open Questions and Next Steps

The main unresolved blocker is the hash-lock unlock flow:

```txt
Frontend balance shows funded capacity.
Unlock transaction selects an OutPoint the node reports as unknown.
```

Next week I want to:

- debug the simple-lock frontend's Cell selection path
- query live Cells for the hash-lock Lock Script directly
- use OffCKB debug on a valid transaction candidate
- continue into Rust script development
- study custom script authoring beyond the JavaScript tutorial path

The main protocol questions I want to carry forward are:

- What exactly is the best debugging flow when a transaction fails before script execution?
- How do Type ID, `hash_type`, and code deployment patterns affect upgradeability?
- How should a CKB app separate public state, witness evidence, and private off-chain data?
- What would a proof-carrying Cell transition look like in practice?

---

## 10. Evidence

Notes:

- `notes/04-transfer-and-tx-state.md`
- `notes/05-data-cells-and-hashes.md`
- `notes/06-signing-and-witness-anatomy.md`
- `notes/07-xudt-and-type-scripts.md`
- `notes/08-custom-lock-hash-lock.md`

Experiments:

- `experiments/week-02/simple-transfer/query-tx.sh`
- `experiments/week-02/simple-transfer/transfer-observations.md`
- `experiments/week-02/store-data-on-cell/query-live-cell.sh`
- `experiments/week-02/store-data-on-cell/decode-hex.js`
- `experiments/week-02/store-data-on-cell/store-data-observations.md`
- `experiments/week-02/store-data-on-cell/get-live-cell-response.json`
- `experiments/week-02/xudt/xudt-observations.md`
- `experiments/week-02/simple-lock/hash-lock-observations.md`
- `experiments/week-02/simple-lock/get-live-cell-unknown-response.json`

Key hashes and values:

- Transfer tx: `0x61921431e12086f92f015c5bf75d94dda46b6b4b64264c8b582c199143623657`
- Transfer status: `committed`, block `0x4c6e`
- Data Cell tx: `0x857ac1137643c2c9b7160474d765982898c5a5ed1e5b64178c1c0c468aa4b881`
- Data Cell decoded message: `capsule-v0: zk-attestation-placeholder`
- xUDT issue tx: `0x0f7441d2d1ca474ab4ac21b07727e6f93718d1b1c6f437c457972eeda9e287d3`
- xUDT args: `0x7de82d61a7eb2ec82b0dc653e558ba120efcbfbb44dac87c12972d05bf25065300000000`
- xUDT accounting: `54 input tokens -> 5 receiver tokens -> 49 sender change tokens`
- Hash-lock deploy tx: `0xd0a2f822f1758da66a57cceb17788bf10b7ca623748b81e8e75ad60b39303ea4`
- Hash-lock blocker OutPoint: `0x4309def4700f30d10cd1a08c74a1e84ddf49394036556350742a337f801570ff:0x0`
- Hash-lock OutPoint query result: `status: unknown`

## 11. Summary

Week 2 gave me a much stronger practical understanding of CKB.

> CKB applications are built by designing Cells, deciding what state lives in them, choosing who can consume them, attaching rules for valid transitions, and supplying the evidence scripts need to verify those transitions.

That is the part of CKB that feels most aligned with my long-term interest in ZK, cryptography, attestations, and proof-carrying state transitions.
