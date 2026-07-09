# Week 6 Notes - Molecule Capsule Schema

## Question

How do I move Capsule Notes from hand-rolled bytes to schema-backed Cell data?

## Why Serialization Matters

CKB Cells store bytes, not JavaScript or Rust objects.

When Capsule Notes stores a note in `cell.data`, the app has to answer:

```txt
How does this structured Capsule object become bytes?
How does the Type Script read those bytes back?
How do both sides agree on the layout?
```

That is serialization.

## Current Capsule Layout

Capsule Notes currently uses a custom binary layout:

```txt
[0..10]   magic: CAPSULE_V1
[10..14]  version: u32 little-endian
[14..46]  capsule_id: 32 bytes
[46..]    body bytes
```

This was useful because it made every byte visible. But the format is informal: the schema exists in the frontend encoder, Rust parser, and my notes.

## Molecule Direction

Molecule lets me make the Capsule state format explicit:

```mol
array Magic [byte; 10];
array Uint32 [byte; 4];
array Byte32 [byte; 32];
vector Bytes <byte>;

table CapsuleNote {
    magic: Magic,
    version: Uint32,
    capsule_id: Byte32,
    body: Bytes,
}
```

The frontend can encode this with CCC Molecule:

```ts
ccc.mol.table({
  magic: MagicCodec,
  version: ccc.mol.Uint32LE,
  capsuleId: ccc.mol.Byte32,
  body: ccc.mol.Bytes,
})
```

## Important Distinction

Molecule gives the bytes structure.

The Type Script gives the structure protocol meaning.

Molecule can encode and decode:

```txt
magic
version
capsule_id
body
```

But the Type Script must still enforce:

```txt
magic == CAPSULE_V1
version is valid
body is non-empty
capsule_id stays the same across updates
version increments correctly across updates
```

My current model:

```txt
Molecule = deterministic schema-backed serialization
Type Script = validation and state-transition enforcement
```

## Week 6 Implementation Path

1. Create `CapsuleNote.mol`.
2. Implement a CCC Molecule codec in TypeScript.
3. Prove object -> Molecule bytes -> object round-trip.
4. Add a Molecule preview to Capsule Notes.
5. Later update `capsule-transition-guard` to parse Molecule data.
6. Rebuild and redeploy the Type Script.

The first milestone is complete when the TypeScript Molecule codec round-trips Capsule data and produces CKB-style `0x...` output data.

