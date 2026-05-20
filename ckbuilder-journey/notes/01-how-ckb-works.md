# Day 1 Notes — How CKB Works

**Date:** Monday, 18 May 2026  
**Focus:** Understanding the CKB mental model: Cells, Scripts, Transactions, CKB-VM, verification, witnesses, and privacy implications.

---

## Why I started here

I started with the `How CKB Works` document because I wanted to understand CKB from first principles before jumping into tutorials.

My goal is to use this as a serious protocol engineering learning path. I am approaching CKB as a ZK / cryptography engineer, so I am trying to understand not only *what* CKB does, but *why* it is designed this way and how its architecture can support custom verification, privacy-preserving primitives, and cryptographic state transitions.

---

## Cells

The first major concept is the **Cell**.

A Cell is the basic unit of state in CKB. The docs describe CKB as a storage facility filled with boxes called Cells. Each Cell can hold CKBytes and data.

A Cell can contain:

- `capacity` — how many CKBytes are locked in the Cell
- `lock` — the Lock Script that controls who can consume/spend the Cell
- `type` — an optional Type Script that controls how the Cell's data/state can change
- `data` — arbitrary bytes stored in the Cell

My current understanding is that a Cell is closer to a programmable state container. It can hold value, data, ownership rules, and optional state-transition rules.

This is very different from the account model I am used to from Ethereum.

In Ethereum, I usually think in terms of:

```txt
address -> balance
contract -> storage
transaction -> function call that mutates state
```

In CKB:

```txt
live cell -> consumed by transaction -> new live cells created
```

So the important shift is this:

CKB does not update a Cell in place. To update state, a transaction consumes existing Cells and creates new Cells with the new state.

## Live Cells vs Dead Cells

A Live Cell is a Cell that has not been consumed yet. It can be used as an input in a future transaction.

A Dead Cell is a Cell that has already been consumed by a transaction. Once consumed, it cannot be spent again.

This reminds me of Bitcoin's UTXO model, where unspent outputs can be spent and spent outputs cannot be reused. But CKB extends this model because Cells are more expressive. A Cell can store data and can be governed by Lock Scripts and Type Scripts.

Example:

Before transaction:

Alice has one live Cell with 200 CKB.

Transaction:

Alice consumes the 200 CKB Cell.

After transaction:

- 100 CKB Cell created for Bob
- 99.999 CKB Cell created as Alice's change
- 0.001 CKB used as transaction fee

The original 200 CKB Cell is now dead. The two output Cells are now live.

## Transactions

A CKB transaction proposes a state transition.

It says:

- Consume these existing live Cells as inputs.
- Create these new Cells as outputs.
- Use these witnesses/signatures/proofs as evidence.
- Run the required scripts to check if this transition is valid.

In Ethereum, I usually think:

```txt
Execute contract code -> update global state
```

In CKB:

```txt
Propose new Cell state -> run scripts to verify if the transition is valid
```

So CKB feels more verification-oriented.

A transaction is a claim that a certain transformation of Cells is valid.

## Lock Scripts

A Lock Script controls whether a Cell can be consumed.

It answers the question:

```txt
Who is allowed to spend or unlock this Cell?
```

For a normal payment Cell, the Lock Script checks whether the person trying to spend the Cell has the correct authority, usually by verifying a cryptographic signature.

The default system Lock Script mentioned in the docs is:

```txt
secp256k1_blake160_sighash_all
```

I broke this down as:

- `secp256k1` — the elliptic curve used for signature verification
- `blake160` — a shortened Blake2b hash of the public key
- `sighash_all` — the signature commits to the full transaction

My current understanding:

1. Alice has a private key.
2. Alice signs the transaction.
3. The signature is placed in the transaction witness.
4. The Lock Script uses the public key/signature to verify that Alice authorized the spend.
5. The public key is hashed using Blake2b and shortened to Blake160.
6. That computed Blake160 value is compared with the value stored in the Cell's `script_args`.
7. If the hash matches and the signature is valid, the script returns `0`.
8. If not, the script returns a non-zero value and the transaction is invalid.

This is basically:

```txt
Does the spender control the private key corresponding to the public key hash stored in this Cell's lock arguments?
```

