# Week 3 Notes - Minimal Scripts and Syscalls

**Focus:** Understand CKB scripts as transaction inspectors.


## Question I am investigating

After working with transactions through CCC, I want to understand what changes when verification logic runs inside CKB-VM.

The key question is:

```txt
How does a script read the transaction it is supposed to verify?
```

## Why syscalls matter

CKB scripts run inside an isolated VM. They do not freely access host state, global chain state, or arbitrary memory outside the script.

Syscalls are the controlled interface that lets a script read the allowed parts of the transaction environment.

My current model:

```txt
script code = verifier logic
syscalls = controlled read access to transaction context
return code = accept or reject
```

## Data a script may need

A script may need to read:

- its own script args
- input Cells
- output Cells
- Cell data
- witnesses
- headers
- group inputs
- group outputs

This is why syscalls such as `load_script`, `load_cell_data`, and `load_witness_args` are important. They let the script inspect exactly the public information it needs for validation.

## Sources and script groups

The `Source` argument matters because a script often needs to know whether it is reading:

- input Cells
- output Cells
- grouped input Cells
- grouped output Cells

This is especially important for Type Scripts.

A Type Script may need to compare old state and new state, so it cannot only inspect one Cell in isolation. It may need to inspect all Cells in the same script group.

## Minimal verifier idea

A very small script experiment could be:

```txt
Reject an output Cell if its data contains a forbidden word.
```

For example:

```txt
if output data contains "carrot":
    return error
else:
    return 0
```

This is not a useful production script, but it teaches the shape of verification:

```txt
read output data
check a rule
return 0 or non-zero
```

That is the core verifier pattern.

## Protocol-level answer

CKB scripts need syscalls because they run inside an isolated VM. They cannot directly reach into the node or the host environment. Syscalls are the protocol-defined boundary that lets scripts read transaction data, Cell data, witnesses, headers, and script arguments in a deterministic way.

This boundary matters because every node must run the same script and get the same result.

## ZK / Thaler connection

The connection to proof systems is the verifier mindset.

A CKB script is deterministic, while many proof systems involve randomness, interaction, or compiled verifier equations. But the mental shape is similar:

```txt
read public data
check a claimed relation
accept or reject
```

Relevant Thaler connections:

- Chapter 2: fingerprinting and randomized checking
- Chapter 4: interactive proofs
- Chapter 10: IOPs and polynomial IOPs

The useful lesson is not that CKB scripts are ZK proofs. The useful lesson is that both require careful thinking about what the verifier is allowed to read, what relation it checks, and what evidence is supplied.

## Current mental model

```txt
Transaction = proposed state transition
Witness = evidence supplied by the transaction creator
Syscalls = how script code reads the transaction context
Script = deterministic verifier
Return 0 = accept
Return non-zero = reject
```

This is the bridge from using scripts to designing scripts.
