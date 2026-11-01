# CKBuilder Weekly Report - Week 18

**Name:** Nelly Njeri

**Week Ending:** 1 November 2026

## 1. Weekly Focus

This week the private tally setup ceremony finished. The last two contributions
were verified and accepted, the announced beacon block was produced, and on
1 November I applied its hash and finalized the key. The private tally now has a
proving key and verification key that do not depend on trusting any single
person, including me, and it is ready to be deployed on testnet.

## 2. The Last Two Contributions

| # | Contributor | Accepted | Commit |
| --- | --- | --- | --- |
| 3 | alienate | 27 October | [dee824d](https://github.com/wamimi/noir-ckb-verifier/commit/dee824d) |
| 4 | CECILIA-MULANDI | 27 October | [bf09ccf](https://github.com/wamimi/noir-ckb-verifier/commit/bf09ccf) |

Contribution 4 came from Cecilia Mulandi, who maintains the `groth16-ckb`
verifier that noir-ckb uses on chain.

Contribution 3 was the first by someone new to the command line workflow, and it
was the most useful test of the guide so far:

- **Re-setting the file names after closing the terminal.** The guide asks
  contributors to close the terminal after contributing, so the secret is gone.
  It then said only "set `IN` and `OUT` again", without showing how. It now gives
  the exact lines to paste.
- **A folder trap.** Step 1 created the working folder and moved into it in one
  line joined with `&&`. If the folder already existed, the move was silently
  skipped, and the contributor kept working in the wrong place. This is how the
  contributor ended up with a folder nested inside the expected one. The two
  commands are now on separate lines and work either way.
- **The name check worked as intended.** The contributor typed their name in
  lowercase, while the issue said otherwise. The coordinator tool refused the key
  because the name inside it did not match, and it was accepted under the name
  actually recorded in the key.

## 3. Finalization

The beacon was the hash of CKB mainnet block 20,870,000, announced before the
first contribution. When I checked on 1 November the chain was already about
24,000 blocks past it, so the block was produced a few days earlier than the
"around 1 November" estimate made at the start. No contribution was accepted
after it: the last one was accepted on 27 October, and the tool refuses any
contribution once the chain tip reaches the beacon height.

Finalizing:

1. confirmed the block hash against a CKB mainnet RPC node,
2. applied it to the last key with `snarkjs zkey beacon` (2^10 iterations),
3. verified the final key against the frozen circuit and the phase 1 file, and
   checked that it lists every contribution plus the beacon,
4. exported the verification key, and
5. recorded everything in the transcript.

An independent re-check (`ceremony-private-tally.py check`) then passed: 4
contributions plus the beacon, verified in the final key.

| Item | Value |
| --- | --- |
| Beacon block hash | `0x0734b3f08b5e78144c73a58313647a94f053223d8b71ae17ed18cf3140dbb44d` |
| Final key `tally_final.zkey`, SHA-256 | `01f76014a6fbad1a0433781aa6518ec36fea27536e71354d88f134bc04a180fe` |
| `verification_key.json`, SHA-256 | `7749a5fbdb778598ac514441f374c89a1890ce0e1e00cf34e8465891f69b5055` |

The full verification output is published as `verify-final.log`, so every
contributor can find their own hash in it.

## 4. Response

The completion post was well received, and people asked publicly to see the
private tally live on testnet.

## 5. Noir 1.0

Noir 1.0, the first stable release, was published on 29 October. It brings a
stable language, a semantically versioned toolchain, a stable ACIR interface,
and a compiler that went through internal and external security review.

For noir-ckb this is important, but it does not change the current work:

- The private tally stays on Nargo 1.0.0-beta.18, the compiler it was frozen
  with. The ceremony key belongs to that exact R1CS, and a different compiler can
  produce different constraints from the same source. Any recompiled circuit
  needs a new ceremony.
- Moving noir-ckb to the stable 1.x line is now a clear next milestone:
  checking that the Noir-Groth16 backend fork reads 1.0's ACIR, re-running the
  differential and adversarial suites, and checking whether the newer Poseidon
  library (which would remove the three-input limit) compiles on 1.0.

## 6. Next Steps

1. Deploy the private tally on testnet with the ceremony verification key, and
   confirm that the on-chain key's data hash matches `verification_key.json`.
2. Run the lifecycle on testnet and publish a guide so others can create and
   update their own hidden tally.
3. Share it with the acceptance team and the people who asked to see it, and
   collect their feedback.
4. Write the draft grant proposal, including the testnet results and the Noir 1.x
   migration.

## 7. Remaining Limits

- The private tally is not on testnet yet.
- The ceremony is a public ceremony for a testnet developer preview, with four
  contributors. It is not an audited production ceremony.
- The circuits are pinned to a Noir beta compiler; Noir 1.x support is not yet
  tested.
- One tally Cell's updates are linkable to each other; update count, timing and
  fee payer are visible. Losing the key freezes the tally.
- Groth16 over BN254 is not post-quantum.

## References

- [Project repository](https://github.com/wamimi/noir-ckb-verifier)
- [Week 17 report](https://github.com/wamimi/CKBuilder/blob/main/ckbuilder-journey/reports/week-17.md)
- [Ceremony transcript and final keys](https://github.com/wamimi/noir-ckb-verifier/tree/main/ceremony/private-tally-v2)
- [Final verification log](https://github.com/wamimi/noir-ckb-verifier/blob/main/ceremony/private-tally-v2/verify-final.log)
- [Setup ceremony guide](https://github.com/wamimi/noir-ckb-verifier/blob/main/docs/setup-ceremony.md)
- [Private tally v2 design](https://github.com/wamimi/noir-ckb-verifier/blob/main/docs/private-tally-v2-spec.md)
- [Noir documentation](https://noir-lang.org/docs)
