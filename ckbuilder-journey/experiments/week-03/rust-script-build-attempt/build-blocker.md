# Rust Script Build Attempt - AtomicLoadAdd Blocker

**Focus:** Record the Week 3 Rust script build attempt and the blocker encountered before a valid CKB-VM artifact was produced.

---

## Goal

The goal was to move from the Rust SDK/off-chain client layer into the Rust script/on-chain verifier layer.

Target path:

```sh
cargo generate gh:cryptape/ckb-script-templates workspace --name ckb-rust-script
cd ckb-rust-script
make generate CRATE=hello-world
make build
```

## Environment setup attempted

The CKB script build target is:

```txt
riscv64imac-unknown-none-elf
```

This is different from a normal Rust SDK project, which builds for the local machine.

Setup steps included:

```sh
rustup target add riscv64imac-unknown-none-elf
brew install llvm@18
```

The build path detected LLVM/Clang 18:

```txt
TARGET_CC="/opt/homebrew/opt/llvm@18/bin/clang"
TARGET_AR="/opt/homebrew/opt/llvm@18/bin/llvm-ar"
```

## Build blocker

The build hit an LLVM/RISC-V atomic operation error inside `bytes v1.11.1`:

```txt
rustc-LLVM ERROR: Cannot select ... AtomicLoadAdd ...
error: could not compile `bytes` (lib)
```

The dependency path inspected was:

```txt
ckb-std v1.1.0
└── molecule v0.9.2
    └── bytes v1.11.1
```

## Fix attempts

I tried the documented direction for dummy atomics:

```toml
ckb-std = { version = "1.1", features = ["dummy-atomic"] }
```

I also tried adjusting Molecule features:

```toml
molecule = { version = "0.9.2", default-features = false, features = ["bytes_vec"] }
```

The `AtomicLoadAdd` error persisted.



The script did not fail as verifier logic.

It failed before becoming a valid CKB-VM artifact.

