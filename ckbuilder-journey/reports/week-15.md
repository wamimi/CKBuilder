# CKBuilder Weekly Report - Week 15

**Name:** Nelly Njeri

**Week Ending:** 11 October 2026

## 1. Weekly Focus

This week I took the owned counter from something that worked on my machine to
something other developers can run and join.

At the start of the week the counter existed only as a local reference workflow.
By the end, it had been deployed and exercised on CKB testnet, packaged so the
same fresh-proof lifecycle runs on macOS ARM64 and Ubuntu 24.04 (x86_64 and
ARM64), and extended with a participant path: anyone can create and update their
own counter against the existing testnet deployment for about 262 testnet CKB,
instead of deploying their own copy for about 114,000.

I also tested whether a genuinely private example is feasible with the current
backend, and turned the answer into an accepted design for the next application:
a private tally where the proof, not a signature, authorizes each update.

## 2. The Owned Counter on Testnet

The owned counter is a small public application. Its Noir circuit proves that the
new count is the old count plus one. Its Type Script rebuilds the expected public
statement from the actual transaction (network, consumed Cell, old and new value,
successor Lock and capacity) and only then verifies the Groth16 proof. A standard
secp256k1 Lock controls who may spend the Cell.

On 7 October I deployed it on testnet and ran the full lifecycle:

| Stage | Transaction |
| --- | --- |
| Contract and verification key deployment | [0x0ee39d…27ad1](https://testnet.explorer.nervos.org/transaction/0x0ee39d547101eb348bc72a93f9a08b301353267487f3061f54a0070c44f27ad1) |
| Counter creation at zero | [0x57ee42…b269b](https://testnet.explorer.nervos.org/transaction/0x57ee42444304f1c1508c1b6136c4e1c33adb1ff8086eb885bd5abdd5080b269b) |
| Proof-authorized update 0 → 1 | [0x24a336…13bb6](https://testnet.explorer.nervos.org/transaction/0x24a336fbc09ea5330b83adcbaaf17e6eaafcb21776e13df6ec01d00daa613bb6) |

The confirmation client checked each transaction's commitment, input consumption
and exact live outputs (data, Type, Lock and capacity), and the deployment's code
and verification-key data hashes against the release.

Locally, the counter passes 48 adversarial CKB-VM cases (wrong proof, wrong key,
altered public values, a valid proof for a different Cell, changed owner or
capacity, ambiguous groups and malformed witnesses), range checks, and three
deliberately broken contracts that the tests must catch. The valid signed update
used **111,247,154 cycles** in that run.

Its proof is redundant: every input is public, so the Type could check `new = old + 1` directly. It demonstrates
that the plumbing and the transaction binding work. It does not demonstrate why
zero knowledge is needed, which is why the next application has a secret in it
(Section 6).

## 3. Making It Portable

Until this week, reproducing the counter required my exact tools and caches. I
added:

- **One pinned tool list** (`toolchains/platforms.json`) for macOS ARM64, Linux
  x86_64 and Linux ARM64, with archive and executable hashes for the CKB node,
  `ckb-cli` and Nargo. Linux pins were computed from the official release
  downloads; the macOS downloads reproduced the existing pins byte for byte.
- **A consent-first fetcher** that lists every URL before downloading, verifies
  both the archive and the extracted executable, and installs only that file.
- **A `quick` mode** that runs the fresh setup, proof, contract build and signed
  local deployment, creation and update, and records the adversarial suite as
  skipped. `local` still runs everything.
- **A container route** (Ubuntu 24.04, base image pinned by digest) that runs with
  no network access, and records the image's own build provenance.
- **A GitHub Actions workflow** running the container on hosted x86_64 and ARM64.

| Platform | Mode | Result |
| --- | --- | --- |
| macOS ARM64, native | quick | Passed (1 min 30 s, existing caches) |
| Ubuntu 24.04 ARM64, container (Colima) | quick and local | Both passed; local: 6/6 range checks, 48/48 VM cases, 3/3 mutations, signed lifecycle |
| Ubuntu 24.04 x86_64 and ARM64, GitHub Actions | quick | Passed |

The compiled counter circuit is byte-identical on macOS and Linux.

Running on other machines found real bugs, each by running rather than reading:

- The prerequisite check could make rustup download a toolchain while claiming
  to change nothing. It now only reads the installed list.
- A variable collision would have written the disposable private key's file path
  into the run manifest. It was caught on the first real run, before any commit.
- On Linux CI the container runs as a normal user: git refused the root-owned
  backend checkout, then Cargo could not write its target folder. Colima had
  passed only because it runs as root. Both were fixed.
- Run provenance initially described the host checkout instead of the image.
  Images are now stamped with their source at build time.

## 4. Joining the Existing Testnet Deployment

Each development setup produces a new verification key, so until now a
participant could only use the counter by deploying a copy of their own. I
published the deployment's proving files with the repository and added a
participant tool, `scripts/join-counter-testnet.py`:

- `init` verifies, before anything is signed, that the published files match the
  public deployment record, that the live code and key Cells on testnet equal
  those files byte for byte, that the proving key exports the published
  verification key, and that the participant's own toolchain reproduces the
  circuit and R1CS. Then it makes a test proof.
- `create` and `update` prepare unsigned transactions. The participant reviews,
  signs and sends them with their own `ckb-cli` account. `update` generates a
  fresh proof locally and is re-checked after signing.
- A `join-test` mode rehearses the whole path on a private local chain with a
  second key. It passed on macOS ARM64 (`join-test-validated`).

On 13 October, before submitting this report, I went through the path myself
from a new testnet account, separate from the deployment wallet, funded with one
10,000 CKB faucet Cell:

| Step | Transaction | Result |
| --- | --- | --- |
| Create at 0 | [0x0b6efcd7…888798c](https://testnet.explorer.nervos.org/transaction/0x0b6efcd70f111afd1c885557c84f7b93ef4ee8401dd9fe258b9fb677c888798c) | Committed; Cells checked |
| Update 0 → 1 | [0xe6589170…0089126f](https://testnet.explorer.nervos.org/transaction/0xe6589170381a02a249c37be8ab279e6229e2feb8f177f3d572bc63f30089126f) | Post-signing check passed; committed; Cells checked |

Doing it as a participant surfaced two usability problems, both fixed the same
night: a funding OutPoint without `:index` produced a Python traceback, and the
printed sign-and-send commands were unnumbered and easy to misread.

The trust model is stated in the guide: the proving key is single-party
development material, so its creator could in principle forge counter proofs, but
every update also requires the counter owner's signature.

I also consolidated the tester documentation into one guide,
`docs/try-the-counter.md`, covering local runs and the testnet path, and removed
the superseded guides.

## 5. Backend Decision: Continuing With Noir to Groth16

In Week 13 I evaluated the optimized SP1 PLONK verifier for CKB-VM, which was
suggested as a way to avoid per-circuit trusted setup. I reproduced its
verification (66,229,968 cycles for the upstream fixture) and a six-case
rejection matrix.

The limitation is not the verifier. SP1 proves programs compiled for its zkVM; it
does not take Noir circuits. Keeping Noir as the developer's language would need
a Noir-to-SP1 bridge (for example, proving an ACIR interpreter inside SP1), which
I did not find established and which would be a project of its own. Rewriting
each circuit in Rust would mean abandoning the Noir workflow this project exists
to support.

So for this stage I am continuing with Noir to Groth16 and the maintained
visibility fix from Week 14. The per-circuit setup cost remains real; the private
tally plan addresses it with a ceremony rather than a backend change. This is a
scoping decision, not a claim that SP1 is unsuitable or that no bridge exists.

## 6. Toward Private State: Feasibility and Design

To find out what a genuinely private example needs with the current backend:

- Noir beta.18 keeps its Poseidon2 hash private; only the raw permutation is
  public. The official `noir-lang/poseidon` library provides the sponge, but its
  latest release (0.4.0, which fixes a stale-cache bug) needs a newer compiler.
  Version 0.2.6 compiles, and for inputs of at most three elements its outputs
  match 0.4.0's test vectors. The design therefore limits every hash call to
  three inputs.
- A differential check ran a draft private circuit through Noir's own execution
  and through the pinned backend's R1CS. **All 19 cases agreed**, including
  creation, zero-increment updates, wrong secrets, overflows and invalid creation,
  with private inputs declared first. Throwaway secrets were deleted and a leak
  scan of the kept files found nothing.

The accepted design (`docs/private-tally-v2-spec.md`, not yet implemented):

- A separate profile, `private-tally/v2`. The deployed counter is unchanged.
- The Cell stores a commitment to a hidden 64-bit tally, refreshed with new
  randomness on each update. Knowing a secret key authorizes adding a hidden
  amount, including zero, so updates do not reveal activity.
- There is no signature: the proof is the authority. The full context binding
  (network, application, consumed Cell, old and new commitments, successor Lock
  and capacity) is what makes a proof copied from the mempool useless elsewhere.
- Documented limits: one Cell's updates remain linkable; update count, timing and
  fee payer are visible; losing the key freezes the tally.
- Before any testnet deployment: a multi-party phase 2 ceremony (a sequential
  relay of `snarkjs` contributions, verified by the coordinator, finished with a
  future CKB block hash as a public beacon). I am looking for around five
  contributors.


## 7. Community Update

I published a [follow-up on Nervos Talk](https://talk.nervos.org/t/noir-ckb-update-what-i-decided-after-the-direction-check-what-you-can-try-today-and-where-this-is-going/10968) to my earlier direction check.
It explains what I decided after the feedback (the counter as an ownership Lock
plus a proof-verifying Type; the private tally as a stateful, proof-authorized
design; staying with Noir to Groth16), how to try the counter locally and on
testnet, the call for ceremony contributors, and the longer-term direction:
a native developer toolkit for supported Noir circuits first, then browser
proving with wallet authorization once its compatibility with the existing
verifier is demonstrated.

## 8. Deliverables and Remaining Limits

Delivered this week: the testnet deployment and lifecycle; portable packaging
with macOS, Linux ARM64 and Linux x86_64 runs; the participant join path,
rehearsed locally and completed once on public testnet; one tester guide; the
private-tally feasibility check and accepted design; and the community update.

The remaining boundaries are important:

- The counter is a fixed public example, not a general application generator or
  arbitrary Noir support.
- Setup material is single-party and development-only. No production ceremony,
  audit or mainnet readiness is claimed.
- The full adversarial suite has run on macOS ARM64 and Linux ARM64. On x86_64 the
  lifecycle has passed in CI; the full suite there has not yet been confirmed.
- Intel Macs and Windows are not supported yet.
- The testnet participant run was mine. No outside developer has reproduced the
  workflow yet, so demand is not yet established.
- The private tally is designed, not implemented, and its ceremony has not run.
- Groth16 over BN254 is not post-quantum.

## References

- [Project repository](https://github.com/wamimi/noir-ckb-verifier)
- [Week 14 report](https://github.com/wamimi/CKBuilder/blob/main/ckbuilder-journey/reports/week-14.md)
- [Try the counter (tester guide)](https://github.com/wamimi/noir-ckb-verifier/blob/d4abb00d7817d0158fdd955039d59f32a4d0844f/docs/try-the-counter.md)
- [Counter specification](https://github.com/wamimi/noir-ckb-verifier/blob/d4abb00d7817d0158fdd955039d59f32a4d0844f/docs/week-15-acceptance-spec.md)
- [Counter test matrix](https://github.com/wamimi/noir-ckb-verifier/blob/d4abb00d7817d0158fdd955039d59f32a4d0844f/docs/owned-counter-test-matrix.md)
- [Testnet evidence, including the participant run](https://github.com/wamimi/noir-ckb-verifier/blob/d4abb00d7817d0158fdd955039d59f32a4d0844f/evidence/week-15-testnet.md)
- [Portable packaging evidence](https://github.com/wamimi/noir-ckb-verifier/blob/d4abb00d7817d0158fdd955039d59f32a4d0844f/evidence/week-15-portable.md)
- [Private tally v2 design](https://github.com/wamimi/noir-ckb-verifier/blob/d4abb00d7817d0158fdd955039d59f32a4d0844f/docs/private-tally-v2-spec.md)
- [SP1 evaluation](https://github.com/wamimi/noir-ckb-verifier/blob/d4abb00d7817d0158fdd955039d59f32a4d0844f/docs/week-13-sp1-evaluation.md)
- [Noir-Groth16 fork with the visibility fix](https://github.com/wamimi/Noir-Groth16/tree/828025f3a0090e2934940956c0f5dc8093eb5532)
- [CKB Groth16 verifier dependency](https://github.com/CECILIA-MULANDI/groth16-ckb/tree/d64c769ffe2d2edb5eb308dc59058efda77c2f83)
- [Nervos Talk update](https://talk.nervos.org/t/noir-ckb-update-what-i-decided-after-the-direction-check-what-you-can-try-today-and-where-this-is-going/10968)
