# Capsule Molecule Sandbox

This folder is the Week 6 bridge from Capsule Notes' hand-rolled byte layout to Molecule-backed Cell state.

## Why this exists

Capsule Notes currently stores Capsule state in `cell.data` using a custom binary layout:

```txt
[0..10]   magic: CAPSULE_V1
[10..14]  version: u32 little-endian
[14..46]  capsule_id: 32 bytes
[46..]    body bytes
```

That was useful for learning because every byte was visible. The next step is to make the state format schema-backed so the frontend and the Rust Type Script agree on the same structure.

## CapsuleNote schema

The first Molecule schema is:

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

The TypeScript demo uses CCC's Molecule module:

```ts
ccc.mol.table({
  magic: MagicCodec,
  version: ccc.mol.Uint32LE,
  capsuleId: ccc.mol.Byte32,
  body: ccc.mol.Bytes,
})
```

## Run the demo

From the repo root:

```bash
node ckbuilder-journey/experiments/week-06/capsule-molecule/capsule-codec-demo.cjs
```

The script prints:

- the CapsuleNote schema shape
- the original Capsule object
- the Molecule-encoded `outputData`
- the decoded Capsule object
- a round-trip result

## Important distinction

Molecule gives Capsule data a schema and deterministic byte encoding.

The Type Script still enforces protocol meaning:

```txt
magic must be CAPSULE_V1
version must be valid
capsule_id must remain stable across updates
body must be non-empty
malformed data must be rejected
```

In other words:

```txt
Molecule = serialization/schema
Type Script = validation/enforcement
```

## Next step

After the codec round-trip works, the migration path is:

```txt
1. Use the CCC Molecule codec in Capsule Notes frontend.
2. Generate or write Rust-side Molecule readers for the Type Script.
3. Update capsule-transition-guard to parse CapsuleNote instead of manual byte slices.
4. Rebuild and redeploy the Type Script.
5. Mint a Molecule-backed Capsule Cell.
6. Confirm invalid Molecule data is rejected.
```

