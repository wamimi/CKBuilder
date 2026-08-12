# CKBuilder Weekly Report - Week 11

**Name:** Nelly Njeri

**Week Ending:** 9 August 2026


## 1. Weekly Focus

Week 11 turned the working Noir-to-CKB vertical slice from Week 10 into a
developer preview with three top-level commands:

```bash
noir-ckb build
noir-ckb prove
noir-ckb test
```

The underlying path is still:

```text
Noir circuit
-> version-pinned ACIR and witness
-> R1CS and BN254 Groth16 artifacts
-> strict arkworks and Molecule conversion
-> generic Groth16 verifier in CKB-VM
-> Capsule Type Script binding the proof to the actual Cell transition
```

The difference is that a reviewer no longer has to manually coordinate every
tool and artifact boundary. The new `noir-ckb` CLI checks the supported
versions and repository revisions, runs each stage in order, validates the
meaning of the public inputs, records hashes in machine-readable manifests,
and executes the positive and negative CKB-VM transaction matrix.

The main Week 11 question was:

> Can the Week 10 research path be packaged so that another developer can
> build, prove, and test the supported proof-bound Capsule flow through a small,
> explicit command surface?

For the retained development environment, the complete packaged command path
now passes. A separate hosted GitHub Actions workflow also passes the retained
public fixture, both RISC-V script builds, and the 12-case CKB-VM matrix. A
full external clean-clone run of `build`, `prove`, and `test` remains a separate
review gate.


## 2. Why Packaging Is Part of the Security Work

At first, packaging can look like a usability task that comes after the
cryptographic work. In this project, it is also part of the security boundary.

The manual workflow involves:

- two pinned Rust toolchains;
- a pinned Noir compiler;
- a pinned ACIR-to-R1CS backend repository;
- a pinned CKB Groth16 verifier repository;
- snarkjs setup, proof, and verification commands;
- arkworks object validation;
- Molecule encoding;
- two RISC-V CKB scripts;
- proof/public-input placement in a CKB witness; and
- an application Type Script that derives the expected statement from Cells.

A reviewer could run all the commands successfully while accidentally mixing
artifacts from different runs, using a different source revision, reversing a
public-input order, or testing an old proof against a new transaction fixture.
The CLI therefore does more than shorten the command list. It makes those
assumptions explicit and fails before continuing when they do not match.

The project rule remains:

```text
proof verifies mathematically
!=
proof authorizes the intended CKB state transition
```

Week 11 adds another related rule:

```text
commands completed successfully
!=
the same compatible artifacts moved through every stage
```


## 3. The `noir-ckb` Developer Preview

I added a Rust CLI package named `noir-ckb-cli`, which builds the top-level
binary `noir-ckb`. The current version is:

```text
noir-ckb 0.1.0-alpha.1
```

The retained release build produced:

| Property | Result |
|---|---|
| Build result | exit code 0 |
| Exact size | 2,691,568 bytes |
| Platform | macOS arm64 Mach-O |
| SHA-256 | `239c2b376d3d16cdb5055be79f76c40fa71b60acc9822f892258139fb65cfd53` |

The preview deliberately exposes only three workflow commands. It does not yet
present a stable library API, deployment interface, or general circuit
generator.


The repository-level configuration lives in `noir-ckb.toml`. It records:

- the supported circuit package and input paths;
- the exact Noir version;
- expected public and private field names and values;
- the two external repository locations and revisions;
- Rust, snarkjs, and CKB target versions;
- the ordered mapping from public inputs to CKB transaction fields; and
- the negative public vectors that must be rejected.

This makes the supported compatibility claim inspectable instead of leaving it
inside a sequence of shell commands.


## 4. Pinned Compatibility Profile

The Week 11 preview uses the following development profile:

| Component | Pinned value |
|---|---|
| Nargo | `1.0.0-beta.18` |
| noirc | `1.0.0-beta.18+99bb8b5cf33d7669adbdef096b12d80f30b4c0c9` |
| Noir-Groth16 | `4b7caace1f2128e454c8d0fe50cac1ec46b1e272` |
| groth16-ckb | `d64c769ffe2d2edb5eb308dc59058efda77c2f83` |
| snarkjs | `0.7.5` |
| Host Rust | `1.95.0` |
| Contract Rust | `1.94.1` |
| CKB target | `riscv64imac-unknown-none-elf` |

