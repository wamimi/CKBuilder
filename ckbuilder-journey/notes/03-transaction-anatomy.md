# Transaction Anatomy: Inputs, Outputs, Witnesses, and Deps

**Focus:** Understanding the structure of CKB transactions, how scripts access dependencies, and how transactions move from proposal to confirmation.



## Why this section matters

Today's reading helped me move from understanding individual Cells to understanding how CKB state actually changes.

A transaction in CKB is not just a transfer. It is a structured state transition proposal.

My current mental model:

```txt
Transaction = consume old Cells + create new Cells + provide evidence + declare dependencies + pass verification
```

This is important because everything in CKB seems to revolve around verifying whether a proposed Cell transition is valid.

## Inputs

Inputs are the live Cells that a transaction wants to consume.

Each input points to a previous output Cell using an OutPoint.

```txt
OutPoint = transaction hash + output index
```

So an input is basically saying:

```txt
I want to consume this exact Cell that was created by a previous transaction.
```

The `since` field is also interesting because it can time-lock an input. It controls when that input becomes valid using block number, epoch number, or timestamp.

My mental model:

```txt
inputs = old live Cells being destroyed
since  = optional time condition before the Cell can be consumed
```

This makes me think about delayed payments, coordination between multiple parties, and protocol rules that depend on time.

## Outputs

Outputs are the new Cells created by the transaction.

The important CKB rule is:

```txt
Cells are not updated in place.
Old Cells are consumed.
New Cells are created.
```

So if Alice sends CKB to Bob, Alice's old Cell becomes dead, and new Cells are created for Bob and Alice's change.

My mental model:

```txt
inputs  -> transaction verification -> outputs
old state -> validity check          -> new state
```

## outputs_data

`outputs_data` contains the data for each output Cell.

The indexing matters:

```txt
outputs[i] uses outputs_data[i]
```

This means the Cell structure and the Cell data are separated.

My current interpretation:

```txt
outputs      = the Cell shell: capacity, lock, type
outputs_data = the state bytes stored in that Cell
```

This becomes important for application state.

Token Cell:

```txt
outputs[i]      = Cell with token Type Script
outputs_data[i] = encoded token amount
```

Possible future privacy or attestation Cell:

```txt
outputs[i]      = Cell with attestation Type Script
outputs_data[i] = commitment root / metadata hash / nullifier state
```

## cell_deps

`cell_deps` allows scripts in the transaction to access referenced live Cells.

These Cells are read-only dependencies.

This is one of the most important pieces because CKB Scripts do not contain executable code directly. A Script references code through `code_hash` and `hash_type`, but the actual code Cell must be made available through dependencies.

My mental model:

```txt
Script    = points to code
cell_deps = brings the referenced code/data Cells into the transaction environment
```

A `cell_dep` can be:

- `code` — load this Cell directly
- `dep_group` — load a group of dependency Cells through one reference

This makes me think of `cell_deps` as the transaction's declared execution context.

A question this raises for me:

```txt
If scripts depend on Cells, how do we reason about dependency availability, code immutability, and upgradeability over time?
```

## header_deps

`header_deps` lets scripts access specific historical block headers.

The important part is determinism. The referenced headers must already exist on-chain, and uncle blocks are excluded as header dependencies.

My interpretation:

```txt
header_deps = deterministic access to selected historical chain metadata
```

This matters because every node verifying the transaction must get the same result. If scripts could depend on uncertain or future chain data, transaction validation could become inconsistent.

This makes me think about how careful blockchain VMs must be with time, randomness, and historical data.

## witnesses

Witnesses are provided by the transaction creator to help scripts pass validation.

Common examples include:

- signature
- unlocking data
- proof data
- hash preimage
- Merkle proof
- serialized custom data

The docs mention that witness data is flexible and can contain any proof data required by the transaction, serialized using Molecule or another custom method.

This is especially interesting from a ZK/privacy perspective.

Important distinction:

```txt
CKB witness = transaction evidence that scripts can read
ZK witness  = private input used off-chain to generate a proof
```

A CKB witness can contain a ZK proof, but it should not contain the private ZK witness unless the design intentionally reveals it.

My privacy rule:

```txt
Put proofs in CKB witnesses.
Do not put raw secrets in CKB witnesses.
```

## WitnessArgs

`WitnessArgs` is a convention for organizing witness data.

It has three optional fields:

- `lock`
- `input_type`
- `output_type`

This is elegant because different scripts run in different contexts:

```txt
Lock Script        -> reads lock witness data
Input Type Script  -> reads input_type witness data
Output Type Script -> reads output_type witness data
```

This prevents scripts from fighting over the same witness bytes.

My mental model:

```txt
WitnessArgs = structured evidence layout for multi-script transactions
```

This becomes more important when a transaction has both Lock Scripts and Type Scripts that need different proof material.

