# Core Structures: Cells, Capacity, and Scripts

**Focus:** Understanding the internal structure of Cells and Scripts, and how CKB locates and executes verification logic.



## Why this section matters

Today's reading moved me from the general idea that "CKB uses Cells" to a more precise question:

```txt
What exactly is inside a Cell, and how does CKB know which rules apply to it?
```

This matters because CKB does not feel like a chain where the main mental model is "call a contract and mutate storage." It feels more like a programmable verification layer where state is stored in Cells, and scripts define the conditions under which that state can be consumed or transformed.

That shift is important for the kind of engineering I want to grow into. If I want to understand protocol design, ZK systems, attestations, and custom verification logic, then I need to understand not just how to use CKB, but how CKB gives meaning to state.

## Cell structure

A Cell is the smallest unit of state in CKB.

My simplified model:

```txt
Cell = value-bearing state box
```

A Cell has four main parts:

- `capacity`
- `lock`
- `type`
- `data`

How I currently understand each part:

- `capacity` defines how much CKB is locked in the Cell and how much storage space the Cell is allowed to occupy.
- `lock` defines who can consume the Cell.
- `type` optionally defines the rules for how the Cell's state can transform.
- `data` stores arbitrary bytes or application state.

This is different from Ethereum's account model. In Ethereum, state usually lives inside contract storage. In CKB, state lives directly in Cells, and transitions happen by consuming old Cells and creating new Cells.

The question I keep coming back to is:

```txt
If state lives in Cells, what gives that state meaning?
```

My answer after today is:

```txt
The meaning comes from the scripts and from the ecosystem's agreement to recognize those scripts.
```

## Capacity

Capacity is not only a token balance. It is also a storage right.

The rule I am holding in my head is:

```txt
occupied capacity <= cell capacity
```

This means a Cell must contain enough CKB to pay for the space occupied by its own fields and data.

My interpretation:

```txt
Capacity makes on-chain state economically scarce.
```

This connects to CKB's decentralization thesis. If every piece of state must be backed by CKB capacity, developers are discouraged from storing unnecessary data forever. That matters because uncontrolled state growth can make full-node verification harder over time.

This also changed how I think about "storage" on-chain. In CKB, storing data is not just a developer convenience. It has an economic cost and a protocol-level constraint.

## Script vs Code

One of the most important distinctions from today is that a Script is not the same thing as code.

A Script is a data structure:

```txt
code_hash
hash_type
args
```

The actual executable code is a RISC-V binary stored elsewhere, usually in a code Cell.

So my current distinction is:

```txt
Code   = executable RISC-V binary
Script = reference to code + parameters
```

This matters because the transaction must provide the code dependency through `cell_deps`. The Script tells CKB how to find and execute the correct code.

My mental model:

```txt
The Script says:
"Run this code, located using this hash method, with these arguments."
```

This is a powerful separation, but it also creates security questions. If Scripts reference code instead of containing code directly, then developers need to reason carefully about code location, code identity, and code upgradeability.

## Lock Script

A Lock Script controls ownership and access.

It answers:

```txt
Who is allowed to consume this Cell?
```

A typical Lock Script verifies signature information provided in the witness against the expected public key hash stored in the script arguments.

My simplified model:

```txt
script_args = expected owner identity / public key hash
witness     = signature or unlocking evidence
lock code   = verification logic
```

If verification passes, the script returns `0`. If it fails, the transaction is invalid.

This made ownership feel less like a fixed account property and more like a condition that must be satisfied at the moment a Cell is consumed.

## Type Script

A Type Script controls state transition rules.

It answers:

```txt
Is this state transformation valid?
```

This is optional because not every Cell represents application state. A simple CKByte payment Cell may only need a Lock Script.

But if a Cell represents a token, credential, attestation, DOB, or application state, then a Type Script becomes important because it protects the meaning of the data.

My key takeaway:

```txt
Lock Scripts protect ownership.
Type Scripts protect meaning.
```

Without a Type Script, Cell data is just bytes. With a Type Script, the data can become protocol-governed state.

This is one of the most important security ideas I am taking from Day 2. If a developer stores meaningful state without a Type Script, then the chain does not automatically enforce the rules that make that state meaningful.

## Lock Script vs Type Script

The distinction I am using:

Lock Script:

- required
- runs on inputs
- checks whether a Cell can be consumed
- mainly about ownership and access

Type Script:

- optional
- runs on both inputs and outputs
- checks whether state transitions are valid
- mainly about application logic and state meaning

This distinction matters for tokens.

