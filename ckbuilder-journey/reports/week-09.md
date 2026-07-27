# CKBuilder Weekly Report - Week 9

**Name:** Nelly Njeri  
**Week Ending:** 26 July 2026  


## 1. Weekly Focus

Week 9 moved my Noir-to-CKB project across the host interoperability boundary:

```text
retained snarkjs BN254 Groth16 JSON
-> strict typed parsing
-> validated arkworks 0.5 proof, VK, and public input
-> positive and negative arkworks verification
-> canonical compressed serialization
-> groth16-ckb version-1 Molecule objects
-> pinned endpoint decode and host verification
```

In Week 7, I established the two ends of the proposed pipeline: a compiled Noir
circuit on one side and a reproduced Groth16 CKB-VM verifier on the other. In
Week 8, I crossed the ACIR-to-Groth16 boundary and found that a proof can be
mathematically valid while exposing the wrong public value. The original
private-first circuit produced a proof that verified with private `x = 7`; a
public-first control produced the intended public vector `y = 49` and rejected
`7`.

That left the Week 9 question:

> Can I take the retained public-first proof from snarkjs, preserve its exact
> meaning while converting it into arkworks, and encode it in the same Molecule
> format expected by the existing CKB verifier?

For this one constrained fixture, the answer is now yes at the host boundary.
The same proof accepted `[49]` and rejected `[7]` in both snarkjs 0.7.5 and
arkworks 0.5. The resulting canonical bytes survived version-1 Molecule
encoding and the pinned `groth16-ckb` decoder unchanged, and the pinned host
verifier accepted the decoded positive payload.


## 2. What I Built

I built the Week 9 interoperability layer in the standalone
`noir-ckb-verifier` repository. The new Rust workspace contains a typed library
and a CLI named `noir-ckb-adapter`.

The adapter now:

```text
parses snarkjs Groth16 JSON
validates BN254 scalar and base-field values
validates G1 and G2 points
constructs arkworks proof and verification-key types
verifies the intended and wrong public vectors
serializes the objects canonically
constructs groth16-ckb Molecule entities
decodes them through the pinned endpoint decoder
compares the decoded canonical bytes with the originals
verifies the decoded positive payload through the pinned host verifier
writes reproducible artifacts and a hash manifest
```

I reused:

- arkworks 0.5 for typed BN254 and Groth16 operations;
- the `groth16-schema`, `wire-decode`, and `verifier-core` crates from
  Cecilia Mulandi's `groth16-ckb` repository;
- the non-secret public-first proof generated during my Week 8
  Noir-Groth16/snarkjs experiment.

My contribution this week is the fail-closed conversion and compatibility layer
around those components, its regression fixtures, and its evidence-backed
boundary checks.

## 3. Pinning the CKB Endpoint as a Dependency

I pinned the CKB wire and verifier crates to the exact `groth16-ckb` revision I
reproduced in Week 7:

```text
d64c769ffe2d2edb5eb308dc59058efda77c2f83
```

The endpoint worktree was clean when I recorded the Week 9 baseline. The
adapter imports the endpoint's own generated Molecule schema and decoder rather
than defining a similar-looking local format.

This matters because “Molecule encoded” is not precise enough by itself. A
second schema with slightly different tables, unions, versions, or field order
could produce valid Molecule bytes that the actual CKB verifier rejects. Pinning
the endpoint crates makes the implementation target concrete.

I generated and retained `Cargo.lock`. Cargo locked 110 packages. The relevant
versions include:

| Package | Locked version |
|---|---|
| `ark-bn254` | `0.5.0` |
| `ark-ec` | `0.5.0` |
| `ark-ff` | `0.5.0` |
| `ark-groth16` | `0.5.0` |
| `ark-serialize` | `0.5.0` |
| `ark-snark` | `0.5.1` |

The lockfile is 26,320 bytes with SHA-256:

```text
165c4f85eb3f36949a0ef24a02a79f16e734f5dd934376201347c88c40d19d61
```

## 4. Freezing the Cross-Library Fixture