The CLI checks these assumptions instead of treating them as documentation
only. It also checks that the two external repositories have the exact expected
revisions and no tracked changes before using them.

Different local paths can be provided through environment variables, but the
source revisions remain fixed for this preview:

```bash
export NOIR_GROTH16_REPO=/absolute/path/to/Noir-Groth16
export GROTH16_CKB_REPO=/absolute/path/to/groth16-ckb
```


## 5. `noir-ckb build`: Establishing Compatibility Before Proving

The `build` command performs the compatibility and compilation stages:

```text
validate tools and source revisions
-> build the pinned Noir-Groth16 backend
-> build the generic CKB Groth16 verifier
-> build the Capsule binding Type Script
-> compile the Noir circuit
-> inspect the ABI and witness visibility
-> lower ACIR to R1CS and WTNS
-> independently check the witness
-> validate public/private wire positions
-> write a hashed build manifest
```

The retained command returned:

```text
build_status=compatible
exit_code=0
```

Its compatibility summary was:

| Property | Result |
|---|---:|
| Public inputs | 7 |
| Private inputs | 1 |
| Constraints | 5 |
| Wires | 11 |
| Outputs | 0 |
| Independent witness check | Correct |

The public tuple remained:

```text
[11, 65, 5, 66, 1, 96, 13]
```

with the following meanings:

```text
capsule_id
old_state_commitment
old_nullifier
new_state_commitment
action_id
new_nullifier
replay_domain
```

The private `authorization_secret` remained outside that vector.

The successful build used run ID `1786440542305`. Its 2,668-byte
`build-manifest.json` had SHA-256:

```text
28276404d557b51f17c18dc7a757bbf6684017f35ac1854d868078fedda52ec8
```

The manifest records the source revisions and hashes of the circuit artifact,
R1CS, witness, parsed ACIR summary, and two CKB scripts. Later stages validate
those values before consuming the build.


## 6. Preserving the Week 8 Public-Wire Failure as a Required Regression

One of the most important Week 11 choices was not to hide the Week 8 failure
now that the supported Capsule fixture works.

Week 8 showed that the original private-first square-root circuit could produce
a mathematically valid Groth16 proof while exposing private `x = 7` as the
public value instead of intended public `y = 49`. The proof verified, but the
backend had not preserved the Noir ABI meaning.

The new CLI contains an explicit semantic gate with tests that require:

```text
public-first witness layout  -> accept
private-first witness layout -> reject
```

The three CLI unit tests passed:

- the public-first semantic layout is accepted;
- the private-first regression layout is rejected; and
- the CKB-VM cycle result is parsed from the expected matrix output.

This means the preview cannot silently broaden its compatibility claim merely
because the backend can parse another ACIR artifact. Until general witness
remapping exists, unsupported layouts must fail closed before setup or proof
generation.


## 7. `noir-ckb prove`: Generating and Checking the Proof Bundle

The `prove` command consumes the latest compatible build manifest and then:

```text
creates development-only setup material
-> verifies the Powers of Tau and circuit ZKey
-> generates a Groth16 proof
-> checks the exact seven-field public vector
-> requires all configured wrong vectors to fail
-> converts the VK, proof, and public inputs through arkworks
-> verifies the positive and negative cases again
-> writes groth16-ckb Molecule payloads
-> decodes and verifies the CKB endpoint round trip
-> writes a proof manifest and VK data hash
```

The retained command returned:

```text
prove_status=verified
exit_code=0
```

The proof verified with:

```text
[11, 65, 5, 66, 1, 96, 13]
```

The same unchanged proof rejected each altered statement:

| Negative case | Result |
|---|---|
| New state changed | Rejected |
| Capsule ID changed | Rejected |
| Replay domain changed | Rejected |

The command reached its success result only after the snarkjs checks,
corresponding arkworks positive and negative verification, and pinned CKB
endpoint round trip all completed.

The main CKB-facing artifacts were:

| Artifact | Bytes |
|---|---:|
| Canonical verification key | 488 |
| Canonical proof | 128 |
| Seven-input public buffer | 228 |
| Molecule VK payload | 526 |
| Molecule witness payload | 386 |

The CKB data hash of the generated VK Cell payload was:

```text
9ea09446b2406dcbcbbbe3d9562f216d7181c1e67725da4dc5ccd9de6c4259e9
```

The successful proof used run ID `1786440704127`. Its 2,707-byte proof
manifest had SHA-256:

