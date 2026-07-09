# CKBuilder Weekly Report - Week 6

**Name:** Nelly Njeri  
**Week Ending:** 5 July 2026  

## 1. Weekly Focus

Week 6 was about taking Capsule Notes one layer deeper.

In Week 4, I built `capsule-transition-guard`, a Rust Type Script that validates Capsule Cells. In Week 5, I added a transaction inspector so I could see the shape of the transaction: Lock Script, Type Script, CellDeps, output data, OutPoint, live Cell status, and invalid-script rejection.

This week, I focused on the state format itself.

The main question was:

> How do I move Capsule Notes from a hand-rolled byte layout into schema-backed CKB Cell data?

That led me into Molecule, CKB's serialization system.

The result is that Capsule Notes now has a Molecule-backed `CapsuleNote` schema, a CCC TypeScript codec, a generated Rust Molecule reader inside the Type Script, a redeployed `capsule-transition-guard`, and a successful end-to-end mint of a live Molecule-encoded Capsule Cell.

The important shift was:

```txt
Week 4:
custom bytes + Rust parser + Type Script validation

Week 6:
Molecule schema + CCC encoder + generated Rust reader + Type Script validation
```

The deployed on-chain Type Script now parses Molecule data and rejects malformed Capsule state during CKB script verification.


## 2. Why Molecule Mattered

CKB Cells store bytes.

They do not store JavaScript objects, Rust structs, JSON objects, or "notes" in the application sense. A Cell stores raw bytes in `cell.data`, and then scripts and applications decide how to interpret those bytes.

In the first version of Capsule Notes, I used a custom binary layout:

```txt
[0..10]   magic: CAPSULE_V1
[10..14]  version: u32 little-endian
[14..46]  capsule_id: 32 bytes
[46..]    body bytes
```

That format was useful while learning because every byte was visible. I could point at the exact offset where the magic prefix started, where the version lived, where the `capsule_id` started, and where the body began.

But it also had a weakness: the schema lived in too many places at once.

```txt
frontend encoder
Rust parser
my notes
my mental model
```

That is fragile.

If the frontend and the Type Script disagree about offsets, field order, length prefixes, or dynamic data layout, the transaction can fail in confusing ways.

Molecule solves the serialization part of that problem. It gives the Cell data an explicit schema and deterministic encoding, so both the frontend and the Rust script can agree on the same byte structure.

My key distinction this week:

```txt
Molecule = deterministic schema-backed serialization
Type Script = protocol validation and state-transition enforcement
```

Molecule does not make the Capsule valid by itself. It gives the data structure. The Type Script still decides whether that structure is acceptable.


## 3. CapsuleNote Schema

I defined the first Capsule Molecule schema as:

```mol
array Magic [byte; 10];
array Uint32 [byte; 4];
array Byte32 [byte; 32];
vector Bytes <byte>;

table CapsuleNote {
    magic: Magic,
    version: Uint32,
    capsule_id: Byte32,
    body: Bytes,
}
```

This schema maps directly to the Capsule state I already had:

```txt
magic      -> identifies this as Capsule data
version    -> tracks Capsule state version
capsule_id -> stable identity across transitions
body       -> user note bytes
```

I chose a `table` instead of a fixed struct because Capsule body is dynamic, and future versions may need additional fields. That matters for a protocol object that may eventually grow into proof-related state.

The TypeScript side uses CCC's Molecule module to encode the same shape:

```ts
ccc.mol.table({
  magic: MagicCodec,
  version: ccc.mol.Uint32LE,
  capsuleId: ccc.mol.Byte32,
  body: ccc.mol.Bytes,
})
```

This gave me a clean frontend path:

```txt
Capsule object
-> CCC Molecule encoder
-> 0x-prefixed outputData
-> CKB output Cell
```

I also added a Molecule preview section to Capsule Notes so the app shows the encoded `outputData` and the decoded `CapsuleNote` before minting.


## 4. TypeScript Codec and Round Trip

I created a TypeScript Molecule codec for Capsule Notes and a Week 6 sandbox to test it before touching the on-chain script path.