The adapter input is the public-first compatibility proof from Week 8. Its
statement is still deliberately small:

```text
private x = 7
public  y = 49
constraint: x * x = y
```

The committed fixture contains only:

```text
verification_key.json
proof.json
public.json             -> ["49"]
wrong-public.json       -> ["7"]
manifest.json
```

It excludes the proving key, private witness, R1CS, WTNS, and Powers of Tau
files. The test values are intentionally public development data, but keeping
proving and witness material out of the fixture establishes the correct policy
for later non-trivial circuits.

The committed JSON files add one trailing line-feed byte compared with the
ignored Week 8 outputs. That changes their byte hashes, so I did not claim that
the files were byte-identical. I parsed both copies and confirmed that their JSON
values were semantically equal:

```text
vk_semantic_match= True
proof_semantic_match= True
public_semantic_match= True
```

This distinction is small but important for reproducible cryptographic tooling:

```text
same parsed cryptographic object
!=
same source file bytes
```

The fixture manifest records both sets of hashes and the normalization rule.

## 5. Why the Adapter Must Fail Closed

snarkjs represents curve coordinates and field elements as decimal strings in
JSON. It would be unsafe to treat those strings as trusted merely because they
came from a proof tool.

The adapter accepts only:

- protocol `groth16`;
- snarkjs curve identifier `bn128`;
- canonical unsigned decimal integers;
- values strictly below the corresponding BN254 modulus;
- affine G1 marker `z = 1`;
- affine G2 marker `z = [1,0]`;
- non-infinity points on the correct curve and in the correct subgroup;
- a public-input count matching both `nPublic` and the VK's `IC` length.

One subtle issue is that arkworks field parsing can reduce an integer modulo the
field modulus. For a strict format adapter, silent reduction is not acceptable.
Two different source integers could otherwise become the same field element.
The adapter therefore parses each decimal string into a large integer, compares
it with the relevant modulus, and only then constructs the arkworks field
element.

The tests retain this as an explicit failure case: a scalar equal to the BN254
scalar modulus must be rejected rather than converted to zero. A leading-zero
encoding such as `049` is also rejected as non-canonical.

## 6. G2 Coordinate Ordering Across Libraries

G2 points add another interoperability risk because each coordinate is an
extension-field element with two coefficients.

snarkjs/ffjavascript represents an Fq2 value as:

```text
[c0, c1]
```

arkworks constructs the same semantic value with:

```text
Fq2::new(c0, c1)
```

Some Solidity calldata examples reverse these coefficients for the Ethereum
precompile. That EVM-specific convention does not apply to this Rust-to-CKB
path. Copying an EVM conversion recipe here would produce the wrong point.

I mapped the snarkjs coefficients directly into arkworks and required final
proof verification as the cross-library confirmation. This is stronger than
assuming the mapping is correct because the coordinate arrays look familiar.

## 7. Preserving Public-Input Semantics Across Implementations

The main positive and negative condition remained:

```text
same proof + intended public [49] -> accept
same proof + wrong public [7]     -> reject
```

The Rust adapter produced:

```text
arkworks_positive_verify=accepted
arkworks_negative_verify=rejected
```

I then independently re-ran pinned snarkjs 0.7.5 against the committed fixture:

```text
public [49] -> OK, exit 0
public [7]  -> Invalid proof, exit 1
```

The negative exit code is the intended result. The proof and verification key
were unchanged between the two checks. All four fixture hashes were also
identical before and after verification.

The agreement can be summarized as:

| Implementation | `[49]` | `[7]` |
|---|---|---|
| snarkjs 0.7.5 | accept | reject |
| arkworks 0.5 | accept | reject |

This resolves the Week 9 semantic question for one fixture. It does not resolve
the Week 8 general public-wire ordering problem. The adapter deliberately starts
from the public-first fixture whose exported Groth16 public value was already
shown to match the Noir ABI.

## 8. Canonical arkworks Serialization

After typed validation and proof verification, the adapter uses arkworks
`CanonicalSerialize` with compressed encoding. It does not manually reverse
bytes or reinterpret JSON text as the CKB payload.

