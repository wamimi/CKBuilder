# Week 3 Notes - Type ID and Upgradeability

**Focus:** Understand how CKB can reference scripts in an upgradable way without giving up uniqueness.

---

## Question I am investigating

The guiding question:

```txt
How does CKB make upgradable script references possible without giving up uniqueness?
```

This matters because I have been asking questions about:

- `code_hash`
- `hash_type`
- script identity
- code dependencies
- Type Script hashes
- upgrade paths

## Code bytes vs configured scripts

A code hash identifies exact executable bytes.

If the code changes, the code hash changes.

That is useful for immutability and reproducibility, but it creates a problem for upgradeable code:

```txt
data-hash reference -> exact code bytes
code changes -> hash changes -> old references break
```

A script hash is different. A script hash identifies a configured Script structure:

```txt
code_hash + hash_type + args
```

So code identity and configured script identity are related, but not the same thing.

## Why hash_type: type matters

When `hash_type` is based on code data, the script reference is tied directly to the code bytes.

When `hash_type` is `type`, the script can locate code through a Cell's Type Script hash instead of only through the data hash of the code bytes.

This creates a path for upgradeability:

```txt
reference the code Cell by Type Script identity
not only by exact code-data hash
```

The code Cell can be updated while the reference path remains stable, as long as the Type Script identity is preserved according to the intended design.

## Type ID as uniqueness

Type ID is important because it provides uniqueness for a Type Script identity.

My current understanding:

```txt
Type ID = unique identity for a Cell's Type Script
hash_type: type = reference by Type Script hash
upgradeability = code/data can change while reference identity remains stable
```

That means Type ID helps answer this question:

```txt
If code can be upgraded, how do users know they are still pointing at the intended code Cell identity?
```

## Protocol-level answer

CKB makes upgradable script references possible by allowing script references to resolve through a Cell's Type Script hash instead of only through exact code bytes.

A code hash identifies exact executable code bytes. If those bytes change, the hash changes.

A Type-ID-based reference identifies a unique code Cell through its Type Script identity. This allows a stable reference path while still preserving uniqueness around which code Cell is being referenced.

## Security question

Upgradeability is useful, but it creates a governance question:

```txt
Who controls the upgrade path?
```

If a script reference can point to updated code, users need to understand:

- who can update the code Cell
- what rules control updates
- whether the upgrade path is admin-controlled
- whether the upgrade path is constrained by a Type Script
- whether users expect immutability or controlled evolution

This is not a small implementation detail. It is part of the protocol security model.

## ZK / Thaler connection

Type ID is not a polynomial commitment.

But the design question feels related:

```txt
How do we preserve a stable identity or commitment while still allowing later verification of the intended object?
```

In CKB, Type ID helps preserve uniqueness and reference stability for script Cells.

In ZK systems, commitments preserve binding to hidden or structured data while enabling later verification.

Relevant Thaler connections:

- Chapter 14: polynomial commitments from discrete log
- Chapter 15: KZG polynomial commitments
- Chapter 16: polynomial commitment tradeoffs

The comparison is conceptual, not literal. The useful link is the engineering question: what exactly is being identified, committed to, or verified?

## Current mental model

```txt
code hash = exact code bytes
script hash = configured script identity
Type ID = unique Type Script identity
hash_type: type = reference through Type Script identity
upgradeability = stable reference path with changing code/data
```

The key lesson is that upgradeability is never free. It must be designed as part of the trust model.
