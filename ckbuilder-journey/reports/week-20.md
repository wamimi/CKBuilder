# CKBuilder Weekly Report - Week 20

**Name:** Nelly Njeri

**Week Ending:** 15 November 2026

## 1. Weekly Focus

This was the last week of my CKBuilder reports. I fixed the problems the first
outside testers hit in the private tally, then spent most of the week on research
for the next stage of noir-ckb: a tool where a developer brings their own Noir
circuit and gets a CKB Type Script that binds each proof to one exact state
transition of one Cell, with the tests that show it. Each research topic was then
reviewed by an outside model, and every finding was recorded and answered.

## 2. Tester Fixes

Cecilia and Patrick ran the private tally from the guide and reported two
problems: the scripts could pick up a Nargo other than the pinned version, and a
failed setup could not simply be run again. Both were fixed on 10 November, and
the guides were updated with what testers stumbled on. The full run was also
validated on Linux x86_64, not only on macOS.

The relayer question from last week's forum feedback was tested: the recorded
tally proof is still accepted when another account pays the fee or adds extra
inputs, and any change to the tally's successor Cell is rejected. So a third
party can pay for an update but cannot change what it does.

## 3. Research for the Next Stage

Six topics, each with a document and, where it applies, a spike that reproduces
the numbers:

| Topic | Main result |
| --- | --- |
| R0 Toolkit architecture | A declarative `[binding]` spec in `noir-ckb.toml` from which the Type Script and its attack tests are generated. A spec reader reproduces the verdicts of all 49 hand-written tally cases and all 48 counter cases. A linter refuses unsafe specs: 29 of 29 refused, each for the expected reason |
| R1 Noir 1.x | The tally compiled with Noir 1.0.0-rc.7 was read through a decoder bridge into the frozen ceremony R1CS, byte for byte, and a ceremony-key proof verified. This is one circuit, not Noir 1.x support |
| R2 Shared state | Notes and nullifiers for state that many users update. One nullifier insertion costs about 1.2M cycles |
| R3 Throughput | Checking many proofs in one script run: about 79M cycles plus 19.9M per proof, 172 proof checks under the 3.5B block limit in a VM fixture, against about 30 checked one by one |
| R4 Browser proving | Witness solving compiled to WebAssembly, proving with snarkjs. A tally proof takes 0.12 s on a laptop and 1.8 s on an entry-level Android phone |
| R5 Battleship | Design of an on-chain Battleship game as the reference single-writer application |

The two design rules that matter most for the generator came out of R0:

- **Every public input must be bound.** A spec that leaves a public input of the
  circuit without a source in the transaction is refused, because an unbound
  input is one an attacker can choose.
- **Unchanged unless declared.** The Lock, the capacity and every data field must
  be the same before and after an update unless the spec lists them as changed,
  and anything listed as changed must be proven or pinned. Forgetting something
  makes the script stricter, not weaker.

## 4. Outside Review

R0 to R3 were each reviewed once by an outside model on 11 and 13 November. The
reviews produced 12, 8, 13 and 7 findings, all accepted, each with a response in
the document it concerns. The most important: the first linter gave the Lock and
the capacity a weaker check than data fields, and five unsafe specs got past its
own negative tests. The rule now covers all three in one analysis, and every
finding became a new negative test case.

## 5. Decisions

- The claim for every generated script is "one exact state transition of one
  Cell". Whole-transaction binding is an opt-in.
- Noir stays the only rule language. There are no hand-written Rust hooks in a
  spec.
- The first version of the generator targets Cells updated by one party at a
  time, the pattern the counter and the tally already use. Shared state, such as
  a ballot box that many voters update, comes after it.

## 6. Ballot Vote Circuit

As groundwork for a later ballot box, I wrote the vote circuit on 15 November: a
voter proves membership in a voter tree, an election-scoped nullifier so the same
voter cannot vote twice, and a choice of 0 or 1. Its 26 Noir tests pass and 25
differential cases agree between Noir's own execution and the backend's R1CS. It
was run with a throwaway key only and has not been reviewed. The tree depth was
then set to 19 (524,288 voters), the largest that fits a power-14 setup.

## 7. Since the Week Closed

- The single-product verification change I proposed to Cecilia Mulandi's
  `groth16-ckb` was opened as a PR on 17 November and merged on 18 November. It
  verifies a Groth16 proof with one final exponentiation instead of two and saves
  about 21M cycles on every verification. Comparing builds with Cecilia also
  showed that the C compiler used for `ckb-std` changes the cost by about 3M
  cycles, so the build script should pin it as well.
- R4 was reviewed on 18 November (12 findings, all accepted), so all five
  research topics have now had one outside review.

## 8. Next Steps

1. Write a Spark proposal for the binding generator, scoped to what the grant can
   fund: generated Type Scripts and tests for the counter and the tally, and a
   path a developer can follow from their own circuit to a testnet transaction.
2. Open the PR that pins the C compiler in the `groth16-ckb` build script.
3. Keep the ballot box as a later, separate proposal.

## 9. Remaining Limits

- The research spikes are not the tool. The generator itself is not built.
- The linter has been reviewed once; the corrected version has not been
  reviewed again.
- The ballot vote circuit is unreviewed and has no ceremony.
- The circuits are still pinned to Nargo 1.0.0-beta.18.

## References

- [Project repository](https://github.com/wamimi/noir-ckb-verifier)
- [Research summary](https://github.com/wamimi/noir-ckb-verifier/blob/research/foundations/research/README.md)
- [Week 19 report](https://github.com/wamimi/CKBuilder/blob/main/ckbuilder-journey/reports/week-19.md)
- [groth16-ckb](https://github.com/CECILIA-MULANDI/groth16-ckb)
- [Nervos Talk post on the private tally](https://talk.nervos.org/t/noir-ckb-the-private-tally-is-live-on-ckb-testnet-try-it-yourself/11132)
