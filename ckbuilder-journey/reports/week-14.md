# CKBuilder Weekly Report - Week 14

**Name:** Nelly Njeri

**Week Ending:** 4 October 2026

## 1. Weekly Focus

This week I returned to a correctness problem discovered earlier in the
Noir-to-CKB pipeline: a proof could verify successfully while the backend exposed
the wrong value as public.

I implemented and tested a visibility-aware wire-layout correction in a maintained
fork of Noir-Groth16, then integrated that exact revision into `noir-ckb`.
The normal `build`, `prove`, and `test` workflow completed successfully with a
fresh development proof and all twelve Capsule transaction cases passing in CKB-VM.

The main result is that the tested scalar circuits no longer need their public
parameters written first just to make the backend expose the intended statement.
This removes a demonstrated workaround for the tested profile, not every Noir
compatibility limitation.

## 2. Direction After the SP1 Evaluation

Week 13 established a local verification baseline for the optimized SP1 PLONK
verifier on CKB. That was useful feedback and remains a separate experiment.
It did not establish a Noir-to-SP1 pipeline.

For this phase, I am keeping the project's focus on developers writing Noir
circuits and bringing supported applications to CKB. Rather than starting a
new bridge, I prioritized correcting and strengthening the existing
Noir-to-Groth16 path. This does not remove Groth16's circuit-specific trusted
setup requirement; it is a scoped engineering decision, not a claim that the
setup concern has disappeared.

## 3. The Bug, in a Small Example

The original regression uses a private value `x = 7` and a public value `y = 49`:

```rust
fn main(x: Field, y: pub Field) {
    assert(x * x == y);
}
```

The intended public statement is `49`. However, the original backend allocated
its proving wires in ACIR witness order, rather than arranging them according
to public/private visibility. In the private-first example, the public position
therefore contained `7`.

The resulting proof could verify against `[7]` while failing against `[49]`.
Verification was checking the backend's exported statement, not confirming that
the backend had preserved Noir's declared visibility.

Previously, putting `y` before `x` in the source made those positions line up.
That was a useful control case, but developers should not need that source-order
workaround for the tested circuit.

## 4. What Changed

The backend now carries an explicit mapping from original ACIR witnesses to
R1CS wires. Constraint references and the exported proving witness use the same
mapping. Internal consumers that still require ACIR-indexed values remain separate.

The layout places the constant first, followed by public outputs, public inputs,
private inputs, and remaining witnesses. Ordering inside each group follows
ACIR witness indices. The application compatibility claim remains narrower than
that internal layout: scalar Field parameters under the pinned compiler profile,
without Noir returns.

The patch also:

- rejects overlapping input/return witness classifications explicitly;
- distinguishes the raw `acir.wtns` diagnostic from the materialized proving
  `witness.wtns` produced by `interop`;
- adds regression fixtures for private-first, public-first, interleaved and
  zero-public layouts, plus the Capsule;
- documents that changed circuit layouts require regenerated setup keys and
  proofs, and that old debug JSON must be regenerated.