```text
11f9694aff35dcf74808938ed40d0abf292f4e7051fe56bceec891be1569e5bd
```

The Powers of Tau contribution and circuit setup used recorded public
development entropy. They are suitable for reproducing this non-secret test,
not for production use. 


## 8. `noir-ckb test`: Executing the Proof-Bound Transition

The `test` command loads the latest proof manifest rather than relying on an
assumed directory. It reruns the host suite, selects that generated fixture,
and passes it to the CKB-VM transaction harness.

The normal workspace suite passed 14 host tests:

| Test group | Passed |
|---|---:|
| Adapter validation unit tests | 4 |
| Adapter interoperability tests | 7 |
| CLI semantic and output tests | 3 |
| **Total** | **14** |

The 14 binary-dependent CKB-VM tests were listed as ignored in the normal
suite, as intended. The command then ran the explicit 12-case Capsule matrix
with the generated proof and both RISC-V binaries:

| CKB-VM transaction | Result |
|---|---|
| Valid proof and correct Capsule transition | Accepted |
| Valid proof and changed new state | Rejected, binding code 30 |
| Valid proof and changed Capsule ID | Rejected, binding code 30 |
| Valid proof and changed replay domain | Rejected, binding code 30 |
| Invalid proof with transaction matching its altered vector | Rejected, verifier code 5 |
| VK Cell dependency omitted | Rejected, verifier code 12 |
| Truncated Molecule witness | Rejected, verifier code 17 |
| Malformed Capsule script args | Rejected, binding code 21 |
| Malformed input Cell data | Rejected, binding code 25 |
| Output verifier lock changed | Rejected, binding code 32 |
| Duplicate verifier-lock input | Rejected, binding code 33 |
| Duplicate Capsule input | Rejected, binding code 23 |

The final matrix result was:

```text
12 passed
0 failed
0 ignored
```

The accepted transaction consumed:

```text
101,665,331 CKB-VM cycles
```

This is the observed result for the generated Week 11 development proof and
the pinned binaries. It is not a general performance guarantee.

The successful test used run ID `1786440846691`. Its 936-byte
`test-report.json` had SHA-256:

```text
5cf48a51db3b81bc7c9942dfc61117f601b335ccff6f927bee94b2e943b7518d
```


## 9. Run Manifests and Artifact Provenance

Each command creates a new run directory instead of overwriting the previous
result:

```text
target/noir-ckb/proof-bound-capsule/
  current-build.json
  current-proof.json
  current-test.json
  builds/<run-id>/build-manifest.json
  proofs/<run-id>/proof-manifest.json
  tests/<run-id>/test-report.json
```

The `current-*.json` files identify the latest completed stage. The next
command loads and validates the corresponding manifest, including important
hashes and compatibility fields, before continuing.

This gives the preview a simple provenance chain:

```text
validated source and build artifacts
-> identified proof and wire artifacts
-> identified transaction test result
```

Generated witnesses, setup material, proving keys, proofs, adapter output, and
test reports remain below ignored `target/` paths. The repository retains
their hashes and reviewed results without accidentally committing generated
private-witness or development-setup material.


## 10. Reviewer Documentation and Feedback Path

The root README now provides the short developer-preview path:

```bash
cargo +1.95.0 build --locked --release \
  -p noir-ckb-cli \
  --bin noir-ckb

./target/release/noir-ckb build
./target/release/noir-ckb prove
./target/release/noir-ckb test
```

The CLI README explains prerequisites, external repository layout, environment
overrides, command responsibilities, output paths, compatibility policy, and
explicit non-goals.

I also added:

- a detailed Week 10 reproduction guide for reviewers who want to inspect the
  underlying commands;
- a Week 11 developer-preview design document;
- an evidence record with exact local and CI results; and
- a GitHub issue template for structured reproduction feedback.

The issue template asks reviewers to provide their platform, tool versions,
source revisions, exact command, complete output, relevant generated manifest,
and confirmation that no private witness or setup material was attached. This
should make reproducibility reports more useful than an unstructured “it did
not work” issue.


## 11. Hosted CI: A Useful Failure Before the Green Result

I added a GitHub Actions workflow that runs on pushes, pull requests, and
manual dispatch. It checks formatting, Clippy, and host tests; builds both CKB
scripts; and runs the retained 12-case CKB-VM matrix on Ubuntu.

