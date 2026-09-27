# CKBuilder Weekly Report - Week 13

**Name:** Nelly Njeri


**Week Ending:** 27 September 2026

## 1. Weekly Focus

This week I investigated feedback on a key decision in `noir-ckb`: using
Groth16 as the proof system for the developer preview. A reviewer pointed out
that requiring a trusted setup for each application circuit creates friction
for developers and recommended an optimized SP1 PLONK verifier for CKB-VM.

So, I went on to build the recommended verifier at a pinned revision, reproduce its benchmark, and test what happens
when the proof, public values, program identity, or verifier key changes.

The original upstream proof verified successfully in CKB-VM at **66,229,968
cycles**. I then built a separate test harness and ran **six cases: one expected
acceptance and five expected rejections. All six passed.**

The work establishes a verifier baseline for evaluating SP1. Generating a new
application proof and binding it to actual Capsule Cells are subsequent steps.

## 2. How This Connects to the Earlier Work

Weeks 7–12 established a supported Noir-to-Groth16 workflow, artifact conversion,
and a CKB-VM example where the proof must describe the actual typed Cell
transition. The preview also exposed a public/private wire-ordering problem in
the experimental Noir backend, which remains a reason to keep compatibility
claims narrow.

That work raised two separate questions:

- How practical is the proof-generation workflow for an application developer?
- How does the on-chain application ensure that a valid proof authorizes the
  intended state change?

SP1 could change the answer to the first question. The second remains central
regardless of the proof system. A verifier must check the intended program and
its public statement, and the CKB application must connect that statement to the
Cells in the transaction.

## 3. What I Learned About the Setup Concern

