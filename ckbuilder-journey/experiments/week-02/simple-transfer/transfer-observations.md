# Week 2 Simple Transfer Observations

## Experiment

Send a 67 CKB transfer on local OffCKB devnet, inspect CCC's transaction construction logs, then query the transaction state through JSON-RPC.

## Transaction Hash

```txt
0x61921431e12086f92f015c5bf75d94dda46b6b4b64264c8b582c199143623657
```

## Sender

```txt
ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqvwg2cen8extgq8s5puft8vf40px3f599cytcyd8
```

Sender lock args:

```txt
0x8e42b1999f265a0078503c4acec4d5e134534297
```

## Receiver

```txt
ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew
```

Receiver lock args:

```txt
0x758d311c8483e0602dfad7b69d9053e3f917457d
```

## Construction Stages

### Initial Construction

```txt
Transaction hash: 0x8c2affddfa808f2173756a19bd348e0e5ef895ada67855868892a36635017a55
Inputs count: 0
Outputs count: 1
Cell deps count: 0
Witnesses count: 0
```

### After Setting Output Capacity

```txt
Transaction hash: 0xd9df56fb9e462895180e1348d61a2181a25c7d8c25df676ce931d8101b2c7313
Output capacity: 6,700,000,000 shannons
```

### After Completing Inputs

```txt
Transaction hash: 0x3b6023b4437f837d122afb90c1676174a3de070744c8f746db6c49fc2bc09c0c
Inputs count: 1
Outputs count: 1
Witnesses count: 0
```

Input OutPoint:

```txt
tx_hash: 0x7b7d25523501b8cf5ddc41a1f4bd6d3d1abf2dcc6db2aa562bffd2735d7620ff
index: 1
```

### After Completing Fee

```txt
Transaction hash: 0x61921431e12086f92f015c5bf75d94dda46b6b4b64264c8b582c199143623657
Inputs count: 1
Outputs count: 2
Cell deps count: 1
Witnesses count: 1
```

Output capacities:

```txt
Receiver output: 6,700,000,000 shannons
Change output: 4,199,870,899,997,675 shannons
Fee: 465 shannons
```

## Query Command

```sh
./query-tx.sh 0x61921431e12086f92f015c5bf75d94dda46b6b4b64264c8b582c199143623657
```

## Query Result

```txt
status: committed
block_number: 0x4c6e
block_hash: 0x3e48b2bf26fcd8849ed1e5545ad3741393d1f95f22f9a5752aeb95e02f4168ce
tx_index: 0x1
```

## Main Lesson

```txt
sendTransaction() returning a tx hash does not prove finality.
get_transaction is needed to inspect whether the transaction is pending, proposed, committed, rejected, or unknown.
```

## Protocol Observation

The transaction hash changed as the transaction structure changed.

This helped me understand the transaction hash as a commitment to the raw transaction structure. The committed transaction then exposed the same core fields through RPC:

- `cell_deps`
- `inputs`
- `outputs`
- `outputs_data`
- `witnesses`
- `tx_status`

This is a better debugging habit than only trusting the UI.