## Type Scripts

A Type Script is optional, but it is very important for meaningful application state.

A Type Script answers the question:

```txt
Is this state transition allowed?
```

This is different from the Lock Script.

The Lock Script controls ownership/access. The Type Script controls state validity.

A normal CKByte payment Cell may not need a Type Script. It may only need a Lock Script because the only thing being controlled is ownership.

But if a Cell represents a token, credential, identity state, attestation, game state, or application state, then not having a Type Script may be dangerous. Without a Type Script, the chain does not automatically understand what the data means.

For example:

```txt
Cell data: "1000 MYTOKEN"
type: none
```

If there is no Type Script enforcing token rules, then this is just arbitrary data. Someone could create another Cell with:

```txt
Cell data: "999999999 MYTOKEN"
type: none
```

The chain would not automatically know this is invalid unless there is a recognized Type Script enforcing supply/state rules.

## CKB-VM

The CKB-VM is the virtual machine that executes CKB Scripts.

It uses the RISC-V instruction set architecture.

This led me to ask deeper questions:

- What exactly is RISC-V?
- Why is RISC-V popular in cryptography and blockchain systems?
- How is RISC-V different from the EVM?
- What is the difference between RISC-V, CKB-VM, and Ethereum's EVM?

My current understanding:

RISC-V:

A low-level open instruction set architecture. It defines the kind of machine instructions a processor or VM understands.

CKB-VM:

The virtual machine used by CKB to execute Scripts. It implements RISC-V for the CKB environment.

EVM:

Ethereum's blockchain-specific virtual machine with its own bytecode, gas model, account/storage model, and execution rules.

The difference is important.

The EVM is designed around Ethereum's account model and smart contract execution.

CKB-VM is designed around verifying whether proposed Cell transitions are valid.

So Ethereum feels like:

```txt
Run contract code -> mutate account/contract state
```

CKB feels like:

```txt
Propose Cell transition -> run scripts to verify if it is allowed
```

This makes CKB feel closer to a programmable verification environment.

## Syscalls

A syscall is a system call.

In normal computing, a syscall is how a program asks the operating system for something, such as reading a file, accessing memory, or writing output.

In CKB, a Script running inside CKB-VM is isolated. It does not automatically know everything about the transaction. It uses syscalls to ask the CKB environment for data.

Examples from the docs include:

- `ckb_load_cell_data()`
- `ckb_load_witnesses()`

My mental model:

- The script is inside the VM.
- The transaction data is outside the script.
- The script uses syscalls to load the specific data it needs.

For example, if a Lock Script wants to verify a signature, it may need to load witness data.

If a Type Script wants to verify a state transition, it may need to load input Cell data and output Cell data.

So syscalls are the bridge between the isolated script and the transaction/cell environment.

## Witnesses

The word witness immediately made me think of ZK witnesses, so I asked whether CKB witnesses are the same thing as witnesses in zero-knowledge proofs.

My current understanding is:

They are related only in the broad sense that both are "evidence," but they are not the same.

In CKB:

A witness is transaction data provided to satisfy a script.

Examples:

- signature
- public key
- unlocking data
- hash preimage
- Merkle proof
- serialized proof bytes


The key difference:

CKB witness:

Usually transaction data available for scripts to read. It may become public on-chain.

ZK witness:

Private input used off-chain to generate a proof. It is usually not revealed.

However, these ideas can connect.

A CKB witness could contain a ZK proof, while the actual ZK witness remains private off-chain.

That creates a possible privacy design:

```txt
Private data -> used off-chain to generate proof
Proof bytes -> placed in CKB witness
CKB Script -> verifies proof
```

This is very relevant to my long-term interest in privacy-preserving systems.

## Verification Process

The CKB docs compare Bitcoin-style unlocking with CKB-style script verification.

In Bitcoin, a locking script and unlocking script are evaluated using a stack-based model.

In the example:

Locking script:

```txt
OP_ADD <8> OP_EQUAL
```

Unlocking script:

```txt
OP_3 OP_5
```

The unlocking script pushes 3 and 5 onto the stack. The locking script adds them, compares the result with 8, and if the final result is true, the spend is valid.

