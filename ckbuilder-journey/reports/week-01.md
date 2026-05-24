# CKBuilder Weekly Report — Week 1

**Name:** Nelly Njeri  
**Week Ending:** 24 May 2026  

---

## 1. Weekly Focus

This week I intentionally focused on theory, protocol mental models, and tooling orientation before jumping into building.
I wanted to understand CKB from first principles: how it models state, how transactions are verified, how scripts enforce ownership and state validity, and how this differs from the Ethereum account model I am already familiar with.

The main question guiding my week was:

> What does it mean to build applications on a blockchain where state is not stored in accounts, but in Cells that are consumed, recreated, locked, typed, and verified?

This week was therefore mostly about building the prerequisites I need rather than only following instructions mechanically.

## 2. Work Completed

This week I studied and documented the foundational CKB concepts that will support my practical building work going forward.

I covered:

- CKB's Cell model
- Live Cells and Dead Cells
- Capacity as both token value and storage right
- Transactions as Cell state transitions
- Lock Scripts and Type Scripts
- CKB-VM and RISC-V
- Witnesses and syscalls
- Script structure: `code_hash`, `hash_type`, and `args`
- Script Group Execution
- Transaction anatomy: `inputs`, `outputs`, `outputs_data`, `cell_deps`, `header_deps`, and `witnesses`
- Blocks, headers, uncle blocks, proposals, and transaction lifecycle
- OffCKB, CCC, CCC Playground, JoyID, and CKB-CLI at a beginner workflow level

I also set up and explored the tooling needed for practical work:

- Installed and ran OffCKB
- Started a local CKB devnet
- Inspected OffCKB system scripts
- Inspected OffCKB devnet/testnet/mainnet configuration
- Connected CCC Playground to a JoyID testnet wallet
- Claimed public testnet CKB
- Modified the default CCC Playground starter code
- Rendered a staged testnet transfer transaction

I also opened a PR to the Nervos docs repository to update the screenshot in the CCC Playground preview image cause the one in the docs is outdated.

