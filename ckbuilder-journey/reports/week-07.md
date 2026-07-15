# CKBuilder Weekly Report - Week 7

**Name:** Nelly Njeri  
**Week Ending:** 12 July 2026 

## 1. Weekly Focus

Week 7 began the ZK interoperability phase of my CKBuilder journey.

The path into this project has been gradual. In Weeks 1 and 2, I was still translating my Ethereum mental model into CKB: accounts became live Cells, contract calls became transaction proposals, and state mutation became the consumption and recreation of typed Cells. In Week 3, I moved below the SDK layer and began treating Rust scripts as deterministic verifiers running inside CKB-VM. In Week 4, I built and deployed `capsule-transition-guard`, my first custom Type Script. In Week 5, I made the transaction visible through Capsule Transaction Inspector. In Week 6, I replaced Capsule's hand-rolled byte format with a Molecule schema shared by the frontend and the on-chain reader.

Those six weeks changed how I think about smart-contract systems. I no longer see CKB as an account platform with unusual syntax. I see it as a system where a transaction proposes a state transition and scripts decide whether that transition is valid.

That verifier-oriented model connects naturally to my existing interest in Noir and zero-knowledge proofs. This week, I started a new standalone research project called `noir-ckb-verifier` and began asking how a Noir-authored statement could eventually authorize a CKB Cell transition.

The next question was:

> What does it take to compile a Noir circuit and eventually verify its proof as part of a typed CKB Cell transition?

My first mental model was too compressed:

```text
Noir circuit
-> generate proof
-> place proof in a CKB witness
-> verify it with a Type Script
```

The real boundary has more layers:

```text
Noir source and ABI
-> version-sensitive ACIR artifact
-> execution witness
-> selected proving backend
-> proof-system-specific proof, VK, and public inputs
-> cross-library cryptographic serialization
-> Molecule wire objects
-> CKB-VM verification
-> application-specific Cell transition binding
```

My Week 7 milestone was therefore not to complete the full bridge. It was to make both endpoints concrete, create an independent implementation repository, produce and inspect a minimal Noir artifact, and reproduce the existing CKB Groth16 verifier endpoint with retained evidence.

## 2. A Standalone Interoperability Repository

I created a separate repository:

```text
noir-ckb-verifier
```
https://github.com/wamimi/noir-ckb-verifier


> An experimental toolchain for turning Noir circuits into CKB-deployable Groth16 verification artifacts and binding proofs to typed Cell transitions.

Its initial structure includes:

```text
circuits/square-root/       minimal Noir compatibility fixture
crates/artifact-adapter/    future typed Rust conversion layer
docs/architecture.md        target architecture and milestones
docs/artifact-inspection.md generated-artifact observations
docs/ckb-endpoint.md        CKB verifier reproduction evidence
docs/compatibility-matrix.md producer/consumer boundary map
docs/threat-boundary.md     protocol and security boundaries
evidence/week-07.md         command/result evidence ledger
schemas/                    future Molecule schema integration
tests/fixtures/             future cross-implementation vectors
toolchains/versions.md      pinned tool and revision record
```

Generated `target/` directories, proof artifacts, proving keys, and private prover inputs are excluded from Git. The repository started with focused commits for the license and ignore policy, the minimal circuit, architecture documentation, evidence policy, and test-fixture provenance.

The journal still explains the learning journey. The standalone repository implements the bridge.

### What I built and what I reused

I did not write the underlying BN254 Groth16 verifier for CKB-VM. I am studying and reproducing the existing `groth16-ckb` project as the destination endpoint. That repository already provides the generic arkworks verifier, Molecule wire format, CKB transaction integration, adversarial tests, and cycle benchmarks.

The new work in `noir-ckb-verifier` begins on the other side of that boundary:

```text
Noir-authored circuit
-> version-pinned ACIR artifact
-> compatible Groth16 backend
-> typed proof/VK/public-input conversion
-> groth16-ckb wire objects
-> proof-bound application transition
```

Its intended value is interoperability, packaging, and application semantics: making it possible for a Noir developer to produce the exact circuit-specific artifacts a generic CKB verifier needs, then making sure the proof authorizes the transaction it is attached to.

### What I think the tool should generate

