# ZK Attestation Cell Sketch on CKB

**Focus:** Map a future ZK/attestation idea onto CKB primitives.

---

## 1. What lives in cell.data

`cell.data` should not hold private user data.

It should hold public commitments or references to proof-related state, such as:

- `attestation_id`
- `commitment`
- `nullifier`
- `metadata_hash`
- `issuer_id`
- `state_root`
- `expiry_epoch`

My current rule:

```txt
cell.data = public state or commitments
not raw private identity data
```

## 2. What the Lock Script protects

The Lock Script controls who can consume or update the Cell.

Depending on the design, this could be:

- the user
- the issuer
- the verifier
- a multisig
- an admin/upgrader

For a user-owned attestation, the Lock Script might protect the user's ability to consume or reveal/update the attestation Cell.

For issuer-managed attestations, the Lock Script might require issuer authority.

## 3. What the Type Script validates

The Type Script should enforce valid state transitions.

Possible checks:

- no duplicate nullifiers
- correct issuer
- valid commitment format
- valid proof verification result
- correct transition from old state root to new state root
- expiry rules
- allowed status transitions, such as active -> revoked

My current model:

```txt
Lock Script = who may act
Type Script = whether the state transition is valid
```

## 4. What goes in witness data

Witness data should contain public verification material required by scripts, such as:

- proof bytes
- public inputs
- signatures
- opening data needed by the script
- Merkle proof paths

It should not contain the raw private ZK witness.

The CKB witness is public transaction evidence. A ZK witness is private proof-generation input. Those are not the same thing.

## 5. What stays off-chain

Private data must stay off-chain:

- private identity data
- secret attributes
- raw witness values
- private documents
- anything that should remain hidden from public chain observers

The chain should only see:

- commitments
- nullifiers
- public inputs
- proofs
- hashes or references

## Possible Cell model

```txt
cell.data:
  attestation_id
  commitment
  nullifier
  metadata_hash
  issuer_id
  state_root
  expiry_epoch

witness:
  proof bytes
  public inputs
  signature / authorization evidence

type script:
  verifies proof result or transition validity
  checks nullifier rules
  checks issuer rules
  checks state root transition

off-chain:
  private identity data
  raw witness values
  private documents
```

## ZK reading connection

This week I also continued reading Justin Thaler's *Proofs, Arguments, and Zero-Knowledge*. The chapters most relevant to my CKB attestation design direction are:

- Chapter 3 — Definitions and technical preliminaries: helps me reason about what a verifier accepts or rejects.
- Chapter 4 — Sum-check and interactive proofs: useful for understanding proof systems as structured prover/verifier conversations.
- Chapter 5 — Fiat-Shamir: relevant because practical blockchain proofs usually need public verifiability and non-interactivity.
- Chapter 6 — Front Ends: important because a real program or statement must eventually be represented in a verifier-friendly form.
- Chapter 10 — IOPs and polynomial IOPs: relevant for understanding how modern proof systems structure queries and commitments.
- Chapter 11 — Zero-Knowledge: directly relevant to what information should be hidden from the verifier.
- Chapter 12 — Sigma protocols and commitments: very relevant to the hash-lock/preimage pattern, but with privacy-preserving proof of knowledge instead of revealing the secret.
- Chapter 13 — Masking polynomials: relevant to how protocols hide witness information.
- Chapters 14-16 — Polynomial commitments: important for understanding commitments, openings, verifier costs, and proof-system tradeoffs.
- Chapter 18 — SNARK composition and recursion: longer-term relevant if CKB becomes a settlement or verification layer for proofs produced elsewhere.
- Chapter 19 — Bird's-eye view of practical arguments: useful for comparing which proof systems might actually make sense in a CKB application.

## Current thesis

CKB is interesting for attestation design because it lets an application separate:

```txt
public state commitments
ownership/spending rules
state transition validation
public proof evidence
private off-chain witness data
```

That separation is exactly where ZK design questions begin.
