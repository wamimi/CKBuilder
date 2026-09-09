# CKBuilder Weekly Report - Week 12

**Name:** Nelly Njeri  
**Week Ending:** 16 August 2026  

## 1. Weekly Focus

Week 12 closes the CKBuilder program by moving `noir-ckb` from a developer
preview that works in my environment to a project that another developer can
clone, inspect, run, and challenge.

The main question was:

> Can I make the supported Noir-to-CKB path easy enough for an external
> developer to reproduce, while remaining clear about what works, what is still
> experimental, and what direction should come next?

The previous weeks established the technical path:

```text
Noir circuit
-> ACIR and witness
-> BN254 R1CS and Groth16 artifacts
-> strict Rust and Molecule conversion
-> generic proof verification in CKB-VM
-> application-specific binding to a typed Cell transition
```

Week 11 packaged that path behind three commands:

```bash
noir-ckb build
noir-ckb prove
noir-ckb test
```

Week 12 focused on the layer around those commands: reviewer documentation, a
short public smoke test, retained evidence, explicit limitations, and a focused
request for technical and product-direction feedback.

## 2. What the Current Preview Demonstrates

The current example is a proof-bound Capsule transition. The Noir circuit has
seven ordered public values:

```text
capsule_id
old_state_commitment
old_nullifier
new_state_commitment
action_id
new_nullifier
replay_domain
```

It also has one private authorization value. A Groth16 proof establishes the
circuit relation, while the Capsule binding Type Script derives the seven
public values from the actual CKB transaction.

The two scripts have different responsibilities:

```text
generic Groth16 verifier = is this proof mathematically valid?
Capsule binding script   = does its public statement describe this transition?
```

The transaction is accepted only when both scripts accept. This enforces the
project's central rule:

```text
valid proof + intended typed Cell transition -> accept
valid proof + wrong typed Cell transition    -> reject
```

This distinction matters because proof verification alone does not explain
which Cell, state update, action, verification key, or replay context the proof
was supposed to authorize.

## 3. A Short Reviewer Path

I added a reviewer quickstart and an executable smoke-test script. After cloning
the project and its pinned `groth16-ckb` dependency, a reviewer can run:

```bash
./scripts/reviewer-smoke.sh
```

The script:

1. validates the pinned repository revision and Rust toolchains;
2. records the source and environment information;
3. runs formatting, checking, Clippy, and the normal host tests;
4. builds the generic Groth16 verifier for RISC-V;
5. builds the Capsule binding Type Script for RISC-V; and
6. runs the retained 12-case transaction matrix in CKB-VM.

This short path uses a committed public development fixture. It does not
regenerate a private witness, trusted-setup transcript, proving key, or proof.
That makes it the safer and faster entry point for review.

The longer path remains available for reviewers who want to start from the Noir
source and regenerate the development proof:

```bash
cargo +1.95.0 build --locked --release \
  -p noir-ckb-cli \
  --bin noir-ckb

./target/release/noir-ckb build
./target/release/noir-ckb prove
./target/release/noir-ckb test
```

All generated witness, Powers of Tau, proving-key, and ZKey material remains in
ignored directories and is clearly labeled development-only.

## 4. Fresh Week 12 Catch-up Evidence

I reran both the short retained-fixture path and the complete generated-proof
path on 1 September 2026. These are fresh observations, not values copied from
earlier reports.

### Retained-fixture reviewer smoke test

The short reviewer path completed with:

```text
reviewer_smoke_status=passed
ckb_vm_cases_passed=12
accepted_cycles=101625705
```

The normal suite passed 14 host tests: four adapter unit tests, seven
interoperability tests, and three `noir-ckb` workflow tests. The binary-dependent
tests were correctly listed as ignored in the normal suite and then executed
explicitly after both RISC-V binaries were supplied.

### Full generated-proof path

The build stage reported:

```text
build_status=compatible
public_input_count=7
private_input_count=1
constraint_count=5
wire_count=11
```

The generated public vector matched the intended binding order:

```text
[11, 65, 5, 66, 1, 96, 13]
```

The proof stage reported `prove_status=verified`. The proof verified against
the intended vector and rejected altered vectors for the new state, Capsule
identity, and replay domain.

The test stage selected the fresh proof through its generated manifest and
reported:

```text
test_status=passed
ckb_vm_cases_passed=12
accepted_cycles=101640005
```

The valid proof and correct transition were accepted. Eleven expected negative
cases were rejected, including:

| Negative case | Observed rejection |
|---|---:|
| Truncated witness | verifier code `17` |
| Missing verification-key Cell | verifier code `12` |
| Invalid proof | verifier code `5` |
| Malformed Capsule arguments | binding code `21` |
| Malformed Capsule Cell data | binding code `25` |
| Changed verifier lock | binding code `32` |
| Duplicate verifier-lock input | binding code `33` |
| Duplicate Capsule input | binding code `23` |
| Wrong Capsule identity | binding code `30` |
| Wrong new state | binding code `30` |
| Wrong replay domain | binding code `30` |

The two cycle values are observations for their exact proofs, binaries, and
environment. They are useful comparison points, not performance guarantees.

Before pushing the reviewer workflow, the committed tree also passed the Bash
syntax check, Rust formatting, and all 14 normal host tests. The Week 12 changes
were pushed on 3 September 2026 at revision:

```text
4b89aba5a2d8447db13129b1aa65b12873c11abb
```

