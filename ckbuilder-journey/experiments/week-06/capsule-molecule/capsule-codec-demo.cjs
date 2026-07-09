const { ccc } = require("../../week-04/capsule-notes/node_modules/@ckb-ccc/core");

const CAPSULE_MAGIC_TEXT = "CAPSULE_V1";
const CAPSULE_MAGIC_HEX = "0x43415053554c455f5631";
const SAMPLE_CAPSULE_ID =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

function assertHexByteLength(hex, expected, label) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;

  if (clean.length !== expected * 2) {
    throw new Error(`${label} must be exactly ${expected} bytes`);
  }
}

function normalizeMagic(magic) {
  if (magic == null || magic === CAPSULE_MAGIC_TEXT) {
    return CAPSULE_MAGIC_HEX;
  }

  if (magic.startsWith("0x")) {
    assertHexByteLength(magic, 10, "Capsule magic");
    return magic;
  }

  const magicBytes = ccc.bytesFrom(magic, "utf8");

  if (magicBytes.length !== 10) {
    throw new Error("Capsule magic must be exactly 10 bytes");
  }

  return ccc.hexFrom(magicBytes);
}

function bodyToHex(body) {
  return ccc.bytesTo(ccc.bytesFrom(body, "utf8"), "hex");
}

function bodyFromHex(hex) {
  return ccc.bytesTo(ccc.bytesFrom(hex), "utf8");
}

const MagicCodec = ccc.mol.Codec.from({
  byteLength: 10,
  encode: (magic) => ccc.bytesFrom(normalizeMagic(magic)),
  decode: (buffer) => ccc.bytesTo(buffer, "utf8"),
});

const CapsuleNoteCodec = ccc.mol.table({
  magic: MagicCodec,
  version: ccc.mol.Uint32LE,
  capsuleId: ccc.mol.Byte32,
  body: ccc.mol.Bytes,
});

function encodeCapsuleMolecule(note) {
  assertHexByteLength(note.capsuleId, 32, "Capsule ID");

  return ccc.hexFrom(CapsuleNoteCodec.encode({
    magic: note.magic ?? CAPSULE_MAGIC_TEXT,
    version: note.version,
    capsuleId: note.capsuleId,
    body: bodyToHex(note.body),
  }));
}

function decodeCapsuleMolecule(hex) {
  const decoded = CapsuleNoteCodec.decode(hex);

  return {
    magic: decoded.magic,
    version: decoded.version,
    capsuleId: decoded.capsuleId,
    body: bodyFromHex(decoded.body),
  };
}

function main() {
  const capsule = {
    magic: CAPSULE_MAGIC_TEXT,
    version: 1,
    capsuleId: SAMPLE_CAPSULE_ID,
    body: "Capsule Notes v2: Molecule-backed Cell state.",
  };

  const encoded = encodeCapsuleMolecule(capsule);
  const decoded = decodeCapsuleMolecule(encoded);

  console.log("CapsuleNote schema:");
  console.log("  magic: Magic [byte; 10]");
  console.log("  version: Uint32LE [byte; 4]");
  console.log("  capsule_id: Byte32 [byte; 32]");
  console.log("  body: Bytes");
  console.log("");
  console.log("Original Capsule:");
  console.log(JSON.stringify(capsule, null, 2));
  console.log("");
  console.log("Molecule outputData:");
  console.log(encoded);
  console.log("");
  console.log("Decoded Capsule:");
  console.log(JSON.stringify(decoded, null, 2));
  console.log("");
  console.log(
    `Round trip: ${JSON.stringify(capsule) === JSON.stringify(decoded) ? "ok" : "failed"}`
  );
}

main();
