# CKBuilder Weekly Report - Week 10

**Name:** Nelly Njeri  
**Week Ending:** 2 August 2026   


## 1. Weekly Focus

Week 10 moved my Noir-to-CKB project from host-side interoperability into its
first complete transaction-level execution path:

```text
Noir circuit
-> ACIR and witness
-> R1CS and BN254 Groth16 proof
-> validated arkworks objects
-> groth16-ckb Molecule payloads
-> production Groth16 verifier in CKB-VM
-> Capsule Type Script binding the proof to the actual Cell transition
```

In Week 7, I established the two endpoints: Noir artifacts on one side and the
existing CKB Groth16 verifier on the other. Week 8 crossed the
ACIR-to-Groth16 boundary and exposed a public-wire ordering failure. Week 9
built the strict conversion path from snarkjs JSON through arkworks and into the
Molecule format expected by `groth16-ckb`.

The unanswered question entering Week 10 was:

> Can a Noir-derived proof execute inside CKB-VM and be accepted only when it
> describes the exact Capsule Cell transition in the transaction?

For the retained development fixture, the answer is now yes.


## 2. The Difference Between Proof Verification and Authorization

The project began with a rule that has become more concrete every week:

```text
proof verifies mathematically
!=
proof verifies the intended CKB state transition
```

A generic Groth16 verifier can answer:

```text
Is this proof valid for this verification key and this public vector?
```

It cannot answer the application question:

```text
Does that public vector describe the Cells this transaction actually consumes
and creates?
```

Week 10 implements those as two separate script responsibilities. The existing
`groth16-ckb` verifier is used as the Capsule Cell's lock script. A new
application-specific `capsule-binding` Type Script derives the expected public
values from the transaction and compares them with the proof payload.

The transaction is accepted only when both scripts agree.


## 3. The Proof-Bound Capsule Circuit

I replaced the square-root compatibility example with a transition-aware Noir
fixture. Its public interface is:

```text
capsule_id
old_state_commitment
old_nullifier
new_state_commitment
action_id
new_nullifier
replay_domain
```

The private input is:

```text
authorization_secret
```

The development values are intentionally public test data:

| Field | Value |
|---|---:|
| Capsule ID | 11 |
| Old state commitment | 65 |
| Old nullifier | 5 |
| New state commitment | 66 |
| Action ID | 1 |
| New nullifier | 96 |
| Replay domain | 13 |
| Private development witness | 7 |

The small arithmetic fixture constrains the values as follows:

```text
old_state_commitment = secret² + capsule_id + old_nullifier
new_state_commitment = old_state_commitment + action_id
new_nullifier = secret × replay_domain + old_nullifier
```

This is not intended as a final commitment or nullifier design. Its purpose is
to ensure that every field required by the application boundary participates in
the proved statement.


## 4. Verifying Noir Public and Private Semantics

I kept the compiler pinned to Noir beta.18:

```text
nargo 1.0.0-beta.18
noirc 1.0.0-beta.18+99bb8b5cf33d7669adbdef096b12d80f30b4c0c9
```

`nargo check`, `nargo compile --print-acir`, and `nargo execute witness` all
returned exit code 0.

The compiler assigned:

```text
public:  w0, w1, w2, w3, w4, w5, w6
private: w7
```

The ABI inspection confirmed that the seven leading witnesses had the intended
public meanings and that `authorization_secret` remained private.

This check is essential because Week 8 showed that a backend can produce a
valid proof without preserving Noir's public/private interface. I did not treat
successful compilation or proof verification as sufficient evidence by itself.


## 5. Lowering to R1CS Without Losing Meaning

I used the pinned Noir-Groth16 backend revision:

```text
4b7caace1f2128e454c8d0fe50cac1ec46b1e272
```

The backend parsed three `AssertZero` opcodes and preserved eight Noir witness
assignments. Strict interop lowering produced:

| Property | Result |
|---|---:|
| R1CS wires | 11 |
| Constraints | 5 |
| Public inputs | 7 |
| Private inputs | 1 |
| Outputs | 0 |

The independent snarkjs witness check reported `WITNESS IS CORRECT`. The full
wire vector was:

```text
[1, 11, 65, 5, 66, 1, 96, 13, 7, 49, 91]
```

Its meaning is:

```text
wire 0      constant one
wires 1-7   intended public Capsule vector
wire 8      private authorization secret
wires 9-10  intermediate products
```