The first hosted run did not pass. Checkout, Rust installation, formatting,
Clippy, host tests, and pinned verifier checkout succeeded, but the generic
verifier build failed while compiling `ckb-std`:

```text
failed to find tool "riscv64-unknown-elf-gcc"
```

Installing the Rust target was not enough. The CKB dependency also required a
bare-metal RISC-V C compiler on the runner.

I corrected the workflow to:

- install Ubuntu's `gcc-riscv64-unknown-elf` package;
- print the compiler version as evidence;
- use the Node 24-based `actions/checkout@v6` action; and
- build the generic verifier and Capsule binding script in separate steps so
  future failures identify the exact boundary.

The hosted run history was:

| Run | Revision | Result |
|---|---|---|
| `31521030261` | `650d62f154e221c834f744626c2f81f281d9a4f6` | Failed: missing RISC-V C compiler |
| `31522089140` | `4d76fabed93a87097b8383c9fbafe7b696de87b2` | Passed all required steps |
| `31522501277` | `07247b4b6579e1bcdd904b43f5fc9b2cc02e28bc` | Passed all required steps at final branch tip |

The final branch-tip run passed:

```text
checkout
RISC-V C compiler installation
pinned Rust toolchain installation
formatting, Clippy, and host tests
pinned generic verifier checkout and build
Capsule binding script build
retained 12-case CKB-VM matrix
```



## 12. What Changed From Week 10

Week 10 proved that the architecture works for one fixture. Week 11 made that
architecture easier to inspect and repeat.

| Week 10 | Week 11 |
|---|---|
| Manual multi-tool workflow | Three top-level CLI commands |
| Paths coordinated by shell commands | Versioned configuration and environment overrides |
| Individual evidence files | Linked build, proof, and test manifests |
| Public-wire issue documented | Incompatible layout enforced as a regression rejection |
| Local CKB-VM matrix | Packaged local matrix plus hosted retained-fixture CI |
| Reviewer reproduces long command sequence | Reviewer starts with `build`, `prove`, and `test` |

Week 11 did not replace the underlying compiler, backend, adapter, verifier, or
Type Script. It packaged and guarded the exact boundaries already established
in Weeks 7 through 10.




## 13. Week 12 Direction

Week 12 should focus on completing the developer-preview handoff rather than
expanding into a new production use case before the CKBuilder program ends.

The proposed final milestone is:

```text
fresh external reproduction
-> installation and error-message feedback
-> concise demo and architecture explanation
-> final compatibility and limitation record
-> post-program roadmap informed by CKB community feedback
```

The practical goals are:

- have at least one reviewer attempt the documented path from a clean clone;
- retain their environment, commands, results, and any failures;
- improve the shortest setup and troubleshooting instructions;
- confirm the CLI fails clearly when a pin, repository, compiler, or artifact
  is wrong;
- prepare a short demonstration showing correct-transition acceptance and
  wrong-transition rejection;
- separate what is working today from the longer-term production and ecosystem
  roadmap.

After the CKBuilder milestone, the next major direction can be chosen using
ecosystem feedback. Suggestions so far include DID/KYC proofs, proof of
reserves, and keeping the work as an adaptable toolkit for several application
contexts.



## 24. Resources

- [noir-ckb-verifier](https://github.com/wamimi/noir-ckb-verifier)
- [`noir-ckb` CLI documentation](https://github.com/wamimi/noir-ckb-verifier/blob/main/crates/noir-ckb-cli/README.md)
- [Week 11 developer-preview design](https://github.com/wamimi/noir-ckb-verifier/blob/main/docs/week-11-developer-preview.md)
- [Week 11 retained evidence](https://github.com/wamimi/noir-ckb-verifier/blob/main/evidence/week-11.md)
- [Week 10 reproduction guide](https://github.com/wamimi/noir-ckb-verifier/blob/main/docs/reproducing-week-10.md)
- [Final branch-tip CI run](https://github.com/wamimi/noir-ckb-verifier/actions/runs/31522501277)
- [Week 10 CKBuilder report](https://github.com/wamimi/CKBuilder/blob/main/ckbuilder-journey/reports/week-10.md)
- [The proof is valid. The transition might not be.](https://talk.nervos.org/t/the-proof-is-valid-the-transition-might-not-be/10550)
- [groth16-ckb](https://github.com/CECILIA-MULANDI/groth16-ckb)
- [Noir-Groth16](https://github.com/jamesbachini/Noir-Groth16)
