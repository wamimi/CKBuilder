# CKBuilder Weekly Report - Week 4

**Name:** Nelly Njeri  
**Week Ending:** 14 June 2026


## 1. Weekly Focus

This week was about moving from reading about CKB scripts to actually writing, compiling, deploying, and interacting with them.

My goal was to stop treating scripts as an abstract concept and understand the full path:

```txt
write Rust script logic
-> compile it into a CKB-VM binary
-> debug the script
-> deploy it to devnet
-> reference it through CellDeps
-> construct a frontend transaction that uses it
-> mint and read a typed Cell
```



The main artifact this week is **Capsule Notes**, a small CKB dApp that mints a note as a typed Cell using a custom Rust Type Script called `capsule-transition-guard`.


## 2. Unblocking the Rust Script Build Pipeline

The first major milestone was unblocking the Rust script build process.

Before this week, I had been stuck on build errors around:

- the RISC-V target
- atomic lowering

The important realization was that the blocker was not the contract logic itself. The contract could not even reach the point of becoming a valid CKB-VM artifact because the build environment was incomplete or misconfigured.

I had to fix the script development toolchain first.

The main fixes were:

- added the `riscv64imac-unknown-none-elf` Rust target
- installed and used newer GNU tooling instead of macOS defaults
- used GNU Make instead of the old macOS `make`
- pointed the build process explicitly to Homebrew LLVM 18
- exported `CLANG`, `AR`, `CC`, and `CXX`
- confirmed the generated Makefile included the atomic lowering flag through `-C passes=lower-atomic`

After fixing the environment, the scripts compiled successfully into `build/release`.

This was a big milestone because it made me understand that CKB script development has two layers:

```txt
1. Write validation logic.
2. Produce a binary that CKB-VM can actually execute.
```



## 3. Practicing With Smaller Scripts

After unblocking the build system, I practiced with smaller scripts to understand different parts of the script execution model.

The first script was a `script-args-inspector`.

Its purpose was to read script arguments and debug them. This helped me understand that a deployed script binary can be reused with different script args, and those args can make different script instances behave differently even when they share the same code.

The second script was a `witness-door-lock`.

This script attempted to read witness data and pass only if the witness matched a specific value. When I ran it directly with:

```bash
ckb-debugger --bin
```

it failed with `IndexOutOfBound` because a bare debugger run does not provide transaction witness data.

That failure was useful.

It clarified the difference between:

```txt
script as standalone binary
script as transaction verifier
```

A script that reads witnesses, inputs, outputs, or Cell data needs transaction context to be meaningful. This reinforced one of the central CKB lessons:

> Scripts are not just programs that run. They inspect a transaction and decide whether that transaction is valid.


## 4. Building capsule-transition-guard

The main script I wrote this week was `capsule-transition-guard`, a Type Script for the Capsule Notes idea.

The project demonstrates how to mint a note as a typed CKB Cell using a deployed Rust Type Script.

The goal was not only to store note data in a Cell. The goal was to move from:

```txt
the frontend says this is a valid Capsule note
```

to:

```txt
protocol logic enforces what a valid Capsule note transition is
```

The script is designed around the CKB Cell model:

- a Capsule can be minted as a new live Cell
- a Capsule can be updated by consuming the old Cell and creating a new Cell
- a Capsule can be archived or burned by consuming the old Cell without replacement
- a valid Capsule must have the correct binary format
- a valid mint must start at version 1
- a valid update must keep the same `capsule_id`
- a valid update must increment the version by exactly 1

The binary layout is:

```txt
[0..10]   magic: CAPSULE_V1
[10..14]  version: u32 little-endian
[14..46]  capsule_id: 32 bytes
[46..]    note body bytes
```

I chose a binary layout instead of JSON because this is closer to how script validation should work. JSON is convenient at the frontend level, but a Type Script should validate a stable byte structure.

That forced me to think more precisely about what the script is checking.

The main rule enforced by the script is that Capsule state should not be mutated in place. It should be recreated through a valid Cell transition.



## 5. Lock Script vs Type Script Became Practical

This week made the Lock Script and Type Script distinction much more concrete.

Before this, I understood the difference theoretically:

```txt
Lock Script = ownership / spending authority
Type Script = state validity
```

Capsule Notes made that separation practical.

The account Lock Script answers:

```txt
Who owns this Cell?
Who is allowed to spend it?
```

The Capsule Type Script answers:

```txt
Is this Capsule state valid?
Is this mint/update/archive transition allowed?
```

This separation became important in the frontend. The UI displayed my account Lock Script, which initially made it look like the wrong script was being used. I later understood that the Lock Script was the account ownership logic, while the Capsule Type Script was attached separately to the output Cell as the `type` field.

A CKB transaction can carry multiple layers of meaning:

```txt
Lock Script -> controls ownership
Type Script -> controls state validity
Cell data -> carries application state
CellDep -> points to deployed script code
```

This feels very different from the Ethereum mental model of contract addresses, ABI calls, and function execution.


## 6. Deploying the Script to Devnet

After the script compiled successfully, I deployed `capsule-transition-guard` to devnet using OffCKB.

The deployment produced:

- a deployment transaction
- `deployment.toml`
- migration JSON
- `deployment/scripts.json`
- `codeHash`
- `hashType`
- `cellDeps`
- deployment OutPoint

This helped me understand what "deployment" means on CKB.