This passes the public-wire semantic gate for this public-first fixture. It
does not solve arbitrary Noir witness remapping. The toolchain must still fail
closed when a circuit's layout does not satisfy the required R1CS ordering.


## 6. Generating and Checking the Groth16 Proof

I generated a development-only BN254 Groth16 key and proof with snarkjs 0.7.5.
The Powers of Tau and circuit-specific contributions used recorded public
development entropy and must not be treated as production ceremony material.

The generated public vector was exactly:

```text
[11, 65, 5, 66, 1, 96, 13]
```

I compared it semantically with the intended fixture before proceeding. The
comparison returned `True` and exit code 0.

The source verification matrix was:

| Public statement | Result |
|---|---|
| Generated intended vector | Accepted |
| Retained intended vector | Accepted |
| New state changed from 66 to 67 | Rejected |
| Capsule ID changed from 11 to 12 | Rejected |
| Replay domain changed from 13 to 14 | Rejected |

These tests show that the unchanged proof cannot be reused for any of the three
tested statement changes. They are proof-level tests; they do not yet show that
a CKB script obtains those values from real Cells.


## 7. Converting the Proof Into the CKB Wire Format

I reused the strict Rust adapter built in Week 9 and ran the seven-input Capsule
proof through it.

The adapter:

```text
parsed the snarkjs proof and verification key
constructed validated arkworks BN254 objects
verified the intended vector
rejected the changed-new-state vector
serialized the objects canonically
encoded the version-1 groth16-ckb Molecule objects
decoded them through the pinned endpoint
verified the decoded proof through the pinned host verifier
```

Its retained result was:

```text
arkworks_positive_verify=accepted
arkworks_negative_verify=rejected
groth16_ckb_wire_roundtrip=accepted
public_input_count=7
```

The main CKB-facing artifacts were:

| Artifact | Bytes |
|---|---:|
| Canonical verification key | 488 |
| Canonical proof | 128 |
| Seven-input public buffer | 228 |
| Molecule VK payload | 526 |
| Molecule witness payload | 386 |

The CKB Blake2b hash of the VK Cell payload was:

```text
069bf78f701ba1bfbda0e25739eee7f5bcb069e38a654820fb7e7bc24924af9f
```


## 8. Executing the Noir-Derived Proof in CKB-VM

The generic verifier remained pinned to the reproduced `groth16-ckb` revision:

```text
d64c769ffe2d2edb5eb308dc59058efda77c2f83
```

The production RISC-V verifier binary was:

```text
size:   98,464 bytes
format: stripped, statically linked RISC-V ELF
SHA-256:
9a6ed1137687a8d55037488bbdafa7d1f60aacc771d87ef82dde1a2023e011f8
```

The first verifier-only CKB-VM test accepted the Noir-derived proof. The same
proof with the new-state public input changed was rejected by the verifier with
exit code 5.

The accepted verifier-only transaction consumed:

```text
101,576,496 cycles
```

This was the first retained execution of a Noir-derived proof through the
production CKB-VM verifier in this project.


## 9. Building the Capsule Binding Type Script

I created a separate no-std Rust contract workspace for the application
boundary. It pins Rust 1.94.1 and the same `wire-decode` revision used by the
generic verifier.

The Capsule Type Script uses a fixed version-1 encoding:

```text
Type Script args, 65 bytes
  version        1 byte
  capsule_id    32 bytes
  replay_domain 32 bytes

Capsule Cell data, 65 bytes
  version          1 byte
  state commitment 32 bytes
  nullifier        32 bytes
```

It derives this vector from the actual transaction:

```text
[
  type_args.capsule_id,
  input_cell.state_commitment,
  input_cell.nullifier,
  output_cell.state_commitment,
  UPDATE_ACTION_ID,
  output_cell.nullifier,
  type_args.replay_domain,
]
```

It then compares those values with the ordered public inputs decoded from the
same `WitnessArgs.input_type` payload inspected by the verifier.

The script also requires:

- exactly one Capsule group input and one Capsule group output;
- the verifier lock to be preserved from input to output; and
- exactly one transaction input and output using that verifier lock.

Those shape rules prevent ambiguity about which input witness the two scripts
are authorizing.

The first dependency resolution selected `ckb-gen-types` and `ckb-hash` 1.1.1,
which require Rust 1.95. The contract workspace intentionally used Rust 1.94.1,
matching the pinned verifier. I corrected the manifest to pin the compatible
1.1.0 releases and retained the failed attempt as a dependency diagnostic.