If Alice has a UDT Cell and wants to send tokens to Bob, the Lock Script checks whether Alice is allowed to spend her input Cell. The Type Script checks whether the token transition is valid, such as whether input token amount equals output token amount unless minting or burning is allowed.

This helped me understand why Type Scripts run on both inputs and outputs:

```txt
State validity requires comparing old state and new state.
```

## code_hash and hash_type

`code_hash` identifies the script code, but `hash_type` tells CKB how to interpret that hash when locating the code Cell.

My current understanding:

```txt
data/data1/data2 = locate exact code by data hash
type             = locate code through a Cell's Type Script hash
```

This creates an important trade-off:

```txt
data hash = immutability and reproducibility
type hash = upgradeability and flexibility
```

The security question this raises is:

```txt
If my script uses an upgradeable code reference, who controls the upgrade path?
```

This feels important because upgradeability can become an attack surface. If code can be replaced, users need to understand the upgrade policy and trust assumptions.

My current view is that code upgradeability is not automatically good or bad. It is a design choice. The important thing is whether users and applications can reason clearly about what can change, who can change it, and how that change is enforced.

## script_args

`script_args` are the parameters passed into a Script.

In CKB, public key information is conventionally stored in `script_args`, while signatures are usually placed in witnesses.

This separation is interesting:

```txt
args    = what the Cell expects
witness = what the spender provides
script  = logic that checks whether the evidence satisfies the expectation
```

Unlike normal UNIX programs, CKB Scripts do not receive arguments through `argc` / `argv`. They must load script arguments through CKB syscalls.

This reinforces that CKB scripts run in an isolated VM environment and explicitly load what they need.

## Script Group Execution

Script Group Execution was one of the most interesting concepts from today's reading.

CKB groups inputs that have the same Lock Script and runs that Lock Script once for the group instead of once for every Cell.

For Type Scripts, CKB groups both inputs and outputs that share the same Type Script.

My mental model:

```txt
Instead of verifying each Cell in isolation,
CKB verifies groups of Cells governed by the same script.
```

This is efficient because it avoids repeated execution. It is also powerful because many rules need to compare multiple Cells in the same group.

For example, a token Type Script may need to compare all input token Cells with all output token Cells to ensure that token balances are preserved.

This makes Type Scripts feel like state-transition validators over Cell groups, not just isolated checks.

## Example Cell models

General Cell:

```txt
Cell
├── capacity: 100 CKB
├── lock: Alice's ownership rule
├── type: optional UDT or attestation rule
└── data: encoded state bytes
```

Normal payment Cell:

```txt
type = null
data = empty
```

Token Cell:

```txt
type = token rule
data = token amount
```

Possible future privacy attestation Cell:

```txt
type = attestation state transition rule
data = commitment / nullifier state / metadata hash
```

## Questions I asked while reading

### If Type Scripts are optional, what prevents malicious state changes?

My current answer: nothing automatically protects arbitrary data. If the data represents meaningful state, it needs a Type Script, or ecosystem tooling must refuse to recognize it as valid.

### If a Script points to code instead of containing code, how does CKB know what code to run?

Through `code_hash`, `hash_type`, and `cell_deps`.

### What is the security difference between immutable code references and upgradeable code references?

Data hash gives stronger reproducibility. Type hash gives upgradeability, but that upgradeability requires careful governance and clear trust assumptions.

### Who controls upgrades when code is referenced through a Type Script?

This is one of the questions I want to keep investigating. Upgradeability means I need to understand who controls the code Cell, how uniqueness is established, and what prevents unexpected replacement or ambiguity.

### Why do Type Scripts run on outputs too?

Because state transition rules must validate the new state being created, not just the old state being consumed.

### Why does Script Group Execution matter?

It makes verification more efficient and allows scripts to reason about groups of related Cells, which is essential for tokens and state machines.

## 

CKB's Cell model is not just a UTXO model with extra data. It is a programmable state model where each Cell can carry value, data, ownership rules, and optional state-transition rules.

The most important distinction I learned today is:

```txt
Lock Script = authorization
Type Script = state validity
```

The most important architectural insight is:

```txt
Script does not contain code.
Script references code.
```

This means CKB separates:

- state
- code references
- code storage
- verification arguments
- witness evidence

That separation makes CKB feel very flexible, but it also demands careful thinking from developers. If a developer gets the script references, Type Script rules, or upgrade path wrong, they may accidentally create weak or meaningless state.

For my longer-term privacy/ZK interests, this is exciting because it suggests a design space where:

- Cell data stores commitments or state roots
- witnesses provide proofs or evidence
- Type Scripts verify valid state transitions
- Lock Scripts control who can consume or update Cells

This could become the foundation for a privacy-preserving attestation system.
