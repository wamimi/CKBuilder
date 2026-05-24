# Day 4 CCC Playground Observations

## Goal

Use CCC Playground to inspect how a simple CKB transfer transaction is built before broadcasting.

## Network / Wallet Context

- Wallet: JoyID testnet wallet
- Public network explored: CKB Testnet
- Local network explored separately: OffCKB Devnet
- Broadcast: No

## Custom Receiver

```txt
ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq9cfacde2pa83vzkmdh0appnzmf473dnwclz7rv7
```

## Observed Transaction Stages

### Stage 1: Skeleton

```txt
Transaction: 0x7a23acde50ee4315a9dbd046d59676d6d86d0f53f7c451221cb47557039837d8
Inputs: 0 CKB
Outputs: 100 + ? CKB
```

The transaction had a receiver output but no selected funding input yet.

### Stage 2: Inputs Completed

```txt
Transaction: 0x1f05f245f18257a6fb27dc7d573944c3aceab4d94bf28f733418ae49c9728a25
Inputs: 5000 CKB
Input Cell: 0xd02...a56:0
Outputs: 100 + 4900 CKB
```

CCC selected a live Cell controlled by the signer.

### Stage 3: Fee Completed

```txt
Transaction: 0x27b2e6da47b7b9f4924618327f26bfce71da4b72ae5ef74eada09f8e729bc5fe
Inputs: 5000 CKB
Outputs: 4999.99998449 CKB
Fee: 0.00001551 CKB
```

Final accounting:

```txt
Receiver output: 100 CKB
Change output: 4899.99998449 CKB
Fee: 0.00001551 CKB
```

## Main Insight

CCC made the Cell model visible:

```txt
live Cells -> selected as inputs -> new Cells created as outputs -> fee from capacity difference
```

The transaction hash changed at each stage because the transaction structure changed.

## Broadcast Status

The transaction was not broadcast because the code did not call:

```ts
await signer.sendTransaction(tx);
```