One design decision became clearer during this research: the first version should not compile a new Rust verifier binary for every Noir circuit.

Instead, it should reuse one generic verifier code Cell and generate circuit-specific artifacts:

```text
Molecule-encoded verification-key Cell data
Molecule-encoded proof and public-input payload
verifier CellDep configuration
VK Cell data-hash commitment
Type Script configuration
deployment manifest
host-language integration bindings
test fixtures with exact producer versions
```

This feels more native to CKB than imitating Solidity verifier generation. The reusable verifier logic belongs in a code Cell. The circuit-specific verification key belongs in a data Cell. The consuming protocol commits to that key and decides what its public inputs mean.

The longer-term developer experience I am exploring is something like:

```bash
noir-ckb build ./circuit
noir-ckb test
noir-ckb deploy --network testnet
```

That interface is only a direction at this stage, but it gives the project a concrete developer-facing goal.

## 3. Pinned Week 7 Toolchain

The reproduced Noir-side versions were:

```text
nargo: 1.0.0-beta.18
noirc: 1.0.0-beta.18+99bb8b5cf33d7669adbdef096b12d80f30b4c0c9
noirc source state: clean
Barretenberg: 3.0.0-nightly.20260102
```

There is no standalone `noirc` executable in my current `PATH`. The compiler version and source revision are reported through `nargo --version`.

I kept beta.18 instead of upgrading merely because a newer compiler exists. ACIR is a versioned interface, so the eventual backend must be selected and pinned together with the compiler, ABI parser, witness solver, and lowering implementation.

## 4. Minimal Noir Compatibility Circuit

The first circuit is intentionally small:

```noir
fn main(x: Field, y: pub Field) {
    assert(x * x == y);
}
```

The development fixture is:

```text
private x = 7
public  y = 49
```

These values are intentionally public test data even though `x` is private in the circuit interface. This removes application complexity from the interoperability test. If this circuit fails to cross a backend boundary, likely causes include version compatibility, public-input ordering, constraint lowering, point representation, or serialization rather than complicated circuit logic.

`nargo check` completed and retained the existing `Prover.toml` fixture:

```text
Note: Prover.toml already exists. Use --overwrite to force overwrite.
```

The note was expected because I had already committed the deliberate `x = 7`, `y = 49` fixture.

## 5. Compiling and Inspecting ACIR

I compiled the circuit with:

```bash
nargo compile --print-acir
```

The retained compiler output was:

```text
Compiled ACIR for main:
func 0
private parameters: [w0]
public parameters: [w1]
return values: []
ASSERT w1 = w0*w0
```

The command returned exit code 0.

This small output confirmed three important facts:

```text
w0 is private
w1 is public
the compiled constraint is w1 = w0 * w0
```

Nargo generated:

```text
target/square_root.json
```

I inspected the artifact without committing it:

| Property | Observed value |
|---|---|
| File type | JSON data |
| Size | 894 bytes |
| SHA-256 | `6fc139050100c3083e48f31d4a3fb051d8d96e31bfa98865d103ce12d37d57cb` |
| Noir version | `1.0.0-beta.18+99bb8b5cf33d7669adbdef096b12d80f30b4c0c9` |
| Artifact hash | `7259915808694063673` |
| Base64 bytecode text length | 152 characters |

Its top-level keys were:

```text
abi
bytecode
debug_symbols
expression_width
file_map
hash
noir_version
```

The ABI independently confirmed that `x` is a private `Field`, `y` is a public `Field`, and there is no return value.

This clarified an important boundary:

```text
ACIR artifact = compiled circuit description + ABI metadata
ACIR artifact != proof
```

The artifact does not contain the concrete `x = 7` assignment. It describes the program that a compatible execution and proving stack must consume.

## 6. Solving and Inspecting the Execution Witness

I executed:

```bash
nargo execute witness
```

Nargo reported:

```text
[square_root] Circuit witness successfully solved
[square_root] Witness saved to target/witness.gz
```

The command returned exit code 0.

The generated witness metadata was:

| Property | Observed value |
|---|---|
| Path | `target/witness.gz` |
| Compressed size | 47 bytes |
| Gzip-reported uncompressed size | 108 bytes |
| SHA-256 | `77a911f41c3e6844ba2e66a68a693eca08aa3711dad4a274038f0c0d11dde554` |
| Gzip integrity test | exit code 0 |

