# CKBuilder Weekly Report - Week 5

**Name:** Nelly Njeri  
**Week Ending:** 23 June 2026  

## 1. Weekly Focus

This week was about turning Capsule Notes from a working typed-Cell demo into a clearer protocol inspection tool.

In Week 4, I wrote, compiled, deployed, and interacted with a custom Rust Type Script called `capsule-transition-guard`. The main result was Capsule Notes: a small CKB dApp that mints a note as a typed Cell.

For Week 5, I wanted to make the transaction shape visible.

The question I focused on was:

> What exactly does my frontend action become at the CKB transaction level?

That led me to build **Capsule Transaction Inspector v0**, a developer-facing inspection layer inside Capsule Notes.

Instead of only showing that a Capsule was minted, the app now exposes the actual transaction pieces involved:

```txt
Lock Script
Type Script
CellDeps
inputs
outputs
outputsData
witnesses
capacity flow
tx hash
OutPoint
live Cell status
raw live Cell
invalid transaction rejection
```

This was an important step because CKB development is not only about triggering actions from a frontend. It is about proposing state transitions through transactions, then having scripts verify those transitions.

The rest of the week had two research threads:

- Molecule serialization as the next step after my hand-rolled Capsule byte format.
- Noir-to-CKB verifier research as a long-term ZK direction.

I also published my CKBuilder reflection article, which connects my Ethereum mental model, CKB's Cell model, and my ZK/verifier interests.


## 2. Capsule Transaction Inspector v0

The main build artifact this week was the Capsule Transaction Inspector.

In the previous version of Capsule Notes, the frontend could:

1. derive an account from an OffCKB private key
2. show the account Lock Script
3. show the deployed Capsule Type Script
4. encode Capsule data
5. mint a typed Cell
6. read the Cell back by OutPoint
7. test that invalid Capsule data was rejected

That proved the basic application path worked.

This week I changed the app so that the transaction-building process itself becomes visible.

The inspector now captures the transaction before and after the two important CCC completion steps:

```txt
ccc.Transaction.from(...)
-> completeInputsByCapacity(...)
-> completeFeeBy(...)
-> sendTransaction(...)
```

This follows the same transaction-composition flow shown in the CCC documentation. A transaction starts as an intended output structure, then CCC selects input Cells, creates change, accounts for the fee, prepares witness placeholders, and sends the completed transaction.

That distinction matters.

Before funding, the transaction mainly says:

```txt
I want to create a Capsule output Cell with this Type Script and this data.
```

After funding and fee completion, the transaction becomes a full proposal:

```txt
consume these input Cells
create this Capsule Cell
create this change Cell
load this script code through CellDeps
attach witness data for script verification
pay this fee
```

The inspector now makes that difference visible.


## 3. What the Inspector Shows

The inspector exposes the protocol objects that are usually hidden behind the frontend button.

For the account side, it shows:

```txt
account address
account Lock Script
available capacity
```

For the Capsule script side, it shows:

```txt
Capsule Type Script
Capsule CellDep
deployment constants
```

For transaction construction, it shows:

```txt
transaction hash before input selection
transaction hash after input/fee completion
input count
output count
outputsData count
CellDeps count
witness count
input capacity
output capacity
fee
```

For Capsule state, it shows:

```txt
output data hex
decoded magic prefix
decoded version
decoded capsule_id
decoded body
```

For chain lookup, it shows:

```txt
tx hash
output index
OutPoint
live/dead status
raw live Cell
```

The app is still a focused learning tool, but it now surfaces the same things I need to understand when debugging real CKB applications:

```txt
Which Cells are consumed?
Which Cells are created?
What script code is loaded?
What state bytes are created?
What does the Type Script enforce?
Is the resulting output Cell live?
```


## 4. Protocol Checks

I also added local protocol checks to the inspector.

These checks are not meant to replace the on-chain Type Script. They are developer feedback. The Type Script is still the real enforcement layer.

The local checks include:

```txt
- Capsule output has a Type Script
- transaction includes the Capsule script CellDep
- Cell data is longer than the Capsule header
- magic prefix is CAPSULE_V1
- version is 1
- capsule ID is 32 bytes
- body is non-empty
- body fits the local 512-byte limit
```