In CKB, the same idea can be represented with more expressive script logic:

```js
const v1 = load_value1_from_witness();
const v2 = load_value2_from_witness();

const result = v1 + v2;

if (result === 8) {
  return 0;
}

return 1;
```

This helped me understand that CKB Scripts are more flexible than Bitcoin Script because they run in a more general-purpose VM environment.

The main rule:

```txt
return 0     -> script passed
return non-0 -> script failed
```

So if the script checks the witness data and returns 0, the transaction is valid with respect to that script.

## Cycles

Cycles measure the computational cost of executing scripts in CKB-VM.

This is similar in spirit to Ethereum gas, but the model is not exactly the same.

Each VM instruction or syscall consumes cycles. CKB uses cycle limits to prevent malicious or infinite execution.

This matters because CKB-VM is flexible. Scripts can include loops, branches, hashing, signature verification, and potentially more complex cryptographic checks. But this flexibility must be bounded so the network remains safe.

This made me think about future privacy/ZK applications on CKB. If we verify cryptographic proofs inside CKB-VM, we must care about cycle cost.

A privacy-preserving system is not only about correctness. It must also be computationally practical.

## Privacy Questions

As I read the CKB model, I started asking about privacy.

My question was:

```txt
Since CKB is public, can someone map an address or lock script to a person and then track their wallet history?
```

My current understanding is that CKB is public and pseudonymous by default, not private by default.

Because CKB uses a Cell/UTXO-like model, the privacy shape is not identical to Ethereum's account model. Ethereum accounts have persistent addresses and visible account histories, which makes tracking very direct.

CKB may allow more flexible Cell-based patterns, but public data is still public. Observers may still analyze:

- lock script reuse
- transaction inputs and outputs
- Cell data
- witnesses
- timing patterns
- change outputs
- known addresses or exchange flows

This means privacy must be designed intentionally.

Possible privacy patterns on CKB could include:

- storing commitments instead of raw data
- using Merkle roots for membership
- using nullifiers to prevent double claims
- putting proofs, not secrets, into witnesses
- using Type Scripts to enforce privacy-preserving state transitions

This connects directly to the kind of capstone I may want to build later

## What confused me

The main things I had to slow down and question were:

### RISC-V vs CKB-VM vs EVM

I needed to separate the instruction set architecture from the virtual machine that implements it.

RISC-V is the instruction language. CKB-VM is the CKB execution environment using RISC-V. EVM is Ethereum's separate blockchain VM.

### CKB witnesses vs ZK witnesses

I initially related the word "witness" to zero-knowledge proofs.

I now understand that CKB witnesses are transaction fields used by scripts, while ZK witnesses are private inputs used to generate proofs.

A CKB witness can contain a proof, but it is not itself the private ZK witness.

### Optional Type Scripts

I wondered whether optional Type Scripts could be exploited.

My current conclusion is that Type Scripts are optional because not every Cell needs custom state rules.

But if a Cell represents meaningful application state, omitting a Type Script means the chain will not enforce that state's rules.

### Signature hashing

I wanted to understand why `sighash_all` matters.

My understanding is that signing the whole transaction prevents someone from taking a valid signature and attaching it to a different transaction with malicious outputs.

## My current mental model of CKB

My current mental model is:

CKB is a public, proof-of-work, Cell-based blockchain where state lives in Cells. Transactions consume existing Live Cells and create new Live Cells. Scripts run inside CKB-VM to verify whether those Cell transitions are valid. Lock Scripts control who can consume a Cell, while Type Scripts control whether the Cell's state/data transformation is valid.

The most important shift for me is that CKB is about designing verifiable state transitions.

That is why I find it interesting as someone learning ZK and cryptography.

It makes me ask:

- What evidence should be required to consume a Cell?
- What should be stored in Cell data?
- What should be placed in witnesses?
- What should remain private off-chain?
- What should a Lock Script verify?
- What should a Type Script verify?
- Can CKB be used as a flexible environment for privacy-preserving attestations?

My current working thesis:

CKB is interesting because it treats blockchain state as programmable Cells and treats scripts as verification logic. This makes it a powerful environment for experimenting with cryptographic conditions, attestations, and privacy-preserving state transitions.
