# CKBuilder Weekly Report - Week 3

**Name:** Nelly Njeri  
**Week Ending:** 7 June 2026  
**Repository:** `ckbuilder-journey`

## 1. Weekly Focus

This week, my focus moved from CKB's high-level concepts into the scripting layer.

In the first two weeks, I built the foundation. This week, my curiosity was on:

> What does it actually mean to write verifier logic for CKB?

That led me into scripting documentation, `ckb-std`, Rust tooling, the CKB script build/debug workflow, and a follow-up investigation of my Week 2 simple-lock blocker.

I also spent time reading Justin Thaler's *Proofs, Arguments, and Zero-Knowledge*. That reading is directly connected to the kind of work I want to eventually do on CKB: proof-carrying Cells, private attestations, commitment-based state, and Type Scripts that validate cryptographic state transitions.

## 2. Resources and Work Covered

This week I worked through or reviewed:

- CKB Academy beginner materials.
- CKB documentation on scripts and Rust development.
- `ckb-std` runtime and API concepts.
- Rust SDK examples
- CKB script build and debug workflow.
- Type ID and upgradeability concepts.
- Justin Thaler's *Proofs, Arguments, and Zero-Knowledge*.
- Rust refresher material to strengthen the language foundation needed for CKB scripting.

 I want Rust to be my main CKB scripting path. If I want to build serious CKB scripts, cryptographic verifiers, or proof-related applications, I need stronger Rust foundations, especially around `no_std`, cross-compilation, dependency graphs, allocators, feature flags, and debugging.


## 3. Main Technical Learning: CKB Scripts as Verifiers

The most important mental shift this week was understanding CKB scripts as verifier programs.

A CKB Script is a binary executable that runs inside CKB-VM during transaction validation.

My current model is:

```txt
CKB Script = deterministic verifier program
return 0 = accept
return non-zero = reject
```

That made the Lock Script and Type Script distinction sharper:

```txt
Lock Script = Are you allowed to spend this Cell?
Type Script = Is this state transition valid?
```

The execution model also became clearer:

```txt
Input Lock Scripts execute.
Input Type Scripts execute.
Output Type Scripts execute.
Output Lock Scripts do not execute.
```

That distinction matters.

A Lock Script protects the right to consume an existing Cell, so it makes sense that it runs when a Cell appears as an input. A Type Script defines state transition rules, so it must be checked when old state is consumed and when new state is created.

This changed how I think about CKB transactions:

> A CKB transaction is a proposed state transition that must be accepted by the relevant verifier programs.

That is the model I want to keep building on.


## 4. ckb-std as the Runtime Surface of a CKB Verifier

One of the most interesting things I studied this week was `ckb-std`.

My current understanding is:

CKB scripts run in a constrained environment. There is no normal operating system, no ordinary standard library runtime, no normal I/O, and no default assumption that the script behaves like a desktop/server Rust program.

A normal Rust program feels like:

```txt
main()
-> standard library runtime
-> operating system services
```

A CKB Rust script feels more like:

```txt
_start
-> ckb_std::entry!(program_entry)
-> CKB-VM
-> syscalls into transaction data
```

The parts of `ckb-std` I mapped this week:

```txt
entry!              -> defines the script entry point
default_alloc!      -> provides allocation support in no_std Rust
syscalls            -> raw communication with CKB-VM
high_level APIs     -> Rust-style wrappers over syscalls
SysError            -> structured error handling
debug! / logger     -> script observability
type_id utilities   -> singleton identity validation
spawn / IPC         -> modular cross-script execution
dummy_atomic        -> compatibility support for Rust code using atomics
```


## 5. Syscalls: What a Script Can See

The syscall section was especially important because it answered this question:

> What can a CKB verifier actually read?

A CKB script does not have unrestricted access to the world. It runs inside CKB-VM and reads allowed transaction data through syscalls.

In Week 2, I inspected transactions externally using RPC calls like `get_transaction` and `get_live_cell`.

This week, I started understanding how scripts inspect the transaction internally while validating it.

Important syscall / high-level API ideas I focused on:

```txt
load_script        -> read the currently running Script
load_tx_hash       -> read the transaction hash
load_script_hash   -> read the current Script hash
load_cell_data     -> read Cell state bytes
load_witness       -> read witness data
load_witness_args  -> read structured witness arguments
load_cell_capacity -> read capacity
QueryIter          -> iterate through transaction inputs/outputs
```

The verifier model is:

```txt
A transaction supplies:
- input Cells
- output Cells
- witnesses
- cell dependencies
- headers where needed

A script reads selected pieces through syscalls.
The script checks a relation.
The script returns 0 or an error.
```

This is close to the way I think about proof systems. A verifier does not need to know everything. It needs the right public inputs, the right proof material, and the correct verification rule.



