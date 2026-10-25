# CKBuilder Weekly Report - Week 16

**Name:** Nelly Njeri

**Week Ending:** 18 October 2026

## 1. Weekly Focus

Last week ended with an accepted design for a private tally: a Cell that holds a
hidden number which only the holder of a secret key can update, with the proof,
not a signature, as the authority. This week I built it.

By the end of the week the private tally had a Noir circuit, a CKB Type Script, a
49-case adversarial matrix in CKB-VM, mutation tests, a client, and a full local
lifecycle that passed on macOS ARM64, Linux ARM64 and Linux x86_64. On 17 October
I froze the circuit and opened a public Groth16 phase 2 setup ceremony for it,
so that the key used on testnet does not depend on trusting me.

## 2. Why the Private Tally

The owned counter from Week 15 proves `new = old + 1` with every value public.
The Type Script could check that without a proof, so it shows that the plumbing
and the transaction binding work, not why zero knowledge is needed.

The private tally needs the proof. The Cell stores only a commitment to a 64-bit
value, refreshed with new randomness on every update. Whoever knows the secret
key can add a hidden amount, including zero, so even "nothing changed" looks
like a normal update. There is no signature Lock: the Type Script accepts a
transition only with a valid proof bound to that exact transition, so a proof
copied from the mempool is useless anywhere else.

## 3. The Circuit

The circuit (`circuits/private-tally-v2/`) proves:

> I know `(value_old, r_old, key, delta, r_new)` such that `c_old` commits to
> `value_old`, `c_new` commits to `value_old + delta` under the same key,
> `delta` fits in 32 bits, the result fits in 64 bits, and this proof is for the
> transaction whose context digest is `(ctx_lo, ctx_hi)`.

The commitment is two Poseidon2 calls, each with at most three inputs and a
distinct domain tag. The three-input limit is deliberate: the Poseidon version
that compiles with the pinned Noir release has a bug for longer inputs, so a
static test fails the build if a longer call ever appears.

| Check | Result |
| --- | --- |
| `nargo test` | 21 passed |
| Differential: Noir's own execution vs the backend's R1CS | 20/20 cases agreed, including 13 rejections |
| Public values in wires 1–4, in order, with private inputs declared first | Confirmed |
| Size | 3,338 constraints |

The differential check matters because of the Week 8 and Week 14 finding: a
backend can produce a valid proof for the wrong public statement. Here the
private inputs are declared first, which is exactly the layout that used to
break, and the public statement came out right.

## 4. The Type Script

The Type Script (`contracts/crates/private-tally/`) rebuilds the public statement
from the actual transaction and only then verifies the proof. The context digest
covers the network, the application, the consumed Cell, the old and new
commitments, the successor Lock and the capacity. It also enforces a Type ID,
canonical non-zero commitments, unchanged capacity, and a guard Lock that keeps
the Cell from being spent outside the Type's rules.

**49 of 49 adversarial cases** matched their expected outcome in CKB-VM. Among
them: missing, truncated or misplaced proofs; a creation proof used as an update
and the reverse; replay on another Cell or OutPoint; a proof made for another
network; altered or duplicated verification keys; and three cases where the
proof was generated for exactly the bad transaction, so only the Type Script's
own rules could reject it.

| Accepted transaction | Cycles |
| --- | --- |
| Creation | 113,067,366 |
| Update 0 → 5 | 115,668,811 |
| Zero-delta cover update | 115,855,014 |

Mutation tests removed one safety check at a time and confirmed each matters.
Without the verification, guard or capacity checks, an attack was accepted. The
fourth check (canonical commitments) turned out to be backed up by the verifier
library itself, which rejects such values; I kept it so malformed state fails
before the roughly 115-million-cycle verification.

## 5. Client, Local Lifecycle and Portability

A client (`scripts/private-tally-client.py`) prepares unsigned transactions and
keeps the secret key and randomness in owner-only local files with versioned
state, backups, and a leak scan that checks no secret ever reaches a published
file. A full local run deployed the contracts and then created the tally, added
7, and made a zero-delta cover update. The final state read 7, and every
commitment differed from the previous one.

