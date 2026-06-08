# Week 3 Notes - ckb-std as the Verifier Runtime Surface

**Focus:** Understand what `ckb-std` provides to Rust scripts running inside CKB-VM.


## Main question

```txt
What runtime does a CKB Rust verifier actually have?
```

CKB Rust scripts are not normal Rust applications.

A normal Rust program usually assumes:

```txt
main()
standard library runtime
operating system services
normal I/O
normal allocator
```

A CKB Rust script is closer to:

```txt
_start
ckb_std::entry!(program_entry)
CKB-VM
syscalls into transaction data
return 0 or error code
```

## Runtime pieces

The `ckb-std` pieces I mapped this week:

```txt
entry!              -> defines the script entry point
default_alloc!      -> provides allocation support in no_std Rust
syscalls            -> raw communication with CKB-VM
high_level APIs     -> Rust-style wrappers over syscalls
SysError            -> structured error handling
debug! / logger     -> script observability
type_id utilities   -> singleton identity validation helpers
spawn / IPC         -> modular cross-script execution
dummy_atomic        -> compatibility support for Rust code using atomics
```

## Current model

`ckb-std` is not just a helper library.

It is the practical runtime surface that lets bare-metal Rust become CKB-aware verifier code.

## Syscalls vs RPC

The distinction that clicked:

```txt
RPC = how I inspect chain data from outside validation
Syscalls = how a script inspects transaction data from inside validation
```

In Week 2, I used RPC methods such as `get_transaction` and `get_live_cell`.

In Week 3, I started mapping how a script uses syscalls and high-level wrappers to read the transaction it is validating.

## Error handling

Script failure should be precise.

Important error categories:

```txt
IndexOutOfBound
ItemMissing
LengthNotEnough
Encoding
TypeIDError
Unknown(u64)
```

This connects to my simple-lock debugging:

```txt
resolve failure != script failure
script failure != malformed witness
malformed witness != invalid state transition
```

## Logging

The `debug!` macro is useful for observability, but logs consume cycles.

That is a protocol-engineering difference from normal backend work:

```txt
In CKB-VM, even observability has execution cost.
```

## Spawn and IPC

The `spawn` and IPC model made me think about modular verifiers:

```txt
parent script = coordinator / main verifier
child script = reusable sub-verifier or service
```

This is not something I am building yet, but it gives me a possible future pattern for separating application transition logic from specialized cryptographic verification.