The macOS `file` utility described this tiny stream as `gzip compressed data, max compression, truncated`. I retained that observation instead of hiding it, then used the dedicated `gzip -t` integrity check. That check returned 0, and Nargo had reported successful witness generation.

The witness remains ignored by Git.

Another naming distinction matters here:

```text
Noir execution witness = private assignment used by the prover
CKB transaction witness = public transaction data
```

A future CKB `WitnessArgs.input_type` may contain the zero-knowledge proof and public inputs. It must not contain the private Noir witness merely because both objects use the word “witness.”

## 7. Barretenberg as a Control Path

Before crossing into Groth16, I used the installed Barretenberg backend as a control. This tested whether Barretenberg could consume the exact ACIR artifact and execution witness I had just produced.

I generated an UltraHonk proof, public inputs, and verification key. The generated files were:

| Artifact | Size | SHA-256 |
|---|---:|---|
| `proof` | 16,256 bytes | `f3007837a3d59f95c44edf82f670b0e3380d1079a6e7567792134aa6e46df2bd` |
| `public_inputs` | 32 bytes | `218cd422fe6a50299655006c5c9a13a4a06d5d815f4c929b876885dda1fd4652` |
| `vk` | 3,680 bytes | `c8d90d34eea356934ba880b5e5ab907540cc71602059dcbf9dd9b1ea75a5e89f` |
| `vk_hash` | 32 bytes | `4f896232c4a944d89a7c63b65e5de1797c514bcc02d8b93ac4a89c19414d45d1` |

The combined prove command returned exit code 0, but it did not print an explicit verification-success line. I therefore ran verification separately:

```bash
bb verify \
  -p target/bb-control/proof \
  -k target/bb-control/vk \
  -i target/bb-control/public_inputs
```

The retained result was:

```text
Scheme is: ultra_honk, num threads: 12
Proof verified successfully
exit_code=0
```

This established:

```text
Noir artifact + witness
-> Barretenberg UltraHonk proof
-> Barretenberg verification
-> success
```

It did not establish:

```text
Noir
-> BN254 Groth16
-> arkworks serialization
-> Molecule
-> CKB-VM
```

The control proof is useful precisely because its boundary is explicit. A successful UltraHonk proof is not a Groth16 proof and cannot be passed to `groth16-ckb`.

## 8. Reproducing the Existing CKB Groth16 Endpoint

The other endpoint already exists in the separate `groth16-ckb` repository.

I pinned the reproduction to:

```text
commit: d64c769ffe2d2edb5eb308dc59058efda77c2f83
worktree: clean
rustc: 1.95.0 (59807616e 2026-04-14)
cargo: 1.95.0 (f2d3ce0bd 2026-03-21)
target: riscv64imac-unknown-none-elf
node: v24.3.0
pnpm: 10.12.4
```

The verifier endpoint uses:

```text
proof system: Groth16
curve: BN254
implementation: arkworks 0.5
runtime: no_std CKB-VM script
wire format: Molecule
```

Its transaction integration model is:

```text
VK Cell data
-> Molecule-encoded verification key

Type Script args
-> commit to the VK Cell data hash

WitnessArgs.input_type
-> Molecule-encoded proof and public inputs

CKB Type Script
-> resolve committed VK CellDep, decode payload, verify proof
```

### Production binary validation

I ran the repository's production build script and retained:

```text
build_exit_code=0
```

The inspected binary was:

| Property | Observed value |
|---|---|
| Exact size | 98,464 bytes |
| Human-readable size | 96K |
| Type | 64-bit little-endian RISC-V ELF, statically linked and stripped |
| SHA-256 | `9a6ed1137687a8d55037488bbdafa7d1f60aacc771d87ef82dde1a2023e011f8` |

There is an important evidence limitation: Cargo finished in 0.14 seconds and the binary timestamp predated this command, so it reused existing build outputs. I can honestly say that the pinned locked build command completed and that I inspected the binary used by the tests. I do not describe this as a clean-from-scratch or independently reproducible rebuild.

## 9. Rust and CKB-VM Test Evidence

The normal workspace run executed:

| Suite | Passed | Failed | Ignored |
|---|---:|---:|---:|
| Host unit tests | 3 | 0 | 0 |
| Differential/adversarial tests | 26 | 0 | 1 |
| Property tests | 2 | 0 | 0 |
| CKB integration verification tests | 8 | 0 | 0 |
| Cycle benchmark | 0 | 0 | 1 |
| **Aggregate** | **39** | **0** | **2** |

The command returned exit code 0.

The two ignored tests were then run explicitly:

```text
differential_x_squared_1000_samples -> passed in 176.22s
cycle_benchmark                    -> passed
ignored-suite exit code            -> 0
```

The 8 CKB integration tests covered:

```text
trigger-Cell creation permitted
missing VK CellDep rejected
truncated witness rejected
bad witness version rejected
public-input count mismatch rejected
forged proof rejected
valid proof accepted
wrong VK rejected
```

I also reran the `integration-tests` package separately. All 8 verification tests passed again, with no failures. I treat that rerun as reproducibility evidence rather than adding it to the unique test count.

### Exact cycle measurements

The full ignored suite and the dedicated benchmark command produced the same values:

| Public inputs | CKB-VM cycles |
|---:|---:|
| 1 | 99,843,490 |
| 4 | 100,656,230 |
| 8 | 101,702,797 |
| 16 | 103,998,027 |
| 32 | 108,736,103 |
| 64 | 118,483,349 |

The dedicated benchmark returned exit code 0 and passed in 1.17 seconds.

These are retained measurements from my run.

## 10. TypeScript SDK and Integration Example

I installed dependencies using frozen lockfiles. Both installs reported that the lockfile and dependencies were already current. pnpm warned that the `esbuild` build script was ignored; I retained the warning and did not claim to approve dependency scripts.

The installed state was still sufficient for the test and type-check gates.

### TypeScript SDK

```text
test files: 3 passed
tests:      18 passed
typecheck:  passed with no diagnostics
exit codes: 0
```

### Square-root integration example

```text
test files: 1 passed
tests:      6 passed
typecheck:  passed with no diagnostics
exit codes: 0
```

The example tests checked transaction construction rather than merely parsing local objects:

```text
creation transaction loads verifier code without requiring the VK Cell
Type Script args equal the VK data hash
verification transaction loads verifier code and VK CellDeps
verification transaction spends the trigger Cell
encoded proof payload is placed in WitnessArgs.input_type
```

This reproduced the destination wire and transaction shape I will eventually need to feed from Noir-derived Groth16 artifacts.

## 11. Compatibility Matrix

The executable boundary is now:

| Layer | Artifact | Week 7 result |
|---|---|---|
| Noir source | `.nr` circuit | checked and compiled |
| ACIR program | `square_root.json` | generated, inspected, hashed |
| Execution witness | `witness.gz` | solved, integrity-checked, hashed |
| Control proof | UltraHonk proof/VK/public inputs | generated and verified in Barretenberg |
| Groth16 constraint system | R1CS/backend-native form | deferred to Week 8 |
| BN254 Groth16 proof | proof/VK/public inputs | deferred to Week 8 |
| Arkworks objects | typed proof/VK/field elements | deferred to Week 9 |
| Molecule payload | VK Cell and transaction witness bytes | existing endpoint reproduced |
| CKB-VM verification | generic verifier | build path and Rust/TypeScript tests reproduced |
| Capsule semantics | transition-bound public inputs | design only; planned for Week 10 |

This changed my question from:

> How do I generate a Noir verifier for CKB?

to:

> How do I lower a version-pinned Noir ACIR artifact into BN254 Groth16, convert its proof objects into validated arkworks-compatible encoding, carry them through Molecule, and bind the public inputs to the exact Capsule Cell transition being validated?

That question is narrower and testable.

### What feels new in my project direction

The novelty I am claiming here is the combination of three boundaries that are often demonstrated separately:

```text
Noir compiler interoperability
+ CKB-native verifier packaging
+ proof-bound Cell transition semantics
```

A demo that converts a proof and makes CKB-VM return success would still be incomplete for the application I want to build. The project should also reject a mathematically valid proof when that proof is attached to the wrong Capsule transition.

That requirement changes the architecture. It means the output cannot be only `proof bytes`. The toolchain and consuming Type Script need a shared, specified public-input layout connected to actual transaction data. It also means the test suite must cross the boundary between cryptography and protocol behavior.