This clarified an important distinction:

```txt
frontend checks = explain the expected format
Type Script checks = enforce the format during transaction validation
```

That distinction feels small, but it is important. A frontend can guide the user, but the protocol must not rely on frontend honesty.

The invalid mint test is still part of the app. It intentionally uses the wrong magic prefix. A valid Capsule uses:

```txt
CAPSULE_V1
```

The invalid test uses a bad prefix and should be rejected by the deployed Type Script.

When I ran the invalid mint test, the transaction failed with:

```txt
TransactionFailedToVerify
source: Outputs[0].Type
cause: ValidationFailure
error code: -42
```

This was exactly the failure I wanted to see.

The important part is the source:

```txt
Outputs[0].Type
```

That means the newly created Capsule output Cell's Type Script executed and rejected the transaction during script verification. The transaction reached the CKB verification layer, the output Type Script ran, and the script returned a non-zero validation error.

The OffCKB node debug output made the reason explicit:

```txt
DEBUG OUTPUT: Rejected: missing CAPSULE_V1 magic prefix.
ValidationFailure: see error code -42
```

This was one of the strongest pieces of evidence from the week because it proved the script was not just attached to the transaction. It was actually enforcing the Capsule data rule.

This gives direct evidence that:

```txt
the CellDep is included
the Type Script is loaded
the output Type Script executes
the script rejects invalid state
```

That is the important proof. The transaction is not valid just because the frontend built it. It is valid only if the scripts accept it.


## 5. OutPoint and Live Cell Lookup

I also made the read path clearer.

The Store Data on Cell tutorial helped frame this part. After a transaction creates an output Cell, that Cell can be retrieved by its OutPoint:

```txt
tx hash + output index = OutPoint
```

For Capsule Notes, that means:

```txt
mint transaction hash
+ output index 0x0
= exact Capsule Cell
```

The inspector uses that OutPoint to read the live Cell and display the raw Cell returned by the node.

This closes the loop:

```txt
frontend input
-> encoded Capsule bytes
-> CCC transaction
-> typed output Cell
-> transaction hash
-> OutPoint
-> live Cell lookup
-> raw outputData
-> decoded Capsule state
```


## 6. Why This Matters

This week helped me understand that CKB frontend work has a different debugging shape from Ethereum frontend work.

In Ethereum, my frontend instinct is usually:

```txt
contract address
ABI
function call
transaction receipt
event logs
contract storage
```

In CKB, the shape is different:

```txt
input Cells
output Cells
outputsData
Lock Scripts
Type Scripts
CellDeps
witnesses
OutPoints
live Cells
```

That means a serious CKB frontend should help the developer see the transaction being proposed.

This is why the Capsule Transaction Inspector is not just a UI addition. It is a small debugging tool for the Cell model.

It shows the transition:

```txt
old live Cells
-> proposed transaction
-> new live Cells
```

That is also why this connects to the larger idea of a Cell Transaction Visual Debugger. Capsule Inspector v0 is not that full tool, but it is a small version of the same instinct:

> Make the Cell transition visible.


## 7. Article Published

This week I also worked on and published a CKBuilder reflection article.

The article grew out of my first four weeks learning CKB as someone coming from an Ethereum mental model.

My original instinct was to look for:

```txt
contract address
ABI
verified source
frontend client
function calls
```

But CKB kept pushing me toward different questions:

```txt
Where is the state?
Which Cell contains it?
Which script controls ownership?
Which script validates the transition?
What witness evidence is supplied?
Which CellDeps are needed?
What exactly is being consumed and recreated?
```

The article explores that mental shift.

It also connects to my ZK interests. The more I worked with Cells, witnesses, Type Scripts, and transaction validation, the more familiar the verifier shape became:

```txt
old state
new state
witness
public data
verifier
accept / reject
```

CKB scripts are not automatically ZK verifiers, but CKB's model naturally trains the same kind of thinking: state transitions should be explicit, constrained, and verified.

