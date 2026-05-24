# Tooling Log — OffCKB, CCC, CCC Playground, and CKB-CLI

**Focus:** Moving from CKB theory into hands-on tooling.


I moved into the tooling layer.

My goal today was to understand the practical developer workflow around CKB:

```txt
local devnet -> SDK/tooling -> wallet connection -> transaction composition -> debugging
```

I focused mainly on:

- OffCKB
- CCC JavaScript/TypeScript SDK
- CCC Playground
- JoyID testnet wallet
- CKB-CLI and other dev tools at a high level

## Commands I ran

### OffCKB version

```sh
offckb --version
```

Output:

```txt
0.4.6
```

### OffCKB accounts

```sh
offckb accounts
```

This printed pre-funded devnet accounts. 

Example devnet account:

```txt
address: ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqvwg2cen8extgq8s5puft8vf40px3f599cytcyd8
lock_arg: 0x8e42b1999f265a0078503c4acec4d5e134534297
lockScript:
  codeHash: 0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8
  hashType: type
  args: 0x8e42b1999f265a0078503c4acec4d5e134534297
```

### OffCKB node

```sh
offckb node
```

Output observed:

```txt
Launching CKB devnet Node...
CKB devnet RPC Proxy server running on http://127.0.0.1:28114
```

This confirmed that my local CKB devnet was running.

### OffCKB system scripts

```sh
offckb system-scripts --export-style ccc
```

This printed the CKB devnet system scripts as CCC `KnownScripts`.

Some scripts included:

- `Secp256k1Blake160`
- `Secp256k1Multisig`
- `AnyoneCanPay`
- `OmniLock`
- `XUdt`
- `TypeId`

This connected my earlier theory on `code_hash`, `hash_type`, and `cell_deps` to actual local devnet script configuration.

For example, `Secp256k1Blake160` had:

```txt
codeHash: 0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8
hashType: type
depType: depGroup
```

This is the same kind of default lock script structure I saw in the docs.

### OffCKB config

```sh
offckb config list
```

This showed the OffCKB config paths and RPC URLs.

Important values:

```txt
devnet rpcUrl: http://127.0.0.1:8114
devnet rpcProxyPort: 28114

testnet rpcUrl: https://testnet.ckb.dev
testnet rpcProxyPort: 38114

mainnet rpcUrl: https://mainnet.ckb.dev
mainnet rpcProxyPort: 48114
```

This helped me understand that OffCKB has separate contexts/configuration for devnet, testnet, and mainnet.


## What I understood about OffCKB

OffCKB is the local CKB development environment.


It gives me:

- a local CKB devnet
- pre-funded development accounts
- local RPC configuration
- system scripts
- debugging paths
- devnet/testnet/mainnet config separation

The most important thing I learned is that OffCKB helps me avoid needing public testnet infrastructure for every experiment. For local development, I can use the pre-funded devnet accounts and run a local CKB node.

The RPC proxy server is also useful:

```txt
http://127.0.0.1:28114
```

This seems important for debugging transactions and tracking failed/full transactions.

## What I understood about CCC

CCC stands for Common Chain Connector.


CCC helps with:

- connecting wallets
- parsing addresses into Lock Scripts
- constructing transactions
- selecting input Cells
- completing fees
- signing/sending transactions
- rendering and debugging transaction structure in the playground

I focused on CCC because it is the modern recommended JavaScript/TypeScript path, while older tooling like Lumos appears in some older learning materials.

## CCC Playground experiment

I opened CCC Playground and connected it to my JoyID testnet wallet.

I also claimed testnet CKB in my JoyID wallet.

The default playground code imported CCC and playground helpers:

```ts
import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";
```

The code then created a transaction that sends 100 CKB to a receiver address.

I replaced the default hardcoded testnet receiver address with my own JoyID testnet address:

```txt
ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq9cfacde2pa83vzkmdh0appnzmf473dnwclz7rv7
```

The receiver section became:

```ts
const receiver = signer.client.addressPrefix === "ckb"
  ? await signer.getRecommendedAddress()
  : "ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq9cfacde2pa83vzkmdh0appnzmf473dnwclz7rv7";
```