For me, that is the most interesting part of the project: moving from “CKB can verify this equation” to “this proof authorizes exactly this old-to-new Cell transition and no other one.”

## 12. Backend Research Boundary

I researched two experimental ACIR-to-Groth16 candidates but deliberately did not run either one during Week 7.

### Noir-Groth16

The current repository documents a Rust pipeline that parses Noir artifact JSON and ABI metadata, solves witnesses with ACVM, lowers supported ACIR operations into R1CS, emits `.r1cs` and `.wtns`, and uses snarkjs for Groth16 setup, proving, and verification.

Its explicit intermediate artifacts and documented supported/rejected operations make it a strong Week 8 candidate. Before using it, I still need to pin an exact source commit and confirm its current Noir/ACIR dependency revisions rather than relying on the older beta.19 assumption in my first draft.

### Sunspot

Sunspot explicitly requires Noir `1.0.0-beta.18`, matching my Week 7 compiler, and demonstrates a Noir-to-Groth16 route oriented toward Solana and gnark-related tooling. It is unaudited.

Week 8 will choose a backend through a reproducible minimal-circuit experiment. Newest version and easiest demo are not sufficient selection criteria.

### Questions Week 7 answered

I can now answer several questions that were vague when I started:

**Is ACIR a proof?**  
No. It is the compiled circuit representation and ABI metadata consumed by execution and proving systems.

**Is the Nargo execution witness a proof?**  
No. It is the concrete assignment used to solve the circuit. It may contain private values and must remain off-chain.

**Can my existing Barretenberg proof be sent to `groth16-ckb`?**  
No. My control proof used UltraHonk. The CKB endpoint expects Groth16 over BN254 with arkworks-compatible serialization.

**Does every Noir circuit require a different CKB verifier binary?**  
Not for the first architecture. A generic code Cell can be reused while each circuit supplies a committed verification-key Cell and proof payload.

**Does successful Groth16 verification automatically secure a Capsule transition?**  
No. The verifier knows only the VK, proof, and ordered public inputs. Application logic must bind those inputs to the actual transaction.

**Is the destination endpoint only theoretical?**  
No. I reproduced its build path, Rust/CKB integration tests, TypeScript SDK tests, transaction-shape example, and exact CKB-VM cycle measurements.

### Questions I still need to answer

The research also produced a more useful set of open questions:

1. Which exact Noir compiler and ACIR dependency revision should the first Groth16 backend support?
2. Which ACIR operations can the backend lower faithfully, and how should unsupported or hint-based operations fail?
3. Should the first interoperability route use snarkjs-style artifacts, gnark objects, or another typed export as its source format?
4. What is the exact coordinate, endianness, compression, and public-input ordering map between the source backend and arkworks 0.5?
5. How should the development trusted setup be generated, labeled, reproduced, and kept separate from any production ceremony?
6. Should the adapter import `groth16-ckb`'s Molecule schema directly, vendor a pinned copy, or consume an SDK package?
7. Which hash function and domain separators should map Capsule commitments into BN254 scalar-field public inputs?
8. Should replay protection commit to the consumed OutPoint, the network, the verifier script hash, the Capsule ID, or a combination of them?
9. Should Capsule transition binding live in a wrapper Type Script, an extended verifier script, or a composed protocol with separate responsibilities?
10. What should the tool generate so that another CKB developer can reproduce the whole path without understanding every serialization detail?

I do not yet have final answers to those questions. Week 7 improved the project because I now know which unanswered questions are protocol decisions and which are implementation experiments.

## 13. Why Serialization Cannot Be Hex Copying

Even if two systems both say “Groth16 over BN254,” they may disagree on:

```text
field-element endianness
G1/G2 coordinate ordering
Fq2 component ordering
compressed point flags
infinity representation
public-input ordering
binary framing
subgroup validation
```

The adapter should therefore be typed:

```text
parse source proof/VK/public inputs
-> reject out-of-range field elements
-> construct validated BN254 affine points
-> check curve and subgroup membership
-> reject unexpected infinity points
-> preserve public-input order
-> verify through an arkworks host verifier
-> serialize with arkworks CanonicalSerialize
-> encode with the verifier's Molecule schema
```

