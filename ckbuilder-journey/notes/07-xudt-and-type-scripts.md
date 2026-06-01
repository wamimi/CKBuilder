# Week 2 Notes — xUDT and Type Scripts
**Focus:** Moving from raw Cell data to typed token state with xUDT.

---

## Question I am investigating

The core question for this experiment was:

```txt
How does CKB turn arbitrary Cell data into meaningful application state with validation rules?
```

The Store Data on Cell experiment showed that `cell.data` can hold arbitrary bytes. The xUDT experiment showed how a Type Script can give Cell data protocol meaning.

## What I ran

I worked through the `Create a Fungible Token` tutorial on local OffCKB devnet.

I issued an xUDT token and then transferred part of the token balance while inspecting token amounts, Lock Scripts, Type Scripts, and token change.

## Issued token

Token amount:

```txt
42
```

Issue transaction hash:

```txt
0x0f7441d2d1ca474ab4ac21b07727e6f93718d1b1c6f437c457972eeda9e287d3
```

xUDT args:

```txt
0x7de82d61a7eb2ec82b0dc653e558ba120efcbfbb44dac87c12972d05bf25065300000000
```

My current framing:

```txt
xUDT Type Script + xUDT args = token class identity
```

## Issued token Cell

The issued token Cell had:

```txt
Capacity: 146 CKB
```

Lock Script:

```json
{
  "codeHash": "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
  "hashType": "type",
  "args": "0x8e42b1999f265a0078503c4acec4d5e134534297"
}
```

Type Script:

```json
{
  "codeHash": "0x1a1e4fef34f5982906f745b048fe7b1089647e82346074e0f32c2ece26cf6b1e",
  "hashType": "type",
  "args": "0x7de82d61a7eb2ec82b0dc653e558ba120efcbfbb44dac87c12972d05bf25065300000000"
}
```

The token amount was stored in `outputsData` as little-endian bytes:

```txt
0x2a000000000000000000000000000000
```

## Lock Script vs Type Script in token Cells

This experiment made the roles clearer:

```txt
Lock Script = who controls the token Cell
Type Script = what token class/rules the Cell belongs to
Cell data / outputsData = how many tokens the Cell contains
```

The Lock Script controls ownership. The Type Script controls the token meaning and transition rules.

## ERC-20 comparison

The sharpest comparison for me was:

```txt
Ethereum ERC-20:
balances[address] = amount

CKB xUDT:
Cell.lock = who controls this token Cell
Cell.type = which token class this Cell belongs to
Cell.data = how many tokens this Cell contains
```

This helped me understand how fungibility works on CKB without account-based contract storage.

A token balance is represented by one or more live Cells that share the same xUDT Type Script, not by one global mapping inside a contract.

## Debugging note

During transfer, I initially encountered an `Invalid bytes` error.

The cause was a leading space before the xUDT args:

```txt
 0x7de82d61...
```

Removing the whitespace fixed the issue.

Lesson:

> When working close to serialized protocol data, even formatting mistakes can break byte parsing.

## Transfer accounting

In one transfer inspection, the token amount split correctly from:

```txt
42 tokens -> 12 tokens + 30 tokens
```

Later, I performed another transfer where the receiver Lock Script args were different from the sender's.

Sender Lock Script args:

```txt
0x8e42b1999f265a0078503c4acec4d5e134534297
```

Receiver Lock Script args:

```txt
0x9665e6bc1966ec2bfcca4f11782d2b906f38438f
```

This confirmed that ownership actually changed for the receiver output.

The most interesting accounting observation was:

```txt
Input UDT balance: 54
Output UDT balance: 5
Token change balance: 49
```

My mental model:

```txt
54 input tokens
-> 5 receiver tokens
-> 49 sender change tokens
```

This is similar to UTXO-style change, but applied to fungible token state.

## Main insight

The key insight is:

```txt
Cell data by itself is storage.
Cell data with a Type Script becomes protocol state.
```

In the Store Data on Cell experiment, I had data without enforced meaning. In the xUDT experiment, I had data whose meaning was constrained by a Type Script.

## ZK / privacy reflection

This raised a useful ZK and privacy question:

```txt
If ownership and token amounts are represented through Lock Scripts and Cell data,
which parts of state should remain public,
which parts should become commitments,
and what proof should be supplied during state transition?
```

A possible future model:

```txt
Cell.data = public commitment / nullifier / state root / proof-related state
Witness = proof material or public verification inputs
Type Script = verifies that the transition is valid
Off-chain witness = private data used to generate the proof
```

The xUDT tutorial made Type Scripts feel less abstract. A Type Script is already a way of enforcing transition rules over Cell data. For a ZK-oriented design, the next question becomes whether a Type Script can enforce a transition where the public Cell data is only a commitment to private state.
