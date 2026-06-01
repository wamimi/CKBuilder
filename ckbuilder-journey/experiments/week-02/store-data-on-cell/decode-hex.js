const hex = process.argv[2];

if (!hex) {
  console.error("Usage: node decode-hex.js <hex_string>");
  process.exit(1);
}

const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

console.log(Buffer.from(cleanHex, "hex").toString("utf8"));
