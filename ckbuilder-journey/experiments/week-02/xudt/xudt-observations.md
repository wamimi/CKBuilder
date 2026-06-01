# Week 2 xUDT Observations

## Experiment

Issue and transfer an xUDT token on local OffCKB devnet, then inspect how Type Scripts turn Cell data into token state.

## Issue Transaction

```txt
0x0f7441d2d1ca474ab4ac21b07727e6f93718d1b1c6f437c457972eeda9e287d3
```

## xUDT Args

```txt
0x7de82d61a7eb2ec82b0dc653e558ba120efcbfbb44dac87c12972d05bf25065300000000
```

## Issued Amount

```txt
42
```

The amount was stored in `outputsData` as little-endian bytes:

```txt
0x2a000000000000000000000000000000
```

## Token Cell Model

```txt
Lock Script = who controls the token Cell
Type Script = token class and validation rules
Cell data = token amount
```

## Transfer Accounting

Observed token transfer accounting:

```txt
Input UDT balance: 54
Output UDT balance: 5
Token change balance: 49
```

Mental model:

```txt
54 input tokens
-> 5 receiver tokens
-> 49 sender change tokens
```

## Ownership Check

Sender Lock Script args:

```txt
0x8e42b1999f265a0078503c4acec4d5e134534297
```

Receiver Lock Script args:

```txt
0x9665e6bc1966ec2bfcca4f11782d2b906f38438f
```

Different receiver args confirmed that the receiver token output was locked to a different owner.

## Main Lesson

```txt
Cell data by itself is storage.
Cell data with a Type Script becomes protocol state.
```

xUDT helped me understand Type Scripts as state-transition validators over token Cells.