The corrected format, check, clippy, and build commands returned exit code 0.
The resulting application script was:

```text
size:   28,032 bytes
format: stripped, statically linked RISC-V ELF
SHA-256:
6ccc3e145c55c7b2b4f5eb62d79b1174b602f0adc5dab9e0196b4754ed218962
```


## 10. The Proof-Bound Transaction Matrix

I first ran four transaction cases covering the central invariant. After that
passed, I expanded the harness to 12 cases covering the verifier, application
binding, serialization, dependency, lock, and script-group boundaries.

The first expanded build exposed a Rust type-inference error in the host test
harness for an untyped `None.pack()`. No CKB-VM case executed in that failed
attempt. I made the absent `Script` type explicit and reran the full validation.

The corrected root formatting, checking, clippy, and normal test suite all
returned exit code 0. The explicit CKB-VM matrix then ran all 12 cases:

| CKB-VM transaction | Observed result |
|---|---|
| Valid proof and correct Capsule transition | Accepted |
| Valid proof and changed new state | Rejected by binding script, code 30 |
| Valid proof and changed Capsule ID | Rejected by binding script, code 30 |
| Valid proof and changed replay domain | Rejected by binding script, code 30 |
| Invalid proof with transaction matching its supplied vector | Rejected by verifier, code 5 |
| VK Cell dependency omitted | Rejected by verifier, code 12 |
| Truncated Molecule witness | Rejected by verifier, code 17 |
| Malformed Capsule script args | Rejected by binding script, code 21 |
| Malformed input Cell data | Rejected by binding script, code 25 |
| Output verifier lock changed | Rejected by binding script, code 32 |
| Duplicate verifier-lock input | Rejected as witness ambiguity, code 33 |
| Duplicate Capsule input | Rejected as group ambiguity, code 23 |

The final result was:

```text
12 passed
0 failed
0 ignored
```

The accepted transaction, which executed both the verifier lock and Capsule
binding Type Script, consumed:

```text
101,625,705 cycles
```

The observed difference from the verifier-only transaction was 49,209 cycles.
Because the transactions use different lock/type arrangements, I am recording
that as an observed comparison rather than claiming it is an isolated Type
Script benchmark.


## 11. What the Result Means

The most important Week 10 test is:

```text
valid proof + correct Capsule transition -> accept
valid proof + wrong Capsule transition   -> reject
```

The proof does not become invalid when the transaction is changed. It remains a
valid proof for its original public vector. The transaction fails because the
Capsule Type Script derives a different vector from the changed Cells and
refuses to authorize the mismatch.

That is the distinction I wanted the project to make visible:

```text
cryptographic validity is one condition
application authorization is another condition
CKB accepts only when both conditions hold
```


## 12. Why This Is a great Milestone

Before Week 10, the project had CKB-shaped artifacts and host verification. It
did not yet have a transaction in which the actual RISC-V verifier and an
application-specific Cell transition rule executed together.

The current prototype now uses CKB's model directly:

```text
reusable verifier code Cell
+ circuit-specific VK Cell data
+ proof/public inputs in the transaction witness
+ verifier lock on the Capsule
+ application binding Type Script
+ old and new Capsule Cell data
```

CKB-VM makes it possible to reuse a Rust and arkworks-based Groth16 verifier as
a real on-chain script. The Cell model makes the authorization boundary
explicit: the transaction presents an old state and a proposed new state, and
the scripts decide whether that transition is valid.


## 13. How This Relates to Generated Solidity Verifiers

My longer-term reference point is the developer experience where a circuit tool
generates a Solidity verifier contract. The CKB architecture does not need to
copy that output exactly.

A future `noir-ckb` tool can keep the expensive Groth16 verification code
generic and produce a circuit/application bundle:

```text
verification-key Cell payload and data hash
proof/public-input encoder
Capsule binding script or generated binding configuration
deployment manifest
transaction builder
positive and negative CKB-VM tests
```

Week 10 proves the central architecture for one fixture. It does not yet provide
the generalized one-command generator.


## 14. What Week 10 Established

For the retained proof-bound Capsule fixture, Week 10 established that:

- the Noir ABI exposes the intended seven public fields and keeps the
  authorization witness private;
- the pinned backend preserves those fields in the required leading R1CS wire
  order;
- snarkjs generates a proof for the intended vector and rejects three changed
  public vectors;
- the strict adapter converts the proof into the exact arkworks and Molecule
  objects expected by the pinned CKB verifier;
