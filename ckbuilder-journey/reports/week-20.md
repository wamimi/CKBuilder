# CKBuilder Weekly Report - Week 20

**Name:** Nelly Njeri

**Week Ending:** 15 November 2026

## 1. Weekly Focus

This was the last week of my CKBuilder reports. I fixed the problems the first
outside testers hit in the private tally, then spent most of the week on research
for the next stage of noir-ckb: a tool where a developer brings their own Noir
circuit and gets a CKB Type Script that binds each proof to one exact state
transition of one Cell, with the tests that show it.

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

Before building the generator, I researched the parts I was least sure of, so the
build itself is straightforward. The full write-up, with the numbers and how to
reproduce them, is in the
[research summary](https://github.com/wamimi/noir-ckb-verifier/blob/research/foundations/research/README.md).
What I found:

- **The generator works on paper.** A short `[binding]` spec is enough to
  describe both deployed applications. A prototype that reads the spec reproduces
  the results of all 49 hand-written tally attack cases and all 48 counter cases.
- **Unsafe specs can be caught before any code is generated.** A prototype checker
  refuses 29 out of 29 deliberately unsafe specs, each for the right reason. Two
  rules do most of the work: every public input of the circuit must have a source
  in the transaction, because an unbound input is one an attacker can choose; and
  nothing in the Cell may change unless the spec says so and constrains it, so
  forgetting something makes the script stricter, not weaker.
- **Verification can get much cheaper.** One proof can be verified with a single
  final exponentiation instead of two, saving about 21M cycles. Checking many
  proofs in one script run costs about 79M cycles plus 19.9M per proof, which fits
  about 170 proof checks in a block instead of about 30.
- **Proving in the browser is practical.** A tally proof takes 0.12 s on a laptop
  and 1.8 s on an entry-level Android phone.
- **Shared state is possible but is a later step.** Applications that many users
  update at once, such as a ballot box, need notes and nullifiers; one nullifier
  insertion costs about 1.2M cycles.

## 4. Decisions

- Every generated script claims one exact state transition of one Cell.
  Whole-transaction binding is an opt-in.
- Noir stays the only rule language. There are no hand-written Rust hooks in a
  spec.
- The first version of the generator targets Cells updated by one party at a
  time, the pattern the counter and the tally already use. Shared state comes
  after it.

## 5. Ballot Vote Circuit

As groundwork for a later ballot box, I wrote the vote circuit: a voter proves
membership in a voter tree, an election-scoped nullifier so the same voter cannot
vote twice, and a choice of 0 or 1. Its tests and differential checks passed with
a throwaway key. It has not been reviewed and has no ceremony. The tree depth is
set to 19 (524,288 voters), the largest that fits a power-14 setup.

## 6. Contribution to groth16-ckb

The single-verification saving above is now merged into Cecilia Mulandi's
`groth16-ckb`, the verifier noir-ckb uses on chain, so every project that uses it
gets about 21M fewer cycles per verification. Comparing our builds also showed
that the C compiler used for `ckb-std` changes the cost by about 3M cycles, so the
build script should pin it as well.

## 7. Next Steps

1. Write a Spark proposal for the binding generator, scoped to what the grant can
   fund: generated Type Scripts and tests for the counter and the tally, and a
   path a developer can follow from their own circuit to a testnet transaction.
2. Open the PR that pins the C compiler in the `groth16-ckb` build script.
3. Keep the ballot box as a later, separate proposal.

## 8. Remaining Limits

- The spec checker is a prototype. Its rules have been tested against unsafe
  specs, but the version built into the generator will need its own review.
- The ballot vote circuit is unreviewed and has no ceremony.
- The circuits are still pinned to Nargo 1.0.0-beta.18. Moving to the stable
  Noir release is planned as its own step.

## References

- [Project repository](https://github.com/wamimi/noir-ckb-verifier)
- [Research summary](https://github.com/wamimi/noir-ckb-verifier/blob/research/foundations/research/README.md)
- [Week 19 report](https://github.com/wamimi/CKBuilder/blob/main/ckbuilder-journey/reports/week-19.md)
- [groth16-ckb](https://github.com/CECILIA-MULANDI/groth16-ckb)
- [Nervos Talk post on the private tally](https://talk.nervos.org/t/noir-ckb-the-private-tally-is-live-on-ckb-testnet-try-it-yourself/11132)