I published the change in my [Noir-Groth16 fork](https://github.com/wamimi/Noir-Groth16/tree/828025f3a0090e2934940956c0f5dc8093eb5532),
preserving attribution to James Bachini and the original contributors, repository
history, and the existing license declaration.
The [original issue](https://github.com/jamesbachini/Noir-Groth16/issues/1)
remains the reference for the reported failure.

## 5. Validation Results

I tested the correction at several boundaries rather than relying on proof
verification alone.

| Case | Observed result |
| --- | --- |
| Private-first square | Fresh proof exports `[49]`, verifies with `[49]`, rejects `[7]` |
| Public-first control | Fresh proof exports `[49]`, verifies with `[49]`, rejects `[7]` |
| Interleaved public/private parameters | Fresh proof exports `[49,121]`; swapped `[121,49]` rejects |
| Capsule | Fresh seven-input proof verifies and passes transaction-binding tests |
| Zero public inputs | Layout and witness checks pass; no fresh proof or VM claim |
| Unsupported toolkit ABI shapes | Arrays, structs and returns reject explicitly |

All four freshly generated proof cases also passed positive and negative
arkworks checks and positive CKB wire-format round trips through the adapter.

Backend formatting and strict Clippy passed. The all-feature backend suite
reported **95 passed and four ignored**. The ignored snarkjs smoke test was then
run separately and passed; the compiler compatibility corpus and two expensive
MSM tests remained unexecuted in that gate. The seven new layout tests are
included in the 95, not additional to them.

The toolkit's final normal suite reported **17 host tests passed**. Its fourteen
binary-dependent VM tests were ignored in that normal invocation. Earlier fresh
Capsule validation executed all fourteen separately; the final packaged workflow
executed the twelve-case transaction matrix, as described below.

## 6. Integration Into the Developer Workflow

`noir-ckb.toml` now pins the published fork at:

```text
828025f3a0090e2934940956c0f5dc8093eb5532
```

Noir beta.18, snarkjs 0.7.5, and the existing CKB verifier pin are unchanged.
The clean-checkout and exact-revision guards remain enabled, alongside checks
for ABI names, public/private counts, witness positions and expected values.
The fix does not replace these checks with an assumption that every circuit works.

I ran the normal commands against the fork:

```bash
./target/release/noir-ckb build
./target/release/noir-ckb prove
./target/release/noir-ckb test
```

The build reported seven public inputs, one private input, five constraints and
eleven wires. A new development setup and proof were generated. The expected
public vector was:

```text
[11, 65, 5, 66, 1, 96, 13]
```

The proof verified, while altered new-state, Capsule-identity and replay-domain
vectors were rejected. The final workflow reported:

```text
build_status=compatible
prove_status=verified
test_status=passed
ckb_vm_cases_passed=12
accepted_cycles=101642850
```

The twelve cases include the valid transition and rejection of wrong bindings,
an invalid proof, malformed data, missing verification-key data, a truncated
witness, a changed lock and ambiguous input groups. The cycle count is an
observation for this fresh proof and environment, not a performance guarantee.

This run used the local integration checkout before the toolkit changes were
committed; its manifest records that fact. It is not an independent clean-clone
result. The subsequent committed tree passed formatting, strict Clippy and all
seventeen host tests again.

## 7. Deliverables and Remaining Limits

The remaining boundaries are important:

- The normal application harness is still Capsule-specific, not a general CKB
  application generator.
- Scalar ordering regressions do not establish arbitrary compiler, array,
  struct, return-value or opcode compatibility.
- The Capsule is an arithmetic wiring fixture, not a secure private-state
  protocol or hiding commitment scheme.
- Setup material is development-only. No production ceremony, audit, testnet
  deployment or independent clean-clone reproduction is claimed.
- Groth16 over BN254 is not post-quantum.


## References

- [Week 13 report](https://github.com/wamimi/CKBuilder/blob/main/ckbuilder-journey/reports/week-13.md)
- [Backend fix commit](https://github.com/wamimi/Noir-Groth16/commit/828025f3a0090e2934940956c0f5dc8093eb5532)
- [Original Noir-Groth16 project](https://github.com/jamesbachini/Noir-Groth16)
- [Public-wire ordering issue](https://github.com/jamesbachini/Noir-Groth16/issues/1)
- [Current generated-proof setup](https://github.com/wamimi/noir-ckb-verifier/blob/090461a901ac569e3331ded05fc4c3896f0457c5/docs/current-generated-proof-workflow.md)
- [Week 14 technical notes](https://github.com/wamimi/noir-ckb-verifier/blob/090461a901ac569e3331ded05fc4c3896f0457c5/docs/week-14-wire-layout.md)
- [Week 14 evidence](https://github.com/wamimi/noir-ckb-verifier/blob/090461a901ac569e3331ded05fc4c3896f0457c5/evidence/week-14.md)
- [CKB Groth16 verifier dependency](https://github.com/CECILIA-MULANDI/groth16-ckb/tree/d64c769ffe2d2edb5eb308dc59058efda77c2f83)
