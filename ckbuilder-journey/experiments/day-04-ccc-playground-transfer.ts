import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

console.log("Welcome to CCC Playground!");

const receiver =
  signer.client.addressPrefix === "ckb"
    ? await signer.getRecommendedAddress()
    : "ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq9cfacde2pa83vzkmdh0appnzmf473dnwclz7rv7";

console.log(receiver);

const lock = await ccc.Address.fromString(receiver, signer.client).getLock();

const tx = ccc.Transaction.from({
  outputs: [
    {
      capacity: ccc.fixedPointFrom(100),
      lock,
    },
  ],
});

await render(tx);

await tx.completeInputsByCapacity(signer);
await render(tx);

await tx.completeFeeBy(signer, 1000);
await render(tx);