```txt
https://github.com/nervosnetwork/docs.nervos.org/pull/802


## 3. Why I Started With Theory

I started with theory because CKB has a very different mental model from Ethereum.

In Ethereum, I am used to thinking in terms of:

```txt
accounts -> balances -> contract storage -> function calls -> state mutation
```

While in CKB:
```txt
live cells -> transaction consumes cells -> scripts verify validity -> new cells are created
```

The most important mental shift this week was realizing that a CKB transaction is not simply "code execution." It is closer to a state transition proposal. The transaction declares old state, new state, dependencies, and witness evidence. Then CKB-VM executes scripts to verify whether the proposed transition is valid.

My current mental model is:

> CKB is a verification-oriented blockchain where state lives in Cells. Transactions consume existing Live Cells and create new Live Cells. Lock Scripts verify ownership, while Type Scripts verify whether state transitions are valid.

This model feels especially relevant to my interests in ZK, cryptography, attestations, and privacy-preserving systems, because many cryptographic protocols are also built around the idea of proving that a transition is valid without exposing unnecessary information.


## 4. Key Realizations

### 4.1 A Cell Is Not Just a Balance

A Cell is not merely a container for CKB value.

A Cell can carry:

```txt
capacity + ownership rules + optional state rules + data
```

So I started thinking of a Cell as a programmable state box.

The capacity field was especially interesting because it represents both CKB token value and storage rights. This means CKB makes on-chain state economically scarce. That connects directly to CKB's decentralization philosophy: if state growth is not controlled, running full nodes becomes harder over time.

### 4.2 Lock Scripts and Type Scripts Separate Ownership From Meaning

Another important realization was the distinction between Lock Scripts and Type Scripts.

My simplified model is:

```txt
Lock Script = who can consume this Cell?
Type Script = is this state transition valid?
```

This distinction helped me understand why Type Scripts matter so much for application logic.

Without a Type Script, Cell data is just bytes. With a Type Script, Cell data can become meaningful protocol state.

This raised an important security question for me:

> If Type Scripts are optional, what prevents malicious or meaningless state transitions?

My current understanding is that CKB does not automatically protect arbitrary Cell data. If a Cell represents meaningful application state, then that meaning must be protected by a Type Script or by application-level rules that refuse to recognize invalid Cells.


### 4.3 Scripts Reference Code Instead of Containing Code

I also learned that a Script is not the executable code itself.

A Script contains:

```txt
code_hash
hash_type
args
```

The actual executable code is stored elsewhere, usually in a code Cell, and the transaction makes it available through `cell_deps`.

This helped me understand why `cell_deps` exists. The `code_hash` identifies the code, but `cell_deps` brings the referenced Cell into the transaction's readable environment.

That gave me another important security question:

> If a Script points to code instead of containing code, how do we reason about code immutability, upgradeability, and who controls the upgrade path?

### 4.4 Transactions Are Self-Declared Verification Environments

Before this week, I would have described a transaction as something that sends value or calls a smart contract.

After studying CKB, I now think of a transaction as a self-declared verification environment.

A transaction declares:

- these are the Cells I want to consume
- these are the Cells I want to create
- this is the output data for the new Cells
- these are the code/data dependencies my scripts need
- these are the historical headers my scripts may read
- this is the witness evidence needed for verification

Then the network verifies whether the transition is valid.

This model is very elegant because it makes the transaction explicit about its dependencies and evidence.

It also made me think about ZK systems:

```txt
private computation happens off-chain
proof/evidence is submitted on-chain
script verifies whether the transition is valid
```

That structure feels very compatible with privacy-preserving applications.

### 4.5 CKB Witnesses Are Not the Same as ZK Witnesses

Because I am interested in zero-knowledge proofs, I paid attention to the word "witness."

I had to separate two meanings:

```txt
CKB witness = transaction evidence that scripts can read
ZK witness  = private input used off-chain to generate a proof
```

This distinction matters.

A CKB witness can contain a signature, unlocking data, a Merkle proof, or even ZK proof bytes. But private ZK witness data should not be placed directly into a public CKB transaction unless the protocol intentionally reveals it.

My current rule is:

> Put proof bytes in CKB witnesses. Do not put raw private ZK witnesses on-chain.

This is one of the areas I want to explore more deeply as I continue learning CKB.


## 5. Practical Tooling Work

After the theory sections, I moved into tooling.

I explored OffCKB as the local development environment and CCC as the modern JavaScript/TypeScript SDK and wallet connector.

I started a local OffCKB devnet and confirmed the RPC proxy server was running at:

```txt
http://127.0.0.1:28114
```

I also ran:

```sh
offckb system-scripts --export-style ccc
offckb config list
```

This helped me connect earlier theory to actual tooling. For example, the system script output showed real `codeHash`, `hashType`, `cellDeps`, and `depType` values for scripts like:

- `Secp256k1Blake160`
- `Secp256k1Multisig`
- `AnyoneCanPay`
- `OmniLock`
- `XUdt`
- `TypeId`

Seeing those values in a real devnet context made the earlier docs feel much more practical.



## 6. CCC Playground Experiment

The most practical part of my week was modifying and running the CCC Playground starter transaction.

I connected CCC Playground to my JoyID testnet wallet, claimed public testnet CKB, and replaced the default receiver address with my own JoyID testnet address:

```txt
ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq9cfacde2pa83vzkmdh0appnzmf473dnwclz7rv7
```

Then I ran the transaction composition flow and observed the transaction being rendered in stages which made the Cell model practical for me.

The transaction did not subtract from an account balance. Instead, CCC selected a live Cell, created a receiver output, created a change output, and paid the fee from the difference between total input capacity and total output capacity.

I also noticed that the transaction hash changed at each stage:

```txt
Initial skeleton: 0x7a23acde50ee4315a9dbd046d59676d6d86d0f53f7c451221cb47557039837d8
After inputs:     0x1f05f245f18257a6fb27dc7d573944c3aceab4d94bf28f733418ae49c9728a25
After fee:        0x27b2e6da47b7b9f4924618327f26bfce71da4b72ae5ef74eada09f8e729bc5fe
```

That was a useful cryptographic observation:

> If the transaction structure changes, the transaction hash changes.

This connected back to my questions about what exactly gets signed, why `sighash_all` matters, and why transaction construction has to be finalized before signing.

I did not broadcast the transaction because the playground code did not call:

```ts
await signer.sendTransaction(tx);
```

So this was a transaction composition and rendering experiment, not a submitted transaction.

## 7. Questions I Explored

These were the most important questions I asked while studying this week:

- What is RISC-V, and why would a blockchain choose a RISC-V-based VM?
- How is CKB-VM different from RISC-V as an instruction set?
- How is CKB-VM different from Ethereum's EVM?
- What exactly happens during CKB transaction verification?
- What is a syscall, and how does a script load Cell or Witness data?
- Are CKB witnesses similar to ZK witnesses?
- How does `secp256k1_blake160_sighash_all` verify ownership?
- Why does `sighash_all` matter for preventing signature misuse?
- If Type Scripts are optional, what prevents invalid or malicious state transitions?
- How does CKB locate executable code if a Script does not contain the code itself?
- What is the difference between immutable code references and upgradeable code references?
- Who controls upgrades when `hash_type` is `type`?
- Why do Type Scripts run on both inputs and outputs?
- Why does a transaction need `cell_deps` if the Script already has `code_hash`?
- How should CKB witnesses be understood differently from private ZK witnesses?
- Why does CKB separate `outputs` and `outputs_data`?
- What does transaction finality mean in a PoW system?
- Why does CKB use a proposal-before-commitment transaction flow?
- What does privacy realistically look like on a public Cell-based blockchain?
- How could CKB support privacy-preserving attestations, commitments, or proof-carrying state transitions?

These questions helped me avoid passive reading. I was constantly relating CKB back to systems I already know, especially Ethereum and ZK protocols.


## 8. ZK, Privacy, and Cryptography Reflections

One of the most exciting parts of this week was realizing that CKB's architecture may be very interesting for cryptographic applications.

Because CKB is verification-oriented, it naturally made me think about systems where computation or sensitive logic happens off-chain, while the chain verifies a compact piece of evidence.

For example, a privacy-preserving attestation system on CKB could potentially use:

```txt
Cell data = commitment, state root, nullifier set, or metadata hash
Witness = proof bytes or verification evidence
Type Script = state transition verifier
Lock Script = authorization or spending condition
```

This is still only an early mental model, but I can already see a possible direction:

> Use CKB Cells to hold commitment-based state, then use Type Scripts to verify valid transitions without exposing all private information.

I am especially interested in how CKB could support:

- privacy-preserving attestations
- proof-carrying Cell transitions
- nullifier-based anti-double-spend logic
- commitment-based state
- ZK proofs passed through witnesses
- applications where the chain verifies validity without learning unnecessary user data

I also became more aware of the limits of privacy on public blockchains. CKB does not automatically make transactions private. Cells, transactions, scripts, and witness data can still be public. So privacy would need to be intentionally designed at the application layer.



Some open questions I want to continue exploring:

- How exactly do Type ID, `hash_type`, and `cell_deps` interact in real applications?
- What are the security trade-offs between immutable code references and upgradeable code references?
- What exactly is signed in a CKB transaction, especially when witnesses are involved?
- How should dApps handle CKB's proposal-before-commitment transaction lifecycle?
- What does good UX look like when transactions pass through pending, proposed, confirming, and confirmed states?
- How can a CKB application avoid exposing private information in public witnesses?
- What is the best pattern for proof-carrying transactions on CKB?
- What are realistic privacy primitives that can be built on top of public Cells?

## 9. Documentation Contribution Observation

## Documentation Contribution

While exploring the CCC Playground documentation, I noticed that the documentation screenshot appeared different from the current live playground UI.

I opened a PR to the Nervos docs repository:

```txt
https://github.com/nervosnetwork/docs.nervos.org/pull/802

## 11. Repository Structure and Evidence

I organized my CKBuilder journey into a GitHub-ready structure:

```txt
ckbuilder-journey/
  README.md
  reports/
    week-01.md
  notes/
    01-how-ckb-works.md
    02-core-structures.md
    03-transaction-anatomy.md
    05-tooling-log.md
  experiments/
    day-04-ccc-playground-transfer.ts
    day-04-playground-observations.md
  screenshots/
    week-01/
```

Evidence prepared is in the screenshots folder screenshots/week-01

## 12. Plan for next week starting May 24

Next week, I want to move from understanding the model to building small practical experiments on top of it.