For the retained fixture, the canonical buffers are:

| Object | Bytes |
|---|---:|
| verification key | 296 |
| proof | 128 |
| one-element public-input buffer | 36 |

The public-input buffer contains a four-byte little-endian count followed by
one 32-byte canonical scalar. This matches the format consumed by the pinned
endpoint decoder and host verifier.

## 9. Building the Exact CKB Molecule Objects

The adapter constructs the endpoint's version-1 Molecule entities directly.
The two main generated payloads are:

```text
vk.mol.bin       -> Groth16VerifyingKey for VK Cell data
witness.mol.bin  -> Groth16Witness containing proof and public inputs
```

For the retained fixture:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `vk.bin` | 296 | `d1fff371445229aebd8ab9bbe99136d6cb7edc2ffc9cfbdb3d2167eb0b5b3ef2` |
| `proof.bin` | 128 | `e7f78ab7982a1f5bae7d0ca41a127441e1a2b313fd115c5f6689cc3c73128f83` |
| `public_inputs.bin` | 36 | `3ba8a49e2f3e686fd0d1400e8ca9a180f24d049dbc03f4932552eff4d31bba6d` |
| `vk.mol.bin` | 334 | `41e4aa9079d7801a218b2b660d7e9852e52cc8f884645506432e5f38ac7cd01e` |
| `witness.mol.bin` | 194 | `2f29111ce4a456dd147e352aab6c2d6ba1f270792f93e1a7e253c29037c7095b` |
| `vk_data_hash.bin` | 32 | `abc2ab2344b56daf6e2e8bc3b5c8425923a85bc49baab887231f5e8bfe159b36` |

The adapter computes the CKB Blake2b data hash of the Molecule VK payload:

```text
1fa6f0c18ff7b0d32abcd01ddf2ddcc3e4190be99add55bbf2418f045eb32715
```

This is the value that the reference integration pattern commits to in Type
Script arguments when locating the intended VK Cell. It should not be confused
with the SHA-256 digest of the 32-byte `vk_data_hash.bin` file. The first hash is
part of the CKB application protocol and the second is evidence identifying a file.

## 10. Verifying the Pinned Host Wire Boundary

Encoding bytes is not enough. The adapter immediately sends its generated
Molecule objects back through the pinned `groth16-ckb` decoder.

It checks three byte-for-byte round trips:

```text
decoded VK canonical bytes == adapter VK canonical bytes
decoded proof bytes        == adapter proof bytes
decoded public-input bytes == adapter public-input bytes
```

It then calls the pinned `verifier-core` host verification path. The retained
CLI result was:

```text
groth16_ckb_wire_roundtrip=accepted
adapter_run_exit_code=0
```

The negative integration test also encoded the same proof with `[7]`. That
payload was structurally valid Molecule, but the pinned host verifier rejected
it cryptographically. Separate tests confirmed that the pinned decoder rejects
wire version `2` and a truncated Molecule witness.

This combination matters:

```text
Molecule parses
!=
proof verifies
```

The adapter checks both properties.

## 11. Build and Test Evidence

The Week 9 host tools were:

| Tool | Version |
|---|---|
| Rust | `rustc 1.95.0 (59807616e 2026-04-14)` |
| Cargo | `cargo 1.95.0 (f2d3ce0bd 2026-03-21)` |
| snarkjs | `0.7.5` through the pinned npx invocation |

The compilation-quality gates all passed:

```text
cargo fmt --all -- --check
cargo check --locked --workspace --all-targets
cargo clippy --locked --workspace --all-targets -- -D warnings
```

The locked Rust test suite executed:

| Suite | Passed | Failed | Ignored |
|---|---:|---:|---:|
| parser-validation unit tests | 4 | 0 | 0 |
| interoperability integration tests | 7 | 0 | 0 |
| total | 11 | 0 | 0 |

The coverage includes:

- modulus-sized scalar rejection;
- non-canonical decimal rejection;
- non-affine marker rejection;
- off-curve point rejection;
- wrong protocol rejection;
- public-input count mismatch rejection;
- `[49]` acceptance and `[7]` rejection;
- exact Molecule/canonical-byte round trip;
- pinned host endpoint verification;
- wrong public input rejection after wire encoding;
- wrong wire-version rejection;
- truncated-witness rejection.

The locked release build returned exit code 0 and completed in 18.12 seconds.
The resulting binary was a 2,025,776-byte arm64 Mach-O executable with SHA-256:

```text
ed0f37ff16ad5c80323a3bf72bb7b81e0a22d7365bc65b421d85ac14b81d6576
```

## 12. Why This Is a CKB Milestone

Before Week 9, my working Groth16 artifact was still expressed in snarkjs JSON.
That proved something about the source backend, but it was not yet shaped for
the CKB verifier.

After Week 9, the same proof exists in the architecture expected by the CKB
endpoint:

```text
generic verifier code Cell
+ circuit-specific Molecule VK Cell data
+ Type Script args committing to the VK data hash
+ Molecule proof/public-input payload for WitnessArgs.input_type
```

This is directly connected to CKB's Cell model. The circuit-specific
verification key is data that can live in a Cell; the reusable verification
logic can remain in a code Cell; and the transaction witness carries the proof
and public inputs. The Type Script can commit to the exact VK data hash rather
than accepting an arbitrary key.

The flexibility of CKB-VM is what makes this architecture possible: the
endpoint can reuse a Rust/arkworks-based verifier compiled to RISC-V instead of
requiring a VM-specific cryptographic precompile for every proof workflow.

At the same time, CKB's explicit Cell transition model makes the remaining
security responsibility visible. The generic verifier still establishes only:

```text
verify(vk, public_inputs, proof)
```

It does not establish that the public inputs describe the actual transaction.

## 13. The Security Invariant Is Now Visible at Three Layers

My original project rule remains:

```text
proof verifies mathematically
!=
proof verifies the intended CKB state transition
```

The last three weeks have now exposed this idea at three separate boundaries:

1. **Compiler/backend semantics:** Week 8 showed that a proof can verify while
   the backend exposes the wrong Noir witness as public.
2. **Cross-library serialization:** Week 9 required snarkjs, arkworks, and the
   CKB host endpoint to agree on the same proof, key, value, point ordering, and
   public-input order.
3. **Application authorization:** the next stage must derive public inputs from
   the consumed and created Capsule Cells so a valid proof cannot be replayed
   against the wrong transition.

The long-term acceptance tests are still:

```text
valid proof + correct Capsule transition -> accept
valid proof + wrong Capsule transition   -> reject
```

Week 9 reaches the payload boundary needed to start those CKB transaction tests,
but it does not claim they have run.

## 14. What Week 9 Established

For one provenance-recorded public-first square-root fixture, Week 9 established
that:

```text
snarkjs proof/VK/public JSON can be parsed strictly
the parsed points and fields construct valid arkworks BN254 objects
snarkjs and arkworks agree that [49] accepts and [7] rejects
arkworks canonical compressed serialization is accepted by the pinned decoder
the exact groth16-ckb v1 Molecule objects can be constructed
the decoded canonical buffers match the originals byte for byte
the pinned groth16-ckb host verifier accepts the decoded positive payload
malformed wire versions and truncated witnesses are rejected
```

That is a constrained working interoperability path, not a claim of general
Noir support.


## 15. Questions Week 9 Answered

**Can the retained snarkjs proof be represented as validated arkworks 0.5
objects?**  
Yes, for the public-first fixture. Strict parsing, point validation, and typed
construction succeeded.

**Do snarkjs and arkworks agree on the public statement?**  
Yes. Both accept `49` and reject `7` for the same proof and verification key.

**Can source integers be passed directly to arkworks parsing?**  
Not safely for a fail-closed adapter. An explicit bound check is necessary to
prevent silent modular reduction.

**Should G2 coefficients be reversed like Solidity calldata?**  
No. snarkjs Fq2 `[c0,c1]` maps directly to arkworks `Fq2::new(c0,c1)` in this
path. The EVM precompile convention is a separate interface.

