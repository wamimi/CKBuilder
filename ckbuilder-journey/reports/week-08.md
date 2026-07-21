# CKBuilder Weekly Report - Week 8

**Name:** Nelly Njeri  
**Week Ending:** 19 July 2026  


## 1. Weekly Focus

Week 8 moved my Noir-to-CKB research across the first missing technical boundary:

```text
Noir beta.18 artifact
-> ACIR parsing and witness solving
-> R1CS and WTNS generation
-> development-only Groth16 setup
-> BN254 Groth16 proof generation
-> source-backend verification
-> public-input semantic validation
```

In Week 7, I made the two endpoints concrete. On the Noir side, I compiled and executed a minimal square-root circuit and generated a Barretenberg UltraHonk control proof. On the CKB side, I reproduced the existing `groth16-ckb` endpoint, including its RISC-V verifier binary, Rust tests, TypeScript SDK tests, integration example, and CKB-VM cycle measurements.

The unanswered question between those endpoints was whether my exact version-pinned Noir artifact could be lowered into a BN254 Groth16 circuit without changing what the Noir program says is public and private.

At first, the Week 8 goal sounded simple:

> Generate a Groth16 proof from the Week 7 Noir circuit and verify it.

The experiment showed that this success condition was incomplete. I generated a mathematically valid proof that verified in snarkjs, but it exposed the private square root `x = 7` as the Groth16 public input instead of preserving the Noir-declared public result `y = 49`.

That changed the real Week 8 question to:

> Can the conversion preserve the exact Noir public ABI, rather than merely produce a satisfiable R1CS and a proof that returns `OK`?

This project continues to bring together the parts of CKB I find most compelling: scripts as deterministic verifiers, typed Cells as explicit state, flexible RISC-V execution, and the need to connect cryptographic validity to an exact transaction proposal.

## 2. What I Built and What I Reused