This was useful because it moved me from simply observing the default code to modifying it and reasoning about what happened.

## CCC Playground output

The playground printed:

```txt
Welcome to CCC Playground!
```

Then it printed my receiver address:

```txt
ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq9cfacde2pa83vzkmdh0appnzmf473dnwclz7rv7
```

This confirmed the code was using my address.

### Stage 1: Transaction skeleton

The first render showed:

```txt
Transaction
0x7a23acde50ee4315a9dbd046d59676d6d86d0f53f7c451221cb47557039837d8

Inputs (0 CKB)
Outputs (100 + ? CKB)
100 CKB
```

At this stage, the transaction had an intended output but no funding inputs.

My interpretation:

```txt
The transaction knows what it wants to create,
but it has not yet selected which live Cells will fund it.
```

This corresponds to the code:

```ts
const tx = ccc.Transaction.from({
  outputs: [
    { capacity: ccc.fixedPointFrom(100), lock },
  ],
});

await render(tx);
```

### Stage 2: Inputs completed

After this line:

```ts
await tx.completeInputsByCapacity(signer);
```

The playground showed:

```txt
Transaction
0x1f05f245f18257a6fb27dc7d573944c3aceab4d94bf28f733418ae49c9728a25

Inputs (5000 CKB)
5000 CKB
0xd02...a56:0

Outputs (100 + 4900 CKB)
100 CKB
```

CCC selected a 5000 CKB live Cell controlled by my signer.

My interpretation:

```txt
CCC found a live Cell that can fund the transaction.
```

The input reference:

```txt
0xd02...a56:0
```

means the input Cell comes from a previous transaction output:

```txt
previous transaction hash: 0xd02...a56
output index: 0
```

This made the OutPoint concept from Day 3 feel practical.

### Stage 3: Fee completed

After this line:

```ts
await tx.completeFeeBy(signer, 1000);
```

The playground showed:

```txt
Transaction
0x27b2e6da47b7b9f4924618327f26bfce71da4b72ae5ef74eada09f8e729bc5fe

Inputs (5000 CKB)
Outputs (4999.99998449 + 0.00001551 CKB)
100 CKB
4899.99998449 CKB
```

The final accounting was:

```txt
Input total:     5000 CKB
Receiver output: 100 CKB
Change output:   4899.99998449 CKB
Fee:             0.00001551 CKB
```

The math:

```txt
100 + 4899.99998449 = 4999.99998449
5000 - 4999.99998449 = 0.00001551
```

So the difference became the transaction fee.

This made the Cell model practical:

```txt
A transaction does not subtract from an account balance.
It consumes one or more live Cells and creates new output Cells.
```

## Why the transaction hash changed

The transaction hash changed at each stage:

```txt
Initial skeleton: 0x7a23acde50ee4315a9dbd046d59676d6d86d0f53f7c451221cb47557039837d8
After inputs:     0x1f05f245f18257a6fb27dc7d573944c3aceab4d94bf28f733418ae49c9728a25
After fee:        0x27b2e6da47b7b9f4924618327f26bfce71da4b72ae5ef74eada09f8e729bc5fe
```

This happened because each step changed the transaction structure.

This is an important cryptographic observation:

```txt
If the transaction changes, the transaction hash changes.
```

That connects to signature security and my earlier questions about `sighash_all`.

A signer should sign the final transaction structure, not a half-built transaction that someone could later modify.

## Did I broadcast the transaction?

No.

The code rendered the transaction, completed inputs, and completed fees, but it did not call:

```ts
await signer.sendTransaction(tx);
```

So I composed and inspected the transaction, but I did not broadcast it.


## Rust SDK note

I did not prioritize installing or using the Rust SDK today.

The Rust SDK is not something I need to install globally right now. I will use it later as a dependency inside a Rust project when I start writing Rust-based CKB code or interacting with CKB from Rust.


My current plan:

```txt
Short term: OffCKB + CCC + Playground
Medium term: Rust fundamentals + Rust SDK
Later: Rust scripting / CKB script development
```
