# CKBuilder Weekly Report - Week 19

**Name:** Nelly Njeri

**Week Ending:** 8 November 2026

## 1. Weekly Focus

This week the private tally went from a finished ceremony to a live testnet
deployment that other people can use. I deployed it with the ceremony's
verification key, ran it from three separate accounts, built a way for anyone to
create their own tally on the existing deployment, and reduced that to two
commands. I then published it with a short recorded demo and started collecting
feedback.

## 2. Using the Ceremony Key

Until now the setup tools only produced a single-party development key. I added
a ceremony mode to `setup-private-tally.py`. With `--ceremony`, it takes the
ceremony's final key instead of making one, and refuses to continue unless:

- the circuit, rebuilt on the local machine, lowers to exactly the frozen R1CS;
- the final key and verification key match the hashes in the ceremony transcript;
- the phase 1 file is the one the ceremony used;
- `snarkjs zkey verify` passes, and the key exports exactly the published
  verification key.

It then runs the same test proofs, rejection checks and adapter as before.

Before spending anything on testnet, the full local suite ran with the ceremony
key: the lifecycle, **49 of 49** CKB-VM attack cases and **4 of 4** mutation
tests all passed.

## 3. Testnet Deployment

I deployed the Type Script (113,464 bytes), the ceremony
verification key and the guard Lock code in one transaction, then created a tally
and updated it twice from the deployer account: once by a hidden amount and once
by 0 (a cover update).

| Stage | Transaction |
| --- | --- |
| Deployment | [0x39ef90b8…47b1f9](https://testnet.explorer.nervos.org/transaction/0x39ef90b8e6a882af3a658dc5c01cf17476e39907741541358d7155954547b1f9) |
| Create at 0 | [0x58d64623…6eca67](https://testnet.explorer.nervos.org/transaction/0x58d646231e2dfc66f3cf2d07199ad6863e733489342b811c5473e223be6eca67) |
| Hidden update | [0xa93b9ed5…1c4a73](https://testnet.explorer.nervos.org/transaction/0xa93b9ed57c45ca3a031b92b1e0bf68851796c2eb3aabdcab61a14383ca1c4a73) |
| Cover update (0) | [0xbc062ecc…66046c](https://testnet.explorer.nervos.org/transaction/0xbc062ecc84515e573a5c723f36b081733b8d95c71fb15ef7e414ee2ad766046c) |

On the explorer the two updates have the same size (1,032 bytes), the same fee
and about 117 million cycles each, which is the Groth16 verification running in
CKB-VM. Nothing shows which one added a value and which added nothing.

The deployment needed about 121,300 CKB in one transaction, while the deployer
account also held the live owned-counter deployment. I changed the client to
accept several funding Cells and to refuse any Cell that holds data or a Type, so
the counter's code and key Cells could not be spent by mistake.

## 4. Letting Others Join

A participant should not have to deploy anything. `join-private-tally.py` checks
the live deployment against the public record and, most importantly, checks that
**the verification key on chain is byte for byte the one the participant's own
setup derived from the ceremony key**, so nobody has to take my word for which
key is deployed.

A second account then created its own tally on the deployment, with its own
secret key, and added a hidden amount.

## 5. Two Commands

The first version of the participant guide was too much work: about 35 commands
spread across two guides. I replaced it with `try-private-tally.py`:

- `install` lists everything it will set up (the Rust version, the pinned backend,
  libraries, `ckb-cli`, Nargo and the phase 1 file, each checked against a hash)
  and asks once.
- `run` builds the ceremony setup, checks the deployment, creates a testnet-only
  account, finds the faucet payment by itself, creates the tally and asks for
  amounts to add. Before each transaction it shows it and asks; the password goes
  only to `ckb-cli`. Each transaction is re-checked after signing, recorded only
  once committed, and the private folder is backed up automatically.

I ran it myself from a fresh clone with a new account funded from the faucet. It
went through end to end, and the run surfaced two small problems that I fixed:
a mistyped password during account creation ended the whole run, and `install`
repeated steps that were already done.

The guide (`docs/try-the-private-tally.md`) now says who it's for and how long it
takes (about 20–30 minutes the first time, mostly compiling), and is built around
those two commands. The command-by-command version is kept separately.

## 6. Publishing and Feedback

I published a Nervos Talk post explaining what the private tally is, how each
proof is bound to one exact transition, why the ceremony was needed, what it does
not hide, and how to try it. It includes a three-minute captioned recording of
the full run from a fresh clone.

Early feedback:

- A forum reply pointed out that since the tally has no signature lock and the
  proof does not cover the fee inputs, a third party could relay a transaction
  without being able to change it. That would remove the fee payer as a privacy
  leak. They also suggested independent full-node operators as contributors for
  future ceremonies, and mentioned on-chain voting on CKB as a use case.
- An introduction to a Noir developer who runs a group of ZK learners is in
  progress, as a first outside tester.

## 7. Privacy: What Is Hidden and What Is Not

I wrote down plainly what the tally hides. The value and every amount added stay
private. Still visible: that a tally exists, when and how often it was updated,
which account paid the fee, and that one tally's updates belong together.

The fee payer is the most important of these, because it ties a tally to an
account. A relayer is the practical fix and fits the current binding. Unlinking
updates from each other would need a note-and-nullifier design, which on CKB runs
into the problem of many users updating the same shared Cells. I see that as a
longer-term research direction, not a feature for now.

## 8. Next Steps

1. Add a test case showing that a third-party fee payer is accepted while any
   change to the tally output is rejected, before claiming relayer support.
2. Collect tester feedback and fix what people hit.
3. Draft the grant proposal
## 9. Remaining Limits

- The join path checks the deployed Type Script bytes against the public record;
  it does not rebuild them from source.
- The ceremony is a public developer-preview ceremony, not an audited production
  setup.
- The circuits are still pinned to Nargo 1.0.0-beta.18.
- Groth16 over BN254 is not post-quantum.

## References

- [Project repository](https://github.com/wamimi/noir-ckb-verifier)
- [Week 18 report](https://github.com/wamimi/CKBuilder/blob/main/ckbuilder-journey/reports/week-18.md)
- [Try the private tally](https://github.com/wamimi/noir-ckb-verifier/blob/main/docs/try-the-private-tally.md)
- [Testnet evidence](https://github.com/wamimi/noir-ckb-verifier/blob/main/evidence/private-tally-testnet.md)
- [Ceremony transcript](https://github.com/wamimi/noir-ckb-verifier/tree/main/ceremony/private-tally-v2)
- [Nervos Talk post](https://talk.nervos.org/t/noir-ckb-the-private-tally-is-live-on-ckb-testnet-try-it-yourself/11132)
- [Demo video](https://www.youtube.com/watch?v=_JLl3eC-148)