The tally was added to the same launcher, container and CI as the counter:

| Platform | Result |
| --- | --- |
| macOS ARM64, native | Lifecycle validated |
| Ubuntu 24.04 ARM64, container with no network | Lifecycle, 49/49 matrix, 4/4 mutations |
| Ubuntu 24.04 x86_64 and ARM64, GitHub Actions | Both jobs passed |

## 6. The Setup Ceremony

Groth16 needs a circuit-specific key whose secret randomness, if anyone kept it,
would let them forge proofs. For the counter a single-party development key was
acceptable, because every update also needs the owner's signature. For the
private tally the proof is the only authority, so a single-party key would mean
trusting me completely. The tally will not go to testnet without a ceremony.

- **Phase 1:** reused from PSE's Perpetual Powers of Tau (`ppot_0080_12.ptau`).
  I verified the full chain (61 contributions plus a beacon) and published its
  hash. The Hermez files the snarkjs README still links to are no longer
  downloadable.
- **Phase 2:** a relay. The circuit was frozen at tag
  `private-tally-v2-circuit-freeze`, and the R1CS and the initial key were
  published. Contributors download the latest key, add their own randomness with
  one `snarkjs` command, and return it. A coordinator tool checks each key with
  `snarkjs zkey verify`, confirms the contributor's name and hash, and refuses
  anything that does not build on the previous key.
- **Beacon:** the hash of CKB mainnet block 20,870,000 (around 1 November),
  announced before the first contribution so nobody can choose it.

Contributors need only a laptop with Node.js 18 or newer: no wallet, funds or
CKB tools, about 15 minutes. The guide is `docs/setup-ceremony.md`.

## 7. Since the Week Ended

On 20 October I made the first contribution myself, under the same rules as
everyone else, and posted its hash on X so it cannot be changed later. A second
contributor, truthixify, completed theirs on 23 October; it was verified and
accepted on 25 October.

## 8. Next Steps and Questions

Plan for the coming weeks:

1. Collect contributions until about 30 October.
2. Apply the beacon once block 20,870,000 exists, publish the final key and
   transcript.
3. Deploy the private tally on testnet with the ceremony key, and add a guide so
   others can create and update their own hidden tally.

## 9. Deliverables and Remaining Limits

Delivered this week: the private tally circuit, Type Script, adversarial matrix,
mutation tests, client and local lifecycle, all running on three platforms; the
circuit freeze; the coordinator tool; and an open public ceremony with its
guide.

Remaining limits:

- The private tally runs locally only. It is not on testnet yet.
- The ceremony is open, not finished, and it is a public ceremony for a testnet
  developer preview, not an audited production ceremony.
- One tally Cell's updates are linkable to each other; update count, timing and
  fee payer are visible. Losing the key freezes the tally.

## References

- [Project repository](https://github.com/wamimi/noir-ckb-verifier)
- [Week 15 report](https://github.com/wamimi/CKBuilder/blob/main/ckbuilder-journey/reports/week-15.md)
- [Private tally v2 design](https://github.com/wamimi/noir-ckb-verifier/blob/c5ec10d/docs/private-tally-v2-spec.md)
- [Private tally evidence](https://github.com/wamimi/noir-ckb-verifier/blob/c5ec10d/evidence/private-tally-v2.md)
- [Private tally circuit](https://github.com/wamimi/noir-ckb-verifier/tree/c5ec10d/circuits/private-tally-v2)
- [Setup ceremony guide](https://github.com/wamimi/noir-ckb-verifier/blob/main/docs/setup-ceremony.md)
- [Ceremony transcript](https://github.com/wamimi/noir-ckb-verifier/tree/main/ceremony/private-tally-v2)
- [PSE Perpetual Powers of Tau](https://github.com/privacy-ethereum/perpetualpowersoftau)
- [CKB Groth16 verifier dependency](https://github.com/CECILIA-MULANDI/groth16-ckb/tree/d64c769ffe2d2edb5eb308dc59058efda77c2f83)