The current direct Noir-to-Groth16 path uses circuit-specific setup material.
SP1's PLONK path uses a universal setup that can be reused across circuits,
avoiding a new application-specific ceremony. It still relies on trusted setup
assumptions. A program verification-key hash is also needed to identify which
program was proven; that identifier is different from a setup ceremony.
[SP1 security model](https://docs.succinct.xyz/docs/sp1/security/security-model)

SP1 is also a different execution pipeline. The recommended CKB verifier accepts
SP1 proofs, public-value bytes, and a program key hash. It does not directly
consume our Noir ACIR or existing Groth16 artifacts. A Rust guest implementing a
Capsule relation would be a useful application experiment, but preserving Noir
as the frontend would require a separate bridge and its own evaluation.

## 4. Reproducing the Upstream Verifier

I used the implementation and benchmark linked in the
[SP1 CKB-VM announcement](https://talk.nervos.org/t/optimized-sp1-verifier-for-ckb-vm/10144).
The benchmark contains a public proof fixture and an expected program key hash.
Its public-value byte string is empty, which limits what successful verification
can establish about an application.

| Component | Version or revision |
| --- | --- |
| Optimized SP1 fork | `0cc2b42f287bbfce66973e19defb8b39fa361732` |
| SP1 version | `6.0.2` |
| Benchmark repository | `026d5cb7199d71fd5bee3f165b446dd2243079d0` |
| BN254 implementation | `ckb-alt-bn128 0.1.6` |
| Rust / Cargo | `1.94.0` |
| Clang / LLVM | `19.1.7` |
| CKB debugger | `1.1.1`, script version `2`, fast mode |
| Host | macOS 15.8, Apple Silicon, 24 GiB RAM |

The preflight identified missing prerequisites, so I installed Rust 1.94.0 with
the RISC-V target and confirmed LLVM 19.1.7. I then built with `--locked`, kept
the upstream lockfile unchanged, and matched the benchmark's Rust flags.

| Original benchmark result | Observed value |
| --- | --- |
| Binary size | 248,624 bytes |
| Proof fixture size | 964 bytes |
| Program result | `0` |
| Exact total cycles | 66,229,968 |
| Debugger display | `63.2M` |

The debugger's rounded display scales by 1,048,576. I retained the exact cycle
count to avoid interpreting `63.2M` as 63.2 million decimal cycles. The published
benchmark used debugger 1.1.0, so the local environment difference is recorded.

The original benchmark executable has SHA-256:

```text
eb681935694ff4d8582a15d2a575e364b4087c9b8a45c83e9ab0d6d6772d4e45
```

## 5. Testing Rejection Behavior

I added a small harness in a separate experimental checkout, preserving the
unmodified benchmark. It reuses the same proof and dependency lockfile and
changes one element per test. The harness requires the expected verifier error;
a panic, cycle-limit failure, or unexpected error does not count as a pass.

| Case | Observed verifier result | Total cycles |
| --- | --- | ---: |
| Original proof and statement | Accepted | 66,281,578 |
| Changed program hash | `PairingCheckFailed` | 131,326,663 |
| Changed public values | `PairingCheckFailed` | 130,954,090 |
| Altered proof body | `PairingCheckFailed` | 128,808,382 |
| Proof truncated to 99 bytes | `GeneralError(InvalidData)` | 130,253 |
| Changed wrapper verifier key | `PlonkVkeyHashMismatch` | 1,934,174 |

The harness reported `week13_matrix_cases_passed=6` and exited successfully.
For negative cases, a successful harness exit means the expected rejection was
observed. It does not mean the altered proof was accepted.

The experimental executable was **247,576 bytes**. Its measurements are kept
separate from the original benchmark because the entry code and test logic
differ.

## 6. A Useful Finding: Rejection Can Cost More Than Acceptance

Three rejection cases consumed roughly twice the cycles of the positive case.
Inspecting the pinned verifier explains the pattern: it first attempts
verification with a SHA-256 digest of the public values. If that fails, it tries
again using Blake3. The negative-case logs show the corresponding repeated key
and proof loading.
[Pinned verifier implementation](https://github.com/XuJiandong/sp1/blob/0cc2b42f287bbfce66973e19defb8b39fa361732/crates/verifier/src/plonk/mod.rs)

This matters when budgeting CKB execution costs. A successful-proof benchmark
does not capture every rejection path. These six tests establish observations
for specific inputs, rather than a worst-case bound or a security audit.

The wrong-key case checks the wrapper-key fingerprint, and the truncated-proof
case checks the initial minimum length. More extensive parser and malformed
input coverage would be separate work.

## 7. What This Means for the Project Direction

SP1 is now a candidate supported by local verification evidence. The next useful
milestone is a small program that commits nonempty, versioned public values,
such as application identity, old state, new state, action, and replay context.

The CKB application would pin the expected program key, verify the proof, and
compare those public values with the actual Cell transition. The acceptance
requirement remains:

```text
valid proof + intended Cell transition -> accept
valid proof + different Cell transition -> reject
```

The current SP1 experiment has not tested those Cell transitions. The altered
public-values test changes an empty byte string to `[1]`; it demonstrates that
verification checks those bytes, rather than proving an application relation
with nonempty public values.

Fresh proving also needs planning. My host has 24 GiB RAM, while current SP1
documentation lists 64 GB or more for local PLONK proving. I have not attempted
that workload or used a paid prover. A compatible public guest/proof fixture or
a suitable proving environment would let the next experiment proceed.
[SP1 hardware requirements](https://docs.succinct.xyz/docs/sp1/getting-started/hardware-requirements)


## 8. Deliverables and Remaining Work

This week produced a source-backed comparison of setup and compatibility
requirements, a pinned benchmark reproduction, a six-case CKB-VM harness, and
retained logs, hashes, binary sizes, and exact cycle counts. Four scripts cover
environment preparation, the original build, original verification, and the
experimental matrix.

The existing Noir developer preview remains the demonstrated application path.
There is no completed Noir-to-SP1 bridge, freshly generated SP1 application
proof, SP1 Capsule integration, or deployment to report. The next milestone will
evaluate a concrete application statement before deciding how much of the
toolchain should change.

## References

- [Project repository](https://github.com/wamimi/noir-ckb-verifier)
- [Week 12 report](https://github.com/wamimi/CKBuilder/blob/main/ckbuilder-journey/reports/week-12.md)
- [Pinned upstream benchmark](https://github.com/XuJiandong/ckb-rust-algorithm-benchmarks/tree/026d5cb7199d71fd5bee3f165b446dd2243079d0/contracts/sp1-test)
- Local research and execution plan: `docs/week-13-sp1-evaluation.md`
- Local retained evidence: `evidence/week-13.md`
- [Local test harness documentation] (https://github.com/wamimi/noir-ckb-verifier/tree/main/experiments/week13-sp1) 