The same proof must verify in the source backend and the destination host implementation before it reaches CKB-VM.

## 14. Proof Verification Is Not Transition Binding

The most important protocol requirement remains:

```text
proof verifies mathematically
!=
proof verifies the intended CKB state transition
```

The generic verifier establishes:

```text
verify(vk, public_inputs, proof)
```

It does not decide what the public inputs mean.

For Capsule Notes, the final application protocol must derive or validate commitments to values such as:

```text
old Capsule state
new Capsule state
stable Capsule identifier
action identifier
nullifier or one-time authorization value
network/script replay domain
possibly the consumed OutPoint
```

The intended acceptance rule is:

```text
proof verifies under the committed VK
AND public inputs equal values derived from this transaction
AND Capsule transition rules hold
AND replay-domain rules hold
-> accept
```

The final test matrix must include:

```text
valid proof + correct transition -> accept
valid proof + wrong transition   -> reject
invalid proof                    -> reject
malformed serialization          -> reject
wrong VK Cell                    -> reject
replayed proof in wrong domain   -> reject
```

The second case is not an optional negative test. It is the difference between attaching a proof verifier to a transaction and building a proof-bound CKB state machine.

## 15. Boundaries and Work Not Claimed

This remains research infrastructure, not production-ready cryptography.


## 16. Next Milestone: Week 8

Week 8 will cross the first missing interface:

```text
version-pinned Noir artifact
-> supported ACIR lowering
-> development-only Groth16 setup
-> BN254 Groth16 proof, VK, and public inputs
-> verification in the selected source backend
```

The success criterion is intentionally limited:

> The Noir-authored square-root circuit produces a BN254 Groth16 proof that verifies in its source backend.

Arkworks conversion, Molecule encoding, and CKB-VM ingestion remain later milestones.

## 17. Reflection and Request for Feedback

The most useful result was replacing one vague integration problem with a set of interfaces that can fail independently and be tested independently.

I now have retained evidence for both ends:

```text
Noir endpoint:
source -> ACIR -> execution witness -> UltraHonk control verification

CKB endpoint:
generic Groth16 verifier -> Molecule transaction model -> CKB-VM tests
```

The space between them is a versioned compiler boundary, a constraint-system boundary, a proof-system boundary, a cryptographic object boundary, and a transaction-semantics boundary.

A verifier returning `true` is only one layer. The protocol must still establish that the proof belongs to this verification key, these public inputs, this Capsule, and this exact attempted transition.

That is the work I want the next phase to make executable.

I would especially appreciate feedback on the project direction:

> Would a version-pinned Noir-to-CKB Groth16 artifact toolchain be useful to CKB developers, particularly if it also provides a reference pattern for binding proofs to typed Cell transitions?

I am also interested in feedback on scope:

```text
Should the first useful contribution focus on the ACIR-to-Groth16 adapter?
Should it focus on arkworks/Molecule interoperability fixtures?
Should proof-bound Capsule be the primary reference application?
Is there an existing CKB convention for public-input commitments or replay domains that I should align with?
Would this be more useful as a standalone CLI, an SDK, or an upstream contribution to the existing verifier?
```

This direction brings together the parts of the journey I have found most compelling: CKB's verifier model, typed Cell state, Molecule serialization, Rust, Noir, and zero-knowledge protocol design. If the direction is useful to the ecosystem, I would like to keep developing it into reusable open-source infrastructure.

## 18. Resources

- [Noir documentation](https://noir-lang.org/docs)
- [Nargo command reference](https://www.noir-lang.org/docs/reference/nargo_commands/)
- [Noir manual workflow](https://noir-lang.org/docs/getting_started_manually)
- [Noir-Groth16](https://github.com/jamesbachini/Noir-Groth16)
- [Sunspot](https://github.com/reilabs/sunspot)
- [groth16-ckb](https://github.com/CECILIA-MULANDI/groth16-ckb)
- [CKB script concepts](https://docs.nervos.org/docs/script/intro-to-script)
- [Molecule in CKB](https://docs.nervos.org/docs/serialization/serialization-molecule-in-ckb)
- [Using Molecule in CKB scripts](https://docs.nervos.org/docs/serialization/use-in-ckb-scripts)