That was the main emotional and technical point of the article.


## 8. Molecule Research

I also began researching Molecule because Capsule Notes currently uses a hand-rolled binary format.

The current Capsule layout is:

```txt
[0..10]   magic: CAPSULE_V1
[10..14]  version: u32 little-endian
[14..46]  capsule_id: 32 bytes
[46..]    note body bytes
```

This was useful for learning because I had to manually understand every byte. But it is not the best long-term format for a serious CKB application.

CKB's documentation explains that CKB uses both JSON and Molecule. JSON is common for RPC, but Molecule is the core serialization method in CKB. Molecule is recommended because CKB needs serialization that is stable, consistent, efficient, and reliable across implementations.

The Molecule properties that stood out to me were:

```txt
canonicalization
partial reading
self-contained substructures
zero-copy access
version compatibility
```

This matters directly for Capsule Notes.

If `cell.data` is going to represent protocol state, the frontend and the Rust Type Script need to agree exactly on the byte layout. A schema gives that agreement a formal shape.

My Week 5 Molecule research question became:

> How do I turn Capsule data from a hand-rolled byte format into a schema-backed format that both TypeScript and Rust can safely encode and decode?

A first possible schema could look like:

```txt
array Byte32 [byte; 32];
vector Bytes <byte>;

table CapsuleNote {
  version: byte,
  capsule_id: Byte32,
  body: Bytes,
}
```

I am currently leaning toward a `table` rather than a fixed `struct` because the Capsule body is dynamic and future versions may need extra fields. A table fits better with the idea of versioned protocol state.

The next implementation step is:

```txt
CapsuleNote.mol
-> generated Rust types
-> generated TypeScript/JavaScript encoder
-> frontend writes Molecule-encoded data
-> Rust Type Script parses Molecule data
-> malformed Molecule data is rejected
```

This will be a stronger foundation for Capsule Notes v2.


## 9. Noir-to-CKB Verifier Research

I also started a research thread around a long-term question:

> What would the CKB equivalent of Noir-to-Solidity verifier generation look like?

In the Ethereum world, the familiar flow is:

```txt
write Noir circuit
compile circuit
generate proof
generate Solidity verifier
deploy verifier contract
call verifier from app/contract
```

But CKB is not Ethereum.

There is no Solidity verifier contract in the same sense. There is no single account-storage contract that owns all application state.

A CKB-native version would need to look more like:

```txt
Noir circuit
-> compiled circuit / ACIR
-> proving backend artifacts
-> verification key
-> proof bytes
-> CKB-compatible verifier script
-> verifier script deployed as a code Cell
-> Type Script uses verifier logic to validate a Cell transition
```

The most important part is that a CKB verifier should not only verify a proof in isolation.

It should bind proof validity to a specific Cell transition.

For Capsule Notes, that means the proof should be connected to things like:

```txt
old Capsule Cell
new Capsule Cell
old commitment
new commitment
capsule_id
nullifier
state root
verification key hash
script args
```

A weak design would verify a proof but fail to prove that the proof belongs to this exact transaction.

A stronger design would make the Type Script check:

```txt
the proof is valid
AND the proof refers to this input Cell
AND the proof authorizes this output Cell
AND the public inputs match the committed state transition
```

That is the research direction I care about.

My current model is:

```txt
cell.data = public commitment / state / proof metadata
witness = proof bytes + public inputs needed by the script
Type Script = verifier that accepts or rejects the transition
off-chain witness = private data used to generate the proof
```

This is still research, not implementation.

The hard part is that a real verifier must become something CKB-VM can execute efficiently. CKB scripts are binary executables that run inside CKB-VM and return `0` for success or a non-zero code for failure.

So the immediate goal is not:

```txt
build a full Noir-to-CKB compiler
```

The more realistic path is:

```txt
1. Define a ProofEnvelope schema with Molecule.
2. Bind proof metadata to Capsule Cell transitions.
3. Keep proof generation off-chain.
4. Put proof bytes and public inputs in witness data.
5. Start with mock verification or hash-based verification.
6. Later research real verifier implementation inside CKB-VM.
```