I evaluated the experimental [Noir-Groth16](https://github.com/jamesbachini/Noir-Groth16) backend as the ACIR-to-R1CS route. I also continued treating [groth16-ckb](https://github.com/CECILIA-MULANDI/groth16-ckb) as the later CKB destination. Both are external projects whose existing work I am  studying.

My Week 8 work in `noir-ckb-verifier` was the interoperability experiment around those components:

```text
pin the producer and backend revisions
retain the exact input artifact hashes
test direct beta.18 artifact consumption
inspect the R1CS and witness independently
run a development-only Groth16 flow
compare generated public inputs with the Noir ABI
preserve the failure as a regression case
build a second control circuit to isolate the ordering problem
define a fail-closed compatibility rule
document what is and is not safe to claim
```


## 3. Selecting and Pinning the First Backend Experiment

I selected Noir-Groth16 for the first experiment because it exposes the intermediate artifacts I need to inspect:

```text
Noir artifact JSON and ABI
ACVM witness assignments
R1CS constraint system
WTNS witness file
snarkjs-compatible setup and proof artifacts
```

I pinned the backend checkout to:

```text
commit: 4b7caace1f2128e454c8d0fe50cac1ec46b1e272
subject: memory materialization
date:    13 June 2026
status:  clean detached checkout
```

The dependency inspection revealed a useful compatibility detail. The backend's main ACIR, ACVM, and BN254 black-box-solver dependencies use Noir beta.19 at revision:

```text
74d6be658e1ad252f87943292ba09bdd4da80bd4
```

It also contains a legacy beta.18 ACIR parser pinned to the same source revision embedded in my Week 7 artifact:

```text
99bb8b5cf33d7669adbdef096b12d80f30b4c0c9
```

That made it a reasonable candidate for a direct compatibility test. It did not guarantee semantic compatibility, but it gave me a specific hypothesis I could verify.

The recorded host tools were:

| Tool | Version |
|---|---|
| Nargo | `1.0.0-beta.18` |
| noirc | `1.0.0-beta.18+99bb8b5cf33d7669adbdef096b12d80f30b4c0c9` |
| Rust | `rustc 1.95.0` |
| Cargo | `cargo 1.95.0` |
| Node.js | `v24.3.0` |
| npm | `11.4.2` |
| snarkjs | `0.7.5` |

I used `grep -nE` command to inspect the manifests and lockfile.

I built the pinned backend CLI using its lockfile:

```bash
cargo build --locked -p noir-cli
```

The command returned exit code 0. The resulting local debug binary was an arm64 Mach-O file, displayed as 27 MB, with SHA-256:

```text
9b2783fcec9a6ea8983134af5b9fbdf61974fe4362f95d3a75747548524ca092
```


## 4. Keeping the Week 7 Input Stable

I used the original Week 7 circuit without recompiling it through the backend:

```noir
fn main(x: Field, y: pub Field) {
    assert(x * x == y);
}
```

Its intended ABI is:

```text
private x = 7
public  y = 49
```

The Week 7 ACIR printout had already established:

```text
private parameters: [w0]
public parameters: [w1]
ASSERT w1 = w0*w0
```

Before the backend experiment, I re-hashed the compiled artifact. It still matched the Week 7 record:

```text
square_root.json SHA-256:
6fc139050100c3083e48f31d4a3fb051d8d96e31bfa98865d103ce12d37d57cb
```

This was important because it kept the experiment narrow. If the artifact had changed, I would not know whether a result came from the backend or from a new compilation.

## 5. Direct beta.18 Parsing and Witness Solving

The pinned backend directly parsed the unchanged beta.18 artifact:

```text
opcode_count=1
witness_count=2
opcode_variants=AssertZero
artifact_parse_exit_code=0
```

This established that the backend could read this specific artifact revision and recognize its only opcode.

Next, I ran the backend's default pedantic witness solver with the committed development input:

```json
{
  "x": "7",
  "y": "49"
}
```

It produced the expected Noir witness assignments:

| ACIR witness | Value | Noir role |
|---:|---:|---|
| `w0` | 7 | private `x` |
| `w1` | 49 | public `y` |

The witness command returned exit code 0 and emitted JSON, raw binary, and WTNS representations. The backend worktree remained clean.

At this point, parsing and witness solving looked correct. However, I kept them as separate evidence gates because they did not yet show how those witnesses would be classified after conversion to R1CS.

## 6. Strict ACIR-to-R1CS Interoperability

I ran the strict interoperability command without either of the backend's relaxed flags. I did not use `--allow-unsupported` or `--no-pedantic`.

The result was:

```text
n_wires=4
n_constraints=2
witness_len=4
strict_interop_exit_code=0
```

The generated files were:

| Artifact | Size | SHA-256 |
|---|---:|---|
| `circuit.r1cs` | 384 bytes | `79b3c2b6312182538763f0c3a0e369830879a32263a454c8133614c81a0afa47` |
| `witness.wtns` | 204 bytes | `6be37d42e016a48d12a01ad0ff7f30699c129cfb2d90b22ef1b0861ffac2e884` |

Pinned snarkjs inspection reported:

| Property | Value |
|---|---:|
| Curve | BN254 (`bn-128` / `bn128`) |
| Wires | 4 |
| Constraints | 2 |
| Public inputs | 1 |
| Private inputs | 1 |
| Outputs | 0 |
| Custom gates | false |

The independent witness check returned:

```text
WITNESS IS CORRECT
WITNESS CHECKING FINISHED SUCCESSFULLY
```

The exported wire vector was:

```json
[
  "1",
  "7",
  "49",
  "49"
]
```

This was the point where a purely success-oriented workflow could have stopped too early. The R1CS was valid. The witness satisfied its constraints. Every command returned success. But the interface was wrong.

## 7. The Main Finding: A Valid Constraint System with the Wrong Public Meaning

In the iden3 R1CS layout, the leading wire is the constant `1`, followed by public outputs, public inputs, and then private wires. This R1CS declared zero outputs and one public input, so wire 1 was public.

The exported vector assigned:

```text
wire 1 = 7
wire 2 = 49
wire 3 = 49
```

That meant the converted circuit treated `7` as public, even though Noir declared `x = 7` private and `y = 49` public.

I exported the R1CS to JSON to inspect the exact constraints. They reduce to:

```text
wire1 * wire1 = wire3
1 * (-wire2 + wire3) = 0
```

With the vector `[1, 7, 49, 49]`, these constraints correctly prove:

```text
7 * 7 = 49
```

The mathematical relation was intact. The public/private classification was not.

This gave me a concrete example of an important interoperability rule:

```text
binary parses correctly
+ witness satisfies R1CS
+ proof verifies
!= Noir public ABI was preserved
```

`snarkjs r1cs print` did fail because the backend did not emit the optional companion `circuit.sym` file. I retained that exit code 1 rather than hiding it. The separate `r1cs export json` command succeeded and provided the complete constraint representation, so the missing symbol file was an inspection-tool limitation rather than a circuit-validation failure.

## 8. Development-Only Groth16 Setup

After diagnosing the R1CS layout, I continued with Groth16 as a controlled diagnostic. The purpose was to confirm whether the same semantic mismatch would appear in the exported proof's public vector.

I used snarkjs 0.7.5 and BN254 with a Powers of Tau power of 12.

The initial sequence was:

```text
powersoftau new             -> exit 0
powersoftau prepare phase2  -> exit 0
powersoftau verify          -> exit 1
```

The verification failure was explicit:

```text
This file has no contribution! It cannot be used in production
```

I did not treat that transcript as verified or continue using it. I added one named local development contribution, prepared a new Phase 2 transcript, and verified the contributed file successfully:

```text
Powers Of tau file OK!
Powers of Tau Ok!
```

I then ran the circuit-specific Groth16 setup, added a circuit-specific development contribution, verified that the final ZKey matched the exact R1CS and Powers of Tau transcript, and exported the verification key.

One first ZKey verification command contained an extra `r1cs` argument and returned exit code 99 with a usage error. I corrected the command, reran it, and retained the successful result:

```text
ZKey Ok!
```

These files were useful development artifacts, but they are not production setup material. The contribution entropy was deliberately public, there was only one local participant, and there was no independent ceremony. This report therefore claims only structural development verification, not trusted production provenance.

## 9. A Groth16 Proof That Verified the Wrong Public Interface

The diagnostic Groth16 proof command returned exit code 0 and emitted a proof for protocol `groth16` on curve `bn128`.

The generated public vector was:

```json
[
  "7"
]
```

The exact retained artifacts were:

| Artifact | Size | SHA-256 |
|---|---:|---|
| `proof.json` | 803 bytes | `f9ae81a114a745622adb5ce3a2f2453fc2cccf5a332ac8aea3aae8627fcc8eeb` |
| `public.json` | 8 bytes | `a00f79c38314728d88946e6d517d5f02b2f7e27b863f8650551054f53c3d0462` |
| `verification_key.json` | 2,928 bytes | `15fcf947c110698b050b6e45ea6a83509cc080c4a8ecd1489a073497acebefb4` |

I ran two checks against the same unchanged proof:

| Public vector | Meaning | Result |
|---|---|---|
| `["7"]` | backend-generated, but Noir-private `x` | `OK`, exit 0 |
| `["49"]` | Noir-intended public `y` | `Invalid proof`, exit 1 |

The rejection of `49` was not a failed negative test. It confirmed the problem. A proof cannot be repaired by replacing its public input after generation. The circuit's R1CS wire allocation must preserve the intended public statement before setup and proving begin.

This experiment gave me a proof that was mathematically valid but semantically incompatible with the Noir source interface.

## 10. Preserving the Failure as a Regression Fixture

I kept the original private-first circuit unchanged rather than editing it until the pipeline appeared to work.

That circuit now has an important role in the project:

```text
private-first Noir circuit
-> valid ACIR
-> satisfiable emitted R1CS
-> source-verifiable Groth16 proof
-> wrong exported public value
-> compatibility gate must reject
```

This is more useful than deleting the failed path. It can become a regression test for any future remapping or validation code. A later adapter should only mark the case supported if it can prove that Noir's public `w1` becomes the correct leading R1CS public wire without weakening the constraints.

## 11. Public-First Control Circuit

To isolate the cause, I added a second circuit with the same equation and values but reversed source parameter order:

```noir
fn main(y: pub Field, x: Field) {
    assert(x * x == y);
}
```

This was not intended as a general fix. It was a controlled experiment for a specific hypothesis:

> If the public Noir parameter occupies the leading ACIR witness position, will the backend's identity witness-to-R1CS-wire mapping preserve it as the Groth16 public input?

Nargo beta.18 confirmed the new order:

```text
private parameters: [w1]
public parameters: [w0]
ASSERT w0 = w1*w1
```

`nargo check`, `nargo compile --print-acir`, and `nargo execute witness` all returned exit code 0. The compiled artifact remained version-pinned to the same noirc beta.18 revision.

The backend then parsed, solved, and strictly lowered the new artifact. Its assignments were:

| ACIR witness | Value | Intended role |
|---:|---:|---|
| `w0` | 49 | public `y` |
| `w1` | 7 | private `x` |

The exported R1CS witness vector became:

```json
[
  "1",
  "49",
  "7",
  "49"
]
```

This time, wire 1—the single R1CS public input—contained the intended public value `49`.

The independent snarkjs witness check again reported:

```text
WITNESS IS CORRECT
WITNESS CHECKING FINISHED SUCCESSFULLY
```

The corrected-layout R1CS had a different digest, so I generated a new circuit-specific ZKey rather than reusing the key from the first circuit. I reused only the already verified development Powers of Tau transcript, which is universal setup material for this limited experiment.

The new setup, circuit-specific contribution, ZKey verification, and verification-key export all returned exit code 0. ZKey verification reported:

```text
ZKey Ok!
```

## 12. Positive and Negative Proof Checks for the Control

The public-first proof was generated once and retained by hash:

| Artifact | Size | SHA-256 |
|---|---:|---|
| `proof.json` | 806 bytes | `0487979648c2f7819a3544a2da7f8a2407057a15a6aaaa1d8b2fbc91933d715a` |
| `public.json` | 9 bytes | `8d683c14535896df9e3f636c1cb3fa5483cb8cb950f4fd1e50f200077fcfb64b` |
| `verification_key.json` | 2,931 bytes | `19654ceb85017d4ce4b36c41acaabebb2421d42916aba57d4918944e8e1acc3d` |

The exported public vector was exactly:

```json
[
  "49"
]
```

I then checked the same unchanged proof against both possible values:

| Public vector | Meaning | Result |
|---|---|---|
| `["49"]` | intended public `y` | `OK`, exit 0 |
| `["7"]` | private `x` presented as public | `Invalid proof`, exit 1 |

This positive-and-negative pair is stronger than a single successful proof command. It shows that, for this narrowly controlled layout, the proof binds to the intended public value and rejects the wrong one.

## 13. Compatibility Result

The two circuits produce a clear comparison:

| Circuit layout | Noir public value | Groth16 exported public value | Source verification | Semantic result |
|---|---:|---:|---|---|
| `fn main(x, y: pub)` | 49 | 7 | verifies with 7 | incompatible |
| `fn main(y: pub, x)` | 49 | 49 | verifies with 49; rejects 7 | narrow control passed |

The selected backend appears to preserve witness identity while emitting R1CS wires, but R1CS requires public wires to occupy a leading contiguous region. An arbitrary Noir witness order therefore cannot be assumed to match the R1CS public-wire convention.

My current compatibility conclusion is:

```text
Noir beta.18 artifact parsing:                         supported for this fixture
pedantic ACVM witness solving:                         supported for this fixture
strict AssertZero lowering:                            supported for this fixture
R1CS/WTNS structural validity:                         supported for both layouts
general preservation of Noir visibility metadata:     not supported
public-first square-root compatibility control:        passed
general Noir-to-Groth16 compatibility:                 not established
```

Until a sound remapper exists, the toolchain should fail closed. It should verify that every Noir public output and input occupies exactly the leading wire positions expected by the target R1CS format. If it cannot prove that property, it should reject the circuit before trusted setup or proof generation.

Source-ordering the public parameter first is a useful diagnostic and temporary fixture constraint. It is not an acceptable hidden requirement for a general developer tool.

## 14. Why This Matters for CKB

This Week 8 finding is directly related to the central CKB application boundary I identified in Week 7:

```text
proof verifies mathematically
!=
proof verifies the intended CKB state transition
```

Week 8 found the same class of problem one layer earlier.

The proof system correctly verified a statement, but it was not the statement I intended to expose through the Noir ABI. If I had serialized that proof and sent it to CKB, a generic verifier could correctly return success while the application interpreted the public vector incorrectly.

The full responsibility chain is therefore:

```text
Noir source declares what is public
-> ACIR records witness visibility
-> R1CS must preserve that visibility and ordering
-> Groth16 proof binds to the exact public vector
-> adapter must preserve field elements and order
-> Molecule payload must preserve the same values
-> CKB Type Script verifies proof and VK
-> Capsule logic derives those public values from the actual Cell transition
```

An error at any one of these boundaries can produce a cryptographically valid proof that authorizes or reveals the wrong thing.

For the eventual Capsule reference application, I still want the acceptance rule to be:

```text
valid proof
+ committed verification key
+ public inputs derived from the consumed and created Cells
+ correct Capsule transition rules
+ replay-domain binding
-> accept
```

The long-term negative test remains just as important as the positive test:

```text
valid proof + correct Capsule transition -> accept
valid proof + wrong Capsule transition   -> reject
```

Week 8 reinforced that these semantic checks must not be postponed until the final CKB transaction. They must begin at the compiler-to-backend boundary.



## 15. Questions Week 8 Answered

**Can the pinned backend parse my exact Week 7 beta.18 artifact?**  
Yes, for this square-root fixture. It recognized one `AssertZero` opcode and two Noir witnesses.

**Can it solve and strictly lower the fixture without relaxed flags?**  
Yes. Pedantic witness solving and strict R1CS/WTNS emission completed successfully.

**Does a correct WTNS prove that the Noir ABI was preserved?**  
No. The WTNS can correctly satisfy the emitted R1CS even when the R1CS marks the wrong witness as public.

**Does a successful Groth16 verification prove end-to-end compatibility?**  
No. The private-first proof verified with public input `7`, while Noir declared `49` public.

**Can changing the public JSON after proving repair the mismatch?**  
No. The verifier correctly rejected the same proof against `49`. The public-wire allocation must be corrected before setup and proving.

**Did source ordering explain the observed mismatch?**  
For this fixture, yes. Moving public `y` to the first Noir parameter moved it to `w0`, which the backend mapped to the leading R1CS public wire. The resulting proof verified with `49` and rejected `7`.

**Does the public-first control establish general backend support?**  
No. It is a narrow compatibility control and a clue for designing the proper remapping or rejection logic.

## 16. Questions I Still Need to Answer

The experiment produced a more precise set of engineering and protocol questions:

1. How should a general ACIR-to-R1CS adapter remap public outputs, public inputs, and private witnesses while preserving every constraint?
2. Can the adapter derive a canonical public-input manifest from the Noir ABI and compare it with the emitted R1CS header and wire map?
3. Should the first release support only circuits whose public witnesses already occupy the required leading positions, with an explicit diagnostic for every rejected witness?
4. How should return values, multiple public parameters, arrays, structs, and nested ABI values be ordered and flattened?
5. Which cross-version regression fixtures are needed before claiming support beyond beta.18?
6. How should snarkjs decimal field elements and G1/G2 coordinates be parsed into arkworks BN254 types without accepting non-canonical values, infinity, off-curve points, or wrong-subgroup points?
7. What exact public-input layout should bind a proof to an old Capsule Cell, a new Capsule Cell, the stable Capsule identifier, an action, and a replay domain?
8. Should the fail-closed public-wire check live inside the existing backend, in a separate adapter, or in both places?
9. Would this work be most useful to the ecosystem as a standalone CLI, a reusable Rust crate, test vectors contributed upstream, or a combination of them?

## 17. Next Milestone: Week 9

Week 9 should begin the next typed boundary:

```text
snarkjs BN254 Groth16 JSON
-> validated Rust field elements and curve points
-> arkworks Proof and VerifyingKey objects
-> host verification of the same retained positive control
-> canonical serialization planning for groth16-ckb
```

The initial Week 9 success criteria should remain narrow:

1. Parse the retained public-first proof, verification key, and public input into typed Rust structures.
2. Reject malformed, out-of-range, off-curve, wrong-subgroup, and unexpected-infinity values.
3. Verify the same proof using arkworks on the host.
4. Confirm that the positive vector `49` succeeds and the negative vector `7` fails.
5. Compare coordinate order, field representation, and canonical serialization with the `groth16-ckb` schema and host verifier.

Molecule encoding and CKB-VM ingestion should only begin after the same proof has passed both source-backend verification and typed arkworks host verification with identical public semantics.

## 18. Reflection

My biggest lesson this week is that interoperability cannot be measured only by whether each tool accepts the previous tool's file.

The first pipeline appeared successful at every structural stage

Yet the result was still incompatible with the Noir source because the wrong value crossed the public boundary.

I find this result valuable because it turns a vague concern about “public-input ordering” into a reproducible regression case. It also gives the project a stronger design principle: every compatibility layer should prove that it preserved meaning, not just bytes or equations.

The public-first control was equally useful. It confirmed that the backend can produce a correct BN254 Groth16 proof for this exact circuit when witness order matches the target convention, while also showing why that coincidence cannot be treated as a general solution.


This week found a boundary that must be correct before CKB-VM verification can mean what the application thinks it means.

## 19. Resources

- [noir-ckb-verifier](https://github.com/wamimi/noir-ckb-verifier)
- [Noir-Groth16](https://github.com/jamesbachini/Noir-Groth16)
- [groth16-ckb](https://github.com/CECILIA-MULANDI/groth16-ckb)
- [Noir documentation](https://noir-lang.org/docs)
- [snarkjs](https://github.com/iden3/snarkjs)
- [CKB script concepts](https://docs.nervos.org/docs/script/intro-to-script)
- [Molecule in CKB](https://docs.nervos.org/docs/serialization/serialization-molecule-in-ckb)