**Can the adapter produce the exact endpoint Molecule format without copying
the schema?**  
Yes. It imports the generated schema from the pinned endpoint revision and
constructs those entities directly.

**Does a successful Molecule decode prove the proof is valid?**  
No. Structural decoding and cryptographic verification are separate checks; the
adapter performs both.

**Can the generated VK be identified in the CKB application pattern?**  
Yes. The adapter emits the CKB Blake2b data hash of the Molecule VK payload for
the consuming Type Script to commit to.

## 16. Questions I Still Need to Answer

1. Will the exact 334-byte VK payload and 194-byte witness payload verify inside
   CKB-VM through a complete integration transaction?
2. What transaction-builder interface should place the VK CellDep, verifier
   CellDep, Type Script arguments, and `WitnessArgs.input_type` payload in the
   correct locations?
3. Should the first CLI release produce only host artifacts, or also a typed
   deployment manifest and TypeScript bindings for CCC?
4. How should the ACIR-to-R1CS stage remap arbitrary Noir public witnesses into
   the target public-wire order without changing constraints or witness values?
5. What canonical flattening rule should cover multiple Noir public inputs,
   return values, arrays, structs, and nested ABI values?
6. Which exact field encoding and hash function should represent old Capsule
   state, new Capsule state, Capsule identity, action, nullifier, and replay
   domain inside the proof?
7. Should the consumed OutPoint be part of the replay domain, or should the
   protocol use a stable application-level nullifier independent of transaction
   construction?
8. How will additional public inputs affect CKB-VM cycles? The Week 7 endpoint
   benchmark increased from 99,843,490 cycles for one input to 118,483,349 for
   64 inputs, so the Capsule public interface should be designed deliberately.
9. Which parts of the adapter would be most useful to contribute upstream:
   conversion code, compatibility fixtures, wire tests, CLI packaging, or all
   of them?

## 17. Next Milestone: Week 10

The next milestone should exercise the exact Week 9 artifacts inside the actual
CKB execution environment:

```text
Week 9 vk.mol.bin + witness.mol.bin
-> build a groth16-ckb integration transaction
-> load verifier and VK as CellDeps
-> place witness payload in WitnessArgs.input_type
-> execute the RISC-V verifier through CKB-VM
-> retain cycles, exit code, and rejection evidence
```

The minimum Week 10 proof tests should be:

```text
same proof + public [49] -> CKB-VM accepts
same proof + public [7]  -> CKB-VM rejects
wrong VK commitment     -> rejects
malformed witness       -> rejects
```

Only after that boundary is reproduced should I connect the proof to Capsule
state. The first Capsule design step will define a canonical public-input
manifest derived from the actual old and new Cells, identity, action, and replay
domain.

## 18. Reflection and Request for Feedback

The most useful lesson from Week 9 is that serialization is part of the security
boundary, not just packaging.

Each stage had to preserve a
typed mathematical object and its application meaning:

```text
decimal strings
-> bounded field elements
-> validated curve points
-> verified Groth16 objects
-> canonical bytes
-> versioned Molecule objects
-> decoded canonical bytes
-> verified endpoint inputs
```

The positive and negative public-input pair made this measurable. If `[49]`
accepted but `[7]` also accepted, or if either implementation disagreed, the
bridge would not be usable even if every file parsed.


Week 9 moved the project from a source-backend proof experiment to concrete
CKB-shaped verification artifacts. The next test is whether those exact bytes
survive the real CKB-VM transaction boundary.

## 19. Resources

- [noir-ckb-verifier](https://github.com/wamimi/noir-ckb-verifier)
- [groth16-ckb](https://github.com/CECILIA-MULANDI/groth16-ckb)
- [Noir-Groth16](https://github.com/jamesbachini/Noir-Groth16)
- [arkworks](https://github.com/arkworks-rs)
- [snarkjs](https://github.com/iden3/snarkjs)
- [Molecule in CKB](https://docs.nervos.org/docs/serialization/serialization-molecule-in-ckb)
- [CKB script concepts](https://docs.nervos.org/docs/script/intro-to-script)