## Raw transaction vs witnesses

A transaction without witnesses is called a Raw Transaction.

The transaction hash is calculated from the raw transaction, while witnesses are used to satisfy script execution and still affect transaction size and fees.

This made me ask:

```txt
What exactly is signed, and what is excluded from the transaction hash?
```

That matters for signature design and transaction malleability.

I now understand why the signature itself cannot simply be part of the exact message being signed in a naive way. Witnesses provide the evidence, while the raw transaction defines the proposed state transition.

## Transaction states

A transaction is not instantly final.

It can move through states such as:

- Pending
- Confirming
- Confirmed
- Conflicting
- Conflictive
- Reverted
- Abandoned

My simplified understanding:

- Pending = created or broadcast but not yet in the canonical chain
- Confirming = included in a block but not deeply confirmed
- Confirmed = included with enough confirmations
- Conflicting = competes with another transaction spending the same Cells
- Reverted = was included, but a chain reorg removed it
- Abandoned = user or app gives up trying to commit it

This reminds me that in PoW-style chains, finality is probabilistic. A transaction appearing in a block is not the same as being deeply settled.

For application developers, this means:

- Do not trust pending outputs too early.
- Do not build long chains of unconfirmed transactions unless necessary.
- Track transaction states carefully.

## Blocks

A block contains:

- header
- transactions
- uncles
- proposals

The block is the container, but the header is the compact consensus-critical summary.

The header includes things like:

- `parent_hash`
- `timestamp`
- `number`
- `epoch`
- `transactions_root`
- `compact_target`
- `nonce`
- `dao`

My mental model:

```txt
block  = transaction container
header = cryptographic + consensus summary of the block
```

## Header verification and PoW

The header verification process checks whether the block satisfies proof-of-work.

Simplified:

```txt
serialize raw header
hash it
append nonce
run Eaglesong
interpret output as an integer
check output <= difficulty target
```

The key idea:

```txt
A valid block must prove miners performed enough computational work.
```

This is how CKB ties block production to external cost.

## Uncle blocks

Uncle blocks happen when two blocks are mined around the same time, but only one becomes part of the main chain.

The other can be referenced as an uncle if it satisfies certain conditions.

My mental model:

```txt
uncle block = valid competing work that did not become the main chain block
```

This matters because networks are not perfectly synchronized. Uncle inclusion acknowledges real work that lost the propagation race.

## Proposals

CKB has a transaction proposal mechanism.

A transaction proposal ID is the first 10 bytes of the transaction hash.

A transaction must be proposed before it can be committed.

On mainnet:

```txt
close = 2
far   = 10
```

So if a transaction is committed in block `c`, it must have been proposed in an earlier block `p` such that:

```txt
2 <= c - p <= 10
```

This is very different from the simpler mental model I have from Ethereum.

My mental model:

```txt
proposal   = transaction is announced as a candidate
commitment = transaction is included in a block
```

This makes CKB's transaction lifecycle feel more staged and consensus-aware.

## Questions I asked while reading

### Why does a transaction need cell_deps if the Script already has code_hash?

Because `code_hash` identifies the code, but `cell_deps` makes the code or data Cell available to the VM.

### Why are dependency Cells read-only?

Because dependencies provide code or data for verification. They should not be consumed or mutated as part of the transaction.

### Why must header_deps point to existing chain headers?

To preserve deterministic validation across all nodes.

### How should I think about witnesses from a ZK perspective?

CKB witnesses are on-chain evidence fields. They can contain proof bytes, but they should not contain private witness data unless revealing it is intended.

### Why separate outputs and outputs_data?

It separates Cell structure from Cell state bytes and likely makes VM/protocol handling cleaner.

### Why does CKB have transaction proposals before commitments?

It creates a staged transaction inclusion process where transactions are first proposed, then committed within a defined window.

## 

After today, I understand a CKB transaction as a full verification package:

```txt
inputs       = Cells I want to consume
outputs      = Cells I want to create
outputs_data = data/state for the new Cells
cell_deps    = code/data dependencies needed by scripts
header_deps  = historical block headers needed by scripts
witnesses    = evidence needed to satisfy scripts
```

The transaction is valid only if:

- the referenced inputs are live
- capacity rules are satisfied
- all required dependencies are available
- all relevant scripts return `0`
- time conditions are met
- the transaction fits consensus and mempool rules

The deeper insight for me is that CKB transactions are not just messages. They are self-declared verification environments.

A transaction declares:

```txt
Here is the old state.
Here is the new state.
Here is the code/data I depend on.
Here is the evidence needed to validate the transition.
Now run the scripts and check if the transition is valid.
```

This is a powerful model for cryptographic applications because it gives a clean place to put commitments, proofs, signatures, and state-transition rules.
