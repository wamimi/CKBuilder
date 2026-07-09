import { ccc } from "@ckb-ccc/core";

export type MoleculeCapsuleNoteLike = {
  magic?: string;
  version: number;
  capsuleId: string;
  body: string;
};

export type MoleculeCapsuleNote = {
  magic: string;
  version: number;
  capsuleId: string;
  body: string;
};

const CAPSULE_MAGIC_TEXT = "CAPSULE_V1";
const CAPSULE_MAGIC_HEX = "0x43415053554c455f5631";
const MAX_BODY_BYTES = 512;

function assertHexByteLength(hex: string, expected: number, label: string) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;

  if (clean.length !== expected * 2) {
    throw new Error(`${label} must be exactly ${expected} bytes`);
  }
}

function bodyToHex(body: string): string {
  return ccc.bytesTo(ccc.bytesFrom(body, "utf8"), "hex");
}

function bodyFromHex(hex: string): string {
  return ccc.bytesTo(ccc.bytesFrom(hex), "utf8");
}

function normalizeMagic(magic?: string): string {
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

const MagicCodec = ccc.mol.Codec.from<string, string>({
  byteLength: 10,
  encode: (magic) => ccc.bytesFrom(normalizeMagic(magic)),
  decode: (buffer) => ccc.bytesTo(buffer, "utf8"),
});

export const CapsuleNoteCodec = ccc.mol.table({
  magic: MagicCodec,
  version: ccc.mol.Uint32LE,
  capsuleId: ccc.mol.Byte32,
  body: ccc.mol.Bytes,
});

export function encodeCapsuleMolecule(note: MoleculeCapsuleNoteLike): string {
  assertHexByteLength(note.capsuleId, 32, "Capsule ID");

  const bodyBytes = ccc.bytesFrom(note.body, "utf8");

  if (bodyBytes.length === 0) {
    throw new Error("Capsule body cannot be empty");
  }

  if (bodyBytes.length > MAX_BODY_BYTES) {
    throw new Error(`Capsule body must be <= ${MAX_BODY_BYTES} bytes`);
  }

  return ccc.hexFrom(CapsuleNoteCodec.encode({
    magic: note.magic ?? CAPSULE_MAGIC_TEXT,
    version: note.version,
    capsuleId: note.capsuleId,
    body: bodyToHex(note.body),
  }));
}

export function decodeCapsuleMolecule(hex: string): MoleculeCapsuleNote {
  const decoded = CapsuleNoteCodec.decode(hex);

  return {
    magic: decoded.magic,
    version: decoded.version,
    capsuleId: decoded.capsuleId,
    body: bodyFromHex(decoded.body),
  };
}

export function isCapsuleMolecule(hex: string): boolean {
  try {
    decodeCapsuleMolecule(hex);
    return true;
  } catch {
    return false;
  }
}