This gives a clear progression:

```txt
Capsule Notes
-> Molecule serialization
-> ProofEnvelope
-> proof-bound Cell transitions
-> future Noir/CKB verifier research
```


## 10. Sources Studied

This week I used or reviewed:

- Nervos CKB: CCC documentation  
  https://docs.nervos.org/docs/sdk-and-devtool/ccc

- Nervos CKB: Store Data on Cell  
  https://docs.nervos.org/docs/dapp/store-data-on-cell

- Nervos CKB: Intro to Script  
  https://docs.nervos.org/docs/script/intro-to-script

- Nervos CKB: Rust Quick Start  
  https://docs.nervos.org/docs/script/rust/rust-quick-start

- Nervos CKB: Serialization and Molecule in CKB  
  https://docs.nervos.org/docs/serialization/serialization-molecule-in-ckb

- Nervos CKB: Molecule Schema Language  
  https://docs.nervos.org/docs/serialization/schema-language

- Nervos CKB: Encoding Spec With Examples  
  https://docs.nervos.org/docs/serialization/encoding-specs

- Nervos CKB: Use Molecule in CKB Scripts  
  https://docs.nervos.org/docs/serialization/use-in-ckb-scripts

- Nervos CKB: Molecule Tools  
  https://docs.nervos.org/docs/serialization/tools-molecule

- Noir Documentation  
  https://noir-lang.org/docs/

- Noir Nargo Commands / ACIR compilation reference  
  https://noir-lang.org/docs/reference/nargo_commands


## 11. Evidence and Artifacts

Evidence from this week includes:

```txt
- Capsule Transaction Inspector v0 added to Capsule Notes
- transaction snapshots before input selection
- transaction snapshots after input and fee completion
- account Lock Script displayed
- Capsule Type Script displayed
- Capsule CellDeps displayed
- output data hex displayed
- decoded Capsule data displayed
- OutPoint shown after mint
- live/dead Cell status shown
- raw live Cell displayed
- invalid Capsule mint rejected at Outputs[0].Type
- custom script error code -42 captured
- node debug output confirmed: Rejected: missing CAPSULE_V1 magic prefix
- TypeScript check passing with tsc --noEmit
- CKBuilder reflection article published
- Molecule research notes started
- Noir-to-CKB verifier research direction mapped
```

Suggested screenshots:

```txt
screenshots/week-05/01-capsule-notes-running.png
screenshots/week-05/02-transaction-inspector-empty.png
screenshots/week-05/03-valid-capsule-minted.png
screenshots/week-05/04-before-funding-snapshot.png
screenshots/week-05/05-after-funding-snapshot.png
screenshots/week-05/06-capsule-type-script-and-celldep.png
screenshots/week-05/07-outpoint-live-cell.png
screenshots/week-05/08-raw-live-cell.png
screenshots/week-05/09-invalid-capsule-browser-rejection.png
screenshots/week-05/10-invalid-capsule-node-debug.png
screenshots/week-05/11-invalid-inspector-failed-check.png
screenshots/week-05/12-article-published.png
screenshots/week-05/13-molecule-docs-research.png
```


## 12. Reflection

This week made me more convinced that CKB development needs good visibility tools.

The Cell model is powerful, but it is also easy to keep too much of it in your head. If the developer cannot see the transaction shape, debugging becomes much harder than it needs to be.

Capsule Transaction Inspector v0 helped me see my own dApp more clearly.

It also made the ZK direction feel more grounded.

The shape I keep returning to is:

```txt
old state
new state
witness
verifier
accept / reject
```

That shape appears in CKB transactions, CKB scripts, and proof systems.

The next step is to make the state format stronger with Molecule, then start moving toward proof-bound Cell transitions.

My current path is:

```txt
Capsule Notes v1: custom binary typed Cell
Capsule Inspector v0: transaction visibility
Capsule Notes v2: Molecule serialization
Capsule ProofEnvelope: proof metadata and public inputs
Future work: Noir/CKB verifier research
```

This week was not just about adding an inspector. It was about learning to see CKB applications as explicit, inspectable, verifiable state transitions.