It is not the same as deploying an Ethereum contract and then calling functions through an ABI. In CKB, the script binary is deployed into a Cell. Later transactions reference that deployed script through `cellDeps`.

The deployed script becomes code that future transactions can load during validation.

That made deployment feel much more concrete:

```txt
script binary -> deployed code Cell
code Cell OutPoint -> CellDep
Type Script -> references code hash / hash type
transaction -> includes CellDep so CKB can load the code
```


## 7. Building the Capsule Notes Frontend

After deploying the script, I connected it to a frontend based on the Store Data on Cell pattern.

The frontend now:

1. Takes a private key from an OffCKB devnet account.
2. Derives the account address and Lock Script.
3. Shows the deployed Capsule Type Script.
4. Shows the CellDep used by the transaction.
5. Encodes the Capsule note into the binary format expected by the script.
6. Builds a transaction whose output Cell uses:
   - the user's Lock Script as the lock
   - `capsule-transition-guard` as the type
   - encoded Capsule data as `outputsData`
   - the deployed script Cell as a `cellDep`
7. Sends the transaction to devnet.
8. Reads the minted Capsule Cell back by OutPoint.
9. Decodes and displays the Capsule data on the frontend.

This was one of the biggest learning points of the week because it connected the full flow together.

The frontend successfully minted a Capsule Cell and decoded:

```txt
Magic: CAPSULE_V1
Version: 1
Capsule ID: <32-byte id>
Body: State is not mutated. It is consumed and recreated as a new Cell.
```

That showed the frontend, deployed script, transaction, and Cell data were all connected.



## 8. Debugging Frontend Interaction

The frontend work produced useful debugging moments.

At first, the transaction failed with a CellDep resolution error. The transaction was trying to reference the deployed script OutPoint, but the node could not resolve it.

I verified the deployment Cell directly with `get_live_cell` and confirmed that the Cell existed and was live. This helped me understand that debugging CKB frontend issues often means checking:

- whether the transaction references the correct OutPoints
- whether the deployment Cell is live
- whether the frontend is connected to the same devnet where the script was deployed
- whether `deployment.ts` matches the latest deployed script metadata

Later, after the Capsule minted successfully, reading the raw Cell caused a frontend error because React attempted to `JSON.stringify` an object containing BigInt values.

It was a normal JavaScript serialization issue.

I fixed it by adding a safe JSON stringify function that converts BigInt values to strings before rendering them.



## 9. Technical Lessons

This week gave me a much better practical understanding of CKB script development.

The main technical lessons:

- CKB scripts are transaction verifiers, not ordinary programs.
- Scripts return `0` for success and non-zero values for failure.
- A script that reads transaction fields needs transaction context.
- `ckb-debugger --bin` is useful, but not enough for every script.
- Type Scripts define what a valid Cell transition means.
- Lock Scripts and Type Scripts separate ownership from state validity.
- Deployment on CKB produces script metadata that future transactions must reference.
- A frontend does not "call" a CKB script the way Ethereum calls contract functions.
- A frontend interacts with a script by constructing a transaction that uses the script in a Cell.
- CellDeps are essential because they tell CKB where to load the script binary from.
- Output Cell data should be treated as state that can be validated by scripts.
- The Cell model forces state transitions to be explicit.



## 10. ZK Reflections

I continued reading Justin Thaler's book on zero-knowledge proofs this week, but my main focus was CKB scripting and script interaction.

The ZK connection stayed in the background.

The more I write scripts, the more I see them as verifiers of constraints. A Type Script checks whether a transaction satisfies a set of rules. In ZK, a verifier checks whether a proof satisfies a set of constraints without revealing everything behind it.

They are not the same thing, but the mental model overlaps:

```txt
desired rule -> precise constraint -> verifier checks accept/reject
```

For Capsule Notes, the rule is simple:

```txt
A valid Capsule mint must start at version 1.
A valid Capsule update must keep the same capsule_id.
A valid Capsule update must increment the version.
```

In a future version, this kind of state-transition logic could become more privacy-preserving. Instead of revealing all note content, a user could prove something about a note or state transition while keeping part of the data private.

I am not there yet, but the scripting work this week gave me a better foundation for eventually thinking about ZK verification on CKB.



## 11. Article Progress

I also continued working on the article idea based on my CKB learning journey.

The article is less of a tutorial and more of a reflection on how CKB changed my Ethereum-shaped mental model.


The article will focus on the friction of coming from Ethereum's account model into CKB's Cell model, and how concepts like capacity, Lock Scripts, Type Scripts, CellDeps, and explicit state transitions forced me to think differently.



## 12. Repository Evidence

As evidence of the work completed in Week 4, the `week-04` experiment directory now contains two main folders:

```txt
capsule-notes
template-retry
```


The `template-retry` folder contains the Rust script workspace where I generated, edited, compiled, debugged, and deployed the CKB scripts. This includes the smaller practice scripts and the main `capsule-transition-guard` Type Script.

The `capsule-notes` folder contains the frontend dApp. This is where I connected the deployed `capsule-transition-guard` script to a working UI. The frontend shows the account Lock Script, deployed Capsule Type Script, CellDeps used in the transaction, and decoded Capsule Cell after minting.



This week made me much more confident with writing, deploying, and interacting with CKB scripts. More importantly, it made the Cell model feel practical:

> State is not mutated in place. State is consumed, recreated, and validated through scripts.
