# Week 2 — Signing and Witness Anatomy

**Focus:** Understanding what gets signed, where the signature goes, and how witnesses satisfy Lock Scripts.

---

## Question I am investigating

The next question after sending and querying a transfer is:

```txt
When I click transfer, what exactly is being signed, where does the signature go, and how does the Lock Script verify it?
```

This builds directly on the transfer experiment because the committed transaction included witness data.

## What I already observed

In the 67 CKB transfer, the transaction had no witnesses at first.

After fee completion, CCC added one witness placeholder:

```txt
0x55000000100000005500000055000000410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
```

After broadcast and querying the committed transaction with `get_transaction`, the witness contained signature-related evidence:

```txt
0x55000000100000005500000055000000410000000b8fc7b3a37a635ac6018ee201e819b37a8f91ac22b3170fe06c891c700091cd243fdb4bb3c3fc6f90b87671981c3cf4fbef86cfca8121243e81963ce77232b101
```

That suggests an important transition:

```txt
witness placeholder -> signed witness evidence
```

## What CKB signs

My current understanding is that CKB signing is not simply "attach a signature to a payment."

For the default secp256k1-style lock, signing relates to:

- the transaction hash
- the first witness in the input group
- additional witnesses in the same group
- a placeholder/dummy lock field used before the final signature is inserted

I need to study this more carefully, but the important direction is:

```txt
The signature is witness evidence that lets the Lock Script verify authorization.
```

## Input groups

Inputs protected by the same Lock Script can be grouped.

Questions I want to answer:

- Why are inputs grouped by Lock Script?
- Why can one signature unlock a whole group?
- Why does the first witness of the group matter?
- What happens if a transaction has multiple input groups?

## Witness before signing

In my transfer logs, the witness before final signing looked placeholder-like.

That matters because the signing process needs a stable structure to sign before the actual signature is inserted.

Question:

```txt
Why does signing need a dummy lock field first?
```

## Witness after signing

In the committed transaction, the witness had real signature-related bytes.

This made the Lock Script model more concrete:

```txt
Lock Script = verification program
Witness = evidence supplied to the verification program
```

## Why the transaction hash alone is not enough

The transaction hash commits to the raw transaction structure.

But signing also needs to account for witness data in the correct way, because witness data can affect script verification.

Question:

```txt
What would go wrong if witness data was not committed correctly during signing?
```

## Relation to sighash_all

In Week 1, I learned that `sighash_all` matters because the signature should commit to the full transaction context.

This prevents a valid signature from being reused in a different transaction with malicious outputs.

In Week 2, this now feels more concrete because I saw the transaction hash change when:

- output capacity changed
- inputs were added
- change output and cell deps were added

## Relation to ZK witnesses

This is the distinction I want to keep repeating until it is automatic:

```txt
CKB witness = public transaction evidence read by scripts
ZK witness = private input used off-chain to generate a proof
```

For a normal transfer:

```txt
CKB witness = signature-related evidence
```

For a future ZK-style application:

```txt
CKB witness = proof bytes / public verification evidence
private ZK witness = stays off-chain
```

## Current mental model

```txt
A signature is not just attached to a transaction.
It is witness evidence that the Lock Script reads to decide whether an input Cell can be consumed.
```

The CKB transaction is becoming clearer as a proof package:

```txt
inputs = old Cells being unlocked
outputs = new Cells being created
cell_deps = where verification code comes from
witnesses = evidence supplied to verification code
scripts = rules that accept or reject the transition
```

## Next experiment

Run another transfer with a different amount, such as 73 CKB, and add witness-specific logging:

```ts
function logWitnesses(label: string, tx: ccc.Transaction) {
  logSection(label);

  console.log("Witness count:", tx.witnesses.length);

  tx.witnesses.forEach((witness, index) => {
    console.log(`Witness ${index}:`, witness);
    console.log(`Witness ${index} length:`, witness.length);
  });
}
```

Then compare:

- witnesses after initial construction
- witnesses after `completeInputsByCapacity`
- witnesses after `completeFeeBy`
- witnesses after `sendTransaction`
- witnesses returned by `get_transaction`