- the production Groth16 verifier accepts the Noir-derived proof in CKB-VM;
- the Capsule Type Script derives the proof statement from actual input/output
  Cells and script arguments;
- the intended transition is accepted;
- valid-proof/wrong-transition cases are rejected; and
- malformed, missing, changed-lock, invalid-proof, and ambiguous-group cases
  fail at their intended boundary.

This is a complete development vertical slice, not a general or production
claim.



## 15. Questions Week 10 Answered

**Can the Noir-derived proof execute in the production CKB verifier?**  
Yes. The retained proof was accepted inside CKB-VM.

**Can a CKB application derive the public statement from actual Cells?**  
Yes, for the fixed seven-field version-1 Capsule encoding.

**Does a valid proof authorize a changed Capsule transition?**  
No. Changing the new state, Capsule ID, or replay domain caused the binding
script to reject the transaction.

**Can the verifier and binding script safely share one transaction witness?**  
Yes for the tested one-input design, with explicit checks that reject duplicate
Capsule or same-lock inputs.

**Can malformed data reach verification as an alternate interpretation?**  
The tested truncated witness, malformed args, malformed Cell data, missing VK,
and ambiguous group shapes all failed closed.


## 16. Questions I Still Need to Answer

1. What should the first stable `noir-ckb` manifest use to map Noir public ABI
   fields to Cell data, script args, action IDs, and replay domains?
2. Should the tool generate a Type Script from a template, generate a binding
   configuration consumed by a generic script, or support both?
3. How should arbitrary ACIR public and private witnesses be remapped into R1CS
   order without relying on source parameter ordering?
4. What commitment and nullifier design should replace the arithmetic
   development fixture?
5. Should replay protection commit to the consumed OutPoint, network identity,
   script hashes, an application domain, or a combination?
6. How consistently will the fresh-proof workflow reproduce across macOS,
   Linux, and CI once reviewers begin testing it?
7. What should the first developer preview package: only build/prove/test, or
   also deployment manifests and CCC transaction bindings?
8. What additional wrong-VK, mutation, and fuzz tests should be completed before
   devnet experimentation?
9. How should script sizes and cycle costs change as the public interface and
   circuit complexity grow?


## 17. Week 11 Direction: Developer Preview Packaging

The next milestone should turn the verified research path into a reviewer-facing
workflow:

```bash
noir-ckb build
noir-ckb prove
noir-ckb test
```

The first preview should:

- accept the supported proof-bound Capsule circuit;
- verify the exact compiler/backend pins before building;
- validate the public-wire layout and fail closed when it is incompatible;
- produce Groth16 proof, VK, public input, canonical, and Molecule artifacts;
- generate a machine-readable manifest containing hashes and semantic field
  order;
- build or locate the two pinned RISC-V scripts;
- run the positive and negative CKB-VM transaction matrix; and
- provide readable errors when a boundary fails.

A second Week 11 goal is external reproduction: document a fast committed-fixture
path and a full fresh-proof path, then collect reviewer feedback before adding
devnet deployment.


## 18. Reflection and Request for Feedback

The strongest lesson from Week 10 is that proof verification should be treated
as one part of transaction validation, not as the final application decision.

The project now has a working answer for one Capsule fixture:

```text
the verifier checks the mathematics
the Type Script checks the transaction meaning
```

I would especially value feedback on four design questions:

1. Is a reusable verifier plus circuit-specific VK Cell more useful to CKB
   developers than generating a new verifier binary for every circuit?
2. Should the first developer-facing binding format be a declarative manifest
   or generated Rust code?
3. Which transaction fields should be mandatory in a replay domain?
4. What would make the current local CKB-VM reproduction easiest for another
   developer to review?


## 19. Resources

- [noir-ckb-verifier](https://github.com/wamimi/noir-ckb-verifier)
- [Week 10 design](https://github.com/wamimi/noir-ckb-verifier/blob/main/docs/week-10-proof-bound-capsule.md)
- [Week 10 evidence](https://github.com/wamimi/noir-ckb-verifier/blob/main/evidence/week-10.md)
- [groth16-ckb](https://github.com/CECILIA-MULANDI/groth16-ckb)
- [Noir-Groth16](https://github.com/jamesbachini/Noir-Groth16)
- [Molecule in CKB](https://docs.nervos.org/docs/serialization/serialization-molecule-in-ckb)
- [CKB script concepts](https://docs.nervos.org/docs/script/intro-to-script)