The sandbox demonstrates:

```txt
Capsule object
-> Molecule bytes
-> decoded Capsule object
-> round trip ok
```

The important lesson was that serialization is not just a convenience layer. In CKB, serialization is part of the application boundary.

The frontend cannot say:

```txt
Here is a note.
```

It has to say:

```txt
Here are the exact bytes that should become cell.data.
```

The frontend is not only sending a request to a server. It is constructing part of a state transition that every validating node must be able to check.

The Molecule codec now gives Capsule Notes a more reliable way to produce those bytes.


## 5. Rust Type Script Migration

The biggest technical step was updating the Rust Type Script to parse Molecule data.

I generated Rust bindings from the Molecule schema with `moleculec`, then copied the generated reader into the `capsule-transition-guard` contract:

```txt
contracts/capsule-transition-guard/src/generated/capsule_note.rs
```

Then I added Molecule to the contract dependency list:

```toml
molecule = { version = "0.9.2", default-features = false, features = ["bytes_vec"] }
```

The Type Script now imports the generated reader:

```rust
mod generated {
    pub mod capsule_note;
}

use generated::capsule_note::CapsuleNoteReader;
use molecule::prelude::Reader;
```

The old parser manually sliced bytes by offsets. The new parser starts by asking Molecule whether the data is a valid `CapsuleNote`:

```rust
let capsule = CapsuleNoteReader::from_slice(data).map_err(|_| -45)?;
```

Then the script still enforces Capsule-specific rules:

```txt
magic == CAPSULE_V1
version != 0
body is non-empty
capsule_id stays stable across updates
version increments across updates
```

This distinction is one of the most important things I learned this week:

```txt
Molecule answers:
Is this data structurally a CapsuleNote?

The Type Script answers:
Is this CapsuleNote valid protocol state?
```


## 6. Build, Strip, Deploy

After updating the Type Script, I rebuilt it for CKB-VM:

```bash
cargo build --target=riscv64imac-unknown-none-elf --release -p capsule-transition-guard
```

The build succeeded, but the first deploy attempt exposed an important CKB deployment lesson.

The unstripped binary was too large:

```txt
20308416 bytes
```

OffCKB refused to deploy it:

```txt
ignore deploying the binary file ... since its size is too large
No binary to deploy.
```

This was a useful reminder that CKB script code is deployed as Cell data. Code size is not abstract. It has real storage/capacity consequences.

I stripped the binary with LLVM:

```bash
llvm-strip --strip-all build/release/capsule-transition-guard
```

The deployable binary became:

```txt
38K
```

The stripped binary was still a valid RISC-V CKB-VM executable:

```txt
ELF 64-bit LSB executable, UCB RISC-V, RVC, soft-float ABI, statically linked, stripped
```

The final stripped binary hash was:

```txt
7cf6af09192a0636f60bdfc1058cb91fe5185befd9ddcda2c8f481ad1427f9ac
```

Then I redeployed the Type Script on OffCKB devnet:

```txt
contract capsule-transition-guard deployed
tx hash: 0x105dcbb06c86bdc7fecbd16b5bfd52469ff12bd7915b0e1b5434b944a48fa375
tx committed
```

The new deployed script info is:

```txt
codeHash:
0x36ac01f38d772d2f3d86f213a17062c89e549199b9781c164386eb6db3e21640

hashType:
data2

CellDep OutPoint:
txHash: 0x105dcbb06c86bdc7fecbd16b5bfd52469ff12bd7915b0e1b5434b944a48fa375
index: 0x0

depType:
code
```

I then updated Capsule Notes' `deployment.ts` so the frontend uses the new Molecule-parsing script.


## 7. End-to-End Verification

After redeploying, I tested the full path from frontend to live Cell.

I minted a valid Capsule with the body:

```txt
State is not mutated. It is consumed and recreated as a new Cell.
```

The mint transaction hash was:

```txt
0x62daebcfe1f62ac7b903666199f84b827f6dbf5ae25bc588831b53b462425fee
```

I read the minted Capsule back by OutPoint:

```txt
OutPoint:
0x62daebcfe1f62ac7b903666199f84b827f6dbf5ae25bc588831b53b462425fee:0x0
```

The Cell status was:

```txt
live
```

The decoded Capsule data was:

```txt
Magic: CAPSULE_V1
Version: 1
Capsule ID: 0x4bd261df981606ef31ee4f8eaa987104aebb4342e7f052c15b53ca7606ec49d8
Body: State is not mutated. It is consumed and recreated as a new Cell.
```

The raw live Cell showed that the output Type Script was the newly deployed Molecule parser:

```json
{
  "type": {
    "codeHash": "0x36ac01f38d772d2f3d86f213a17062c89e549199b9781c164386eb6db3e21640",
    "hashType": "data2",
    "args": "0x"
  }
}
```

This is the key proof that the minted Cell is not using the old script. It is using the new redeployed Molecule-backed Type Script.

The raw `outputData` was:

```txt
0x87000000140000001e000000220000004200000043415053554c455f5631010000004bd261df981606ef31ee4f8eaa987104aebb4342e7f052c15b53ca7606ec49d8410000005374617465206973206e6f74206d7574617465642e20497420697320636f6e73756d656420616e64207265637265617465642061732061206e65772043656c6c2e
```

The first part of that data is visibly Molecule table layout:

```txt
0x87000000 14000000 1e000000 22000000 42000000 ...
```

This means the output Cell is storing Molecule-encoded Capsule state, not the old hand-rolled linear byte format.


## 8. Invalid Molecule Data Rejection

The final test was the most important one: invalid data had to fail on-chain.

I used the invalid mint test, which intentionally uses the wrong magic prefix.

The transaction failed with:

```txt
TransactionFailedToVerify
source: Outputs[0].Type
error code: -42
```

The error URL pointed to the new script code hash:

```txt
0x36ac01f38d772d2f3d86f213a17062c89e549199b9781c164386eb6db3e21640
```

That matters.

It proves the transaction was not failing because of the frontend. It was not failing because the input Cells could not be resolved. It was not failing because the transaction was malformed before script execution.

It reached the CKB script verification phase, executed the output Type Script, parsed the Molecule structure, and rejected the Capsule because the protocol rule failed:

```txt
magic must be CAPSULE_V1
```

My mental model from this test:

```txt
valid Molecule structure + valid Capsule fields
-> accepted
-> live Cell

valid transaction shape + invalid Capsule magic
-> Type Script executes
-> Outputs[0].Type rejects
-> error -42
```

This is exactly the kind of evidence I wanted from Week 6.


## 9. Protocol-Level Learning

The biggest lesson this week was that serialization is part of protocol design.

In a normal web app, serialization often feels like plumbing. JSON goes over HTTP, the backend parses it, and everyone moves on.

In CKB, the serialized bytes are the state.

Those bytes live in Cells. They are hashed. They are referenced. They are read by scripts. They become part of the transaction's proposed state transition.

So the question is not only:

```txt
Can my app encode this object?
```

The better question is:

```txt
Can every validating node deterministically interpret these bytes the same way?
```

Molecule helps answer that question.

The second protocol lesson was about script deployment and code size. My first deploy failed because the unstripped binary was too large. That made the relationship between code and Cell data concrete:

```txt
script binary = Cell data
Cell data = capacity cost
capacity cost = protocol reality
```

The third lesson was about output Type Scripts.

In Ethereum, I am used to thinking of contract code as something I call. In CKB, I had to keep remembering that the Type Script is not a function endpoint. It is verifier logic attached to Cell state.

When I mint a Capsule, I am not calling:

```txt
mintCapsule(...)
```

in the Ethereum storage sense.

I am proposing:

```txt
create this output Cell
with this Type Script
with this Molecule-encoded data
with this CellDep
and let the Type Script decide whether the output is valid
```

That is a much more structural way to think about application state.


## 10. ZK and Attestation Connection

This Molecule migration also matters for my longer-term ZK direction.

If Capsule Notes eventually becomes a proof-carrying Cell or attestation Cell, then `cell.data` cannot remain an informal byte layout.