## 6. Open-Source Documentation Observation

While testing the Rust SDK Parse Address example, I found a small documentation issue from actual use.

The example worked after I made it runnable in a fresh Rust project by adding the required direct dependency and placing the snippet inside fn main().

I submitted this as a docs PR:

https://github.com/nervosnetwork/docs.nervos.org/pull/821

## 7. Rust Script Build Attempt and Toolchain Blocker

While building one of my contracts, I hit a deeper build error inside `bytes v1.11.1`:

```txt
rustc-LLVM ERROR: Cannot select ... AtomicLoadAdd ...
error: could not compile `bytes` (lib)
```

I inspected the dependency path and found:

```txt
ckb-std v1.1.0
└── molecule v0.9.2
    └── bytes v1.11.1
```

I tried the documented `dummy-atomic` direction:

```toml
ckb-std = { version = "1.1", features = ["dummy-atomic"] }
```

and also tried adjusting Molecule features:

```toml
molecule = { version = "0.9.2", default-features = false, features = ["bytes_vec"] }
```

but the `AtomicLoadAdd` error persisted.


## 8. Type ID, Spawn, and Modular Verifier Thinking

I also spent time thinking about Type ID.


```txt
data hash -> exact bytes
script hash -> exact Script structure
type hash -> reference through Type Script
Type ID -> uniqueness / singleton identity
```

This matters for upgradeability and long-lived protocol state.

If I eventually build a ZK or attestation system on CKB, I may need stable identities for:

```txt
verifier configuration Cells
issuer registry Cells
attestation type Cells
proof-system parameter Cells
upgradeable script references
```

The security question is:

```txt
Who controls the upgrade path?
```

Upgradeability is useful, but it belongs inside the trust model. Users should understand whether a script reference is immutable, admin-upgradable, constrained by a Type Script, or governed by a clearer upgrade policy.

I also read about `spawn` and IPC at a high level. The advanced idea that stood out is that CKB scripts can become modular


## 9. ZK Reflection: Thaler's Book and CKB

A major part of my week was reading Justin Thaler's *Proofs, Arguments, and Zero-Knowledge*.

The main connection is the verifier model.

In proof systems, the verifier does not recompute everything. The verifier checks a structured claim using public inputs, proof material, commitments, randomness, or queries.

In CKB, a script also does not act like a full application server. It runs as a constrained verifier. It reads limited public transaction data through syscalls, reads witness material, checks a relation, and returns accept or reject.

My bridge model is:

```txt
CKB Script = deterministic on-chain verifier
Syscalls = controlled access to public transaction data
CKB witness = public transaction evidence
ZK witness = private data used off-chain by the prover
Type Script = state transition verifier
```

A privacy-preserving design on CKB would look like:

```txt
private data stays off-chain
proof is generated off-chain
proof bytes / public inputs go into witness
commitments or state roots go into cell.data
Type Script verifies the transition
```

The parts of Thaler's book that feel especially relevant are:

```txt
Definitions and technical preliminaries
-> helps me reason about what a verifier accepts or rejects

Interactive proofs and Sum-Check
-> helps me understand verification as a structured checking process

Fiat-Shamir
-> relevant because blockchain verification usually needs non-interactive proof objects

Front ends
-> important because high-level statements must become verifier-friendly representations

Zero-Knowledge
-> directly relevant to deciding what must remain hidden

Sigma protocols and commitments
-> connects to hash-locks, except a better design proves knowledge instead of revealing the secret

Polynomial commitments
-> relevant for commitments, openings, verifier costs, and proof-system tradeoffs

SNARK composition and recursion
-> long-term relevant if CKB becomes a settlement or verification layer for proofs generated elsewhere
```

The design question I am carrying forward is:

> Can a CKB Type Script enforce a valid state transition where the public Cell data is only a commitment to private state?

That question feels like the bridge between CKB and ZK.


## 10. Noir-to-CKB Verifier Thought

My ZK reading also made me think about Noir.

In Ethereum, Noir can compile a circuit and eventually produce a Solidity verifier contract for the EVM. That made me ask:

> What would the CKB equivalent look like?

A possible path would be:

```txt
Noir circuit
-> proof system backend
-> proof + verification key
-> CKB-compatible verifier script
-> verifier script deployed as a code Cell
-> proof/public inputs supplied through witness or Cell data
-> Type Script verifies proof and state transition
```

The important part is that a CKB-native proof verifier should not just verify a proof in isolation. It should connect proof validity to Cell state.

A CKB-native ZK application should look more like:

```txt
input Cell commitment/state
+ witness proof/public inputs
+ Type Script verifier
= valid output Cell transition
```

That is why I want to understand CKB scripts deeply before attempting a ZK integration.