## 5. The Compatibility Boundary Is Deliberately Narrow

The preview does not claim that every Noir program can become a CKB
application. It currently supports one tested, public-first circuit and an
exact pinned toolchain.

This restriction comes from the public-wire mismatch discovered in Week 8. In
the original square-root circuit, Noir declared `y = 49` public and `x = 7`
private, but the experimental backend produced a proof whose public value was
`7`. The proof was mathematically valid while exposing the wrong program value.

Reordering the fixture to put the public parameter first made the backend's
positional assumption line up with the Noir ABI, but that is a compatibility
workaround rather than a general fix. `noir-ckb` therefore checks the supported
layout and fails closed instead of claiming that successful proof verification
proves ABI preservation.

On 20 August 2026, I opened an upstream Noir-Groth16 issue describing the
problem in both R1CS public-wire allocation and WTNS generation. I have offered
to prepare regression fixtures and a focused pull request if the proposed
remapping direction matches the maintainer's intended convention. The issue was
still open on 9 September 2026, with no maintainer response or accepted fix to
report.

## 6. Why This Moves Me Closer to Building on CKB

At the beginning of this project, the goal sounded similar to generating a
Solidity verifier from a Noir circuit. The CKB version requires an additional
application layer.

A generated verifier can check proof mathematics, but a useful CKB application
also needs to derive the proof's meaning from the transaction. The Type Script
must connect the proof to the consumed Cell, the created Cell, the action, and
the replay boundary.

The current vertical slice now demonstrates that complete separation:

```text
Noir defines the private computation and public statement.
The adapter produces the exact CKB verifier artifacts.
The generic verifier checks the proof in CKB-VM.
The binding Type Script checks what the proof authorizes.
CKB accepts only when proof validity and transition meaning agree.
```

That is more than placing proof bytes in a witness. It is a working reference
pattern for proof-carrying typed Cell transitions.

## 7. What Is Still Experimental

The current result is a developer preview, not a production protocol.

| Area | Current status |
|---|---|
| Noir support | One tested public-first compatibility profile |
| Groth16 setup | Public development entropy; not a production ceremony |
| State commitment | Arithmetic placeholder |
| Nullifier | Arithmetic placeholder |
| Replay domain | Fixed development value |
| Execution | Local and hosted CKB-VM testing |
| Network deployment | Not performed |
| Independent reproduction | Requested, not yet completed |
| Security review | Not audited |

The commitment and replay placeholders prove that values are carried through
the complete pipeline and enforced consistently. They do not yet provide the
security properties needed for a real private-state application.

An alpha GitHub release remains blocked until at least one other developer
successfully runs the clean-clone path, or returns a failure that I can diagnose
and resolve. I am also not publishing the CLI to crates.io yet because the
supported platforms, installation behavior, package ownership, and public API
are not stable.

## 8. Post-Program Direction

The most sustainable direction appears to be a toolkit with one concrete
reference application, rather than either a completely generic promise or a
single closed application.

The toolkit layer would provide:

```text
supported Noir compilation profiles
artifact and ABI validation
Groth16 generation and conversion
versioned public-input binding manifests
CKB verifier and Type Script templates
positive and wrong-transition test generation
transaction inspection and reproducible bundles
```

A private credential or eligibility transition is a promising first reference
application because it makes the binding requirement visible. A user could
prove that private attributes satisfy a policy without putting those attributes
on-chain, while the CKB scripts ensure that the proof authorizes one particular
Cell transition and cannot simply be attached to another action.

This direction still needs ecosystem validation. I want to understand whether
it complements existing CKB identity and attestation work, whether another use
case such as proof of reserves is more urgent, and which parts should be
contributed upstream instead of maintained in this repository.



## 9. Resources

- [`noir-ckb-verifier` repository](https://github.com/wamimi/noir-ckb-verifier)
- [Week 12 reviewer quickstart](https://github.com/wamimi/noir-ckb-verifier/blob/main/docs/reviewer-quickstart.md)
- [Week 12 retained evidence](https://github.com/wamimi/noir-ckb-verifier/blob/main/evidence/week-12.md)
- [Week 12 external review questions](https://github.com/wamimi/noir-ckb-verifier/blob/main/docs/week-12-review-request.md)
- [Noir-Groth16 public-wire issue](https://github.com/jamesbachini/Noir-Groth16/issues/1)
- [`groth16-ckb`](https://github.com/CECILIA-MULANDI/groth16-ckb)
- [CKBuilder reports](https://github.com/wamimi/CKBuilder/tree/main/ckbuilder-journey/reports)
- [The Proof Is Valid. The Transition Might Not Be.](https://talk.nervos.org/t/the-proof-is-valid-the-transition-might-not-be/10550)

## 10. Reflection

My first weeks in CKBuilder were about learning to stop looking for contract
storage and to see CKB applications as transitions between live Cells. The last
weeks extended the same lesson to zero-knowledge proofs.

A proof is not an application decision by itself. It becomes part of a CKB
application only when its public meaning is derived from the transaction and
enforced by the scripts that decide whether the transition is valid.

The most important Week 12 outcome is therefore not a claim that `noir-ckb` is
finished. It is that the supported path is now public, documented, evidence-
backed, and narrow enough for other developers to reproduce and criticize. The
next version should be shaped by that feedback rather than by adding more
cryptography before the use case and integration boundary are validated.