It needs explicit structure.

A future proof-related Cell might contain:

```txt
attestation_id
commitment
nullifier
state_root
metadata_hash
issuer_id
expiry_epoch
proof_system_id
verification_key_hash
```

Those fields need deterministic serialization so the frontend, off-chain prover, Type Script, and indexers all agree on what is being committed to.

This week helped me see Molecule as the first step toward that.

My current ZK mapping is:

```txt
Molecule schema
-> defines the public state format

cell.data
-> stores commitments, public state, or proof-related metadata

witness
-> carries proof bytes or public verification material

Type Script
-> verifies that the transition from old Cell to new Cell is valid

private ZK witness
-> stays off-chain with the prover
```

The careful distinction still matters:

```txt
CKB witness != private ZK witness
```

A CKB witness is transaction data visible to verification. A ZK witness is private data used by the prover. For a privacy-preserving Capsule design, raw private data should not be placed in the CKB witness. The chain should see commitments, public inputs, and proof material, not the raw private secret.

This is why Molecule feels important before any serious Noir-to-CKB or proof-verifier work. Before verifying a proof, I need to define what the public statement is.

For Capsule Notes, Molecule starts defining that statement.


## 11. Proof-Bound Capsule Reflection

A useful comment I received on my CKBuilder article sharpened the next design problem for Capsule Notes:

> A valid proof can still be bound to the wrong transition.

That helped me separate two ideas that are easy to collapse:

```txt
proof verifies mathematically
!=
proof verifies the intended CKB state transition
```

For a future ZK Capsule design, it would not be enough for a Type Script to verify a proof in isolation. The proof must be bound to the exact transition being proposed:

```txt
old Capsule Cell
new Capsule Cell
old commitment
new commitment
action ID
nullifier
public inputs
Type Script identity
transaction context
```

This creates both a protocol problem and a UI/UX problem. A user should not only see:

```txt
proof verified
```

They should be able to understand:

```txt
proof verified for this exact typed transition
```

This connects directly to the Molecule work from this week. Molecule gives Capsule state an explicit schema. A future `ProofEnvelope` schema could make the proof binding explicit too, so the Type Script can check that the proof's public inputs correspond to the actual Cells being consumed and created.

My next design question is:

> How should a CKB Type Script bind proof metadata to old Cell -> new Cell transitions so that a valid proof cannot be reused for the wrong transition?


## 12. Files and Artifacts

Main artifacts from this week:

```txt
experiments/week-06/capsule-molecule/
```

This contains the Molecule sandbox, schema, and codec demo.

```txt
experiments/week-06/capsule-molecule/schemas/capsule_note.mol
```

This defines the `CapsuleNote` Molecule schema.

```txt
experiments/week-04/capsule-notes/capsule-molecule.ts
```

This contains the CCC Molecule encoder/decoder used by Capsule Notes.

```txt
experiments/week-04/capsule-notes/index.tsx
```

This now includes the Molecule Preview section and continues to expose transaction inspection.

```txt
experiments/week-04/capsule-notes/lib.ts
```

This now uses Molecule-backed Capsule data encoding and decoding.

```txt
experiments/week-04/capsule-notes/deployment.ts
```

This points the frontend at the redeployed Molecule-backed Type Script.

```txt
contracts/capsule-transition-guard/src/generated/capsule_note.rs
```

This is the generated Rust Molecule reader from `moleculec`.

```txt
contracts/capsule-transition-guard/src/main.rs
```

This now parses `CapsuleNote` with `CapsuleNoteReader::from_slice`.

```txt
notes/15-molecule-capsule-schema.md
```

This captures the reasoning behind the schema migration.


## 13. Evidence

Build evidence:

```txt
cargo build --target=riscv64imac-unknown-none-elf --release -p capsule-transition-guard
Finished release profile
```

Binary evidence:

```txt
Before strip: 20308416 bytes
After strip: 38K
```

Deploy evidence:

```txt
deployment tx:
0x105dcbb06c86bdc7fecbd16b5bfd52469ff12bd7915b0e1b5434b944a48fa375

new codeHash:
0x36ac01f38d772d2f3d86f213a17062c89e549199b9781c164386eb6db3e21640
```

Valid mint evidence:

```txt
mint tx:
0x62daebcfe1f62ac7b903666199f84b827f6dbf5ae25bc588831b53b462425fee

status:
live

type.codeHash:
0x36ac01f38d772d2f3d86f213a17062c89e549199b9781c164386eb6db3e21640
```

Invalid mint evidence:

```txt
TransactionFailedToVerify
source: Outputs[0].Type
error code: -42
```

Screenshots to include:

```txt
week6-01-molecule-schema.png
week6-02-molecule-codec-demo-round-trip.png
week6-03-generated-rust-reader.png
week6-04-rust-build-success.png
week6-05-strip-binary-size.png
week6-06-offckb-deploy-success.png
week6-07-molecule-preview-ui.png
week6-08-valid-molecule-mint-txhash.png
week6-09-read-by-outpoint-live-cell.png
week6-10-raw-live-cell-new-codehash.png
week6-11-invalid-mint-output-type-error-42.png
```


## 14. Reflection

This week made Capsule Notes feel more serious.

Before Molecule, the app had working validation, but the data format still felt like something I was personally remembering. After Molecule, the state format became an explicit schema that both TypeScript and Rust can share.

That is the difference between:

```txt
I know where the bytes are.
```

and:

```txt
The protocol has a declared state shape.
```

The most satisfying part was seeing both sides work:

```txt
valid Molecule CapsuleNote
-> accepted
-> live Cell

invalid Capsule magic
-> rejected by Outputs[0].Type
-> error -42
```

That is the loop I want to keep building:

```txt
schema
-> encoded Cell data
-> Type Script parser
-> validation rule
-> accepted or rejected transition
```

This is also why CKB keeps feeling aligned with my ZK interests. The Cell model forces me to think in terms of public state, witnesses, commitments, and verifier logic. Molecule gives me a way to define the public state. Type Scripts give me a way to enforce valid transitions. ZK can eventually give me a way to prove something about private state without revealing it.

For now, the win is simple and concrete:

> Capsule Notes no longer stores an informal byte blob. It stores a Molecule-encoded `CapsuleNote`, and the deployed Type Script validates it.


## 15. Plan for Next Week

Next week, I want to build on this migration instead of jumping too far ahead.

The next practical goals are:

```txt
1. Add tests or scripted fixtures for valid and invalid Molecule Capsule data.
2. Exercise the update path using Molecule data:
   old Capsule Cell -> new Capsule Cell
   same capsule_id
   version + 1
3. Capture a full transaction inspector view for a Molecule update transition.
4. Clean up generated-code warnings only if they become distracting.
5. Start sketching a ProofEnvelope Molecule schema.
6. Define what proof-related metadata belongs in cell.data vs witness.
```

The next conceptual goal is:

> Move from "Molecule-backed Capsule state" to "proof-bound Capsule transition."

That means the Cell data format should start preparing for public commitments, nullifiers, proof metadata, and verifier parameters, even before a full ZK verifier is running on CKB.


## 16. Resources Used

- Nervos CKB Docs: Serialization and Molecule in CKB  
  `https://docs.nervos.org/docs/serialization/serialization-molecule-in-ckb`

- Nervos CKB Docs: Molecule Features  
  `https://docs.nervos.org/docs/serialization/features-molecule`

- Nervos CKB Docs: Use Molecule in CKB Scripts  
  `https://docs.nervos.org/docs/serialization/use-in-ckb-scripts`

- Nervos CKB Docs: Molecule Tools  
  `https://docs.nervos.org/docs/serialization/tools-molecule`

- Nervos CKB Docs: Molecule Schema Language  
  `https://docs.nervos.org/docs/serialization/schema-language`

- Nervos CKB Docs: Encoding Specs  
  `https://docs.nervos.org/docs/serialization/encoding-specs`

- Nervos CKB Docs: CCC Molecule  
  `https://docs.nervos.org/docs/serialization/ccc-molecule`
