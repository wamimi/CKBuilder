#![cfg_attr(not(any(feature = "library", test)), no_std)]
#![cfg_attr(not(test), no_main)]

#[cfg(any(feature = "library", test))]
extern crate alloc;

#[cfg(not(any(feature = "library", test)))]
ckb_std::entry!(program_entry);
#[cfg(not(any(feature = "library", test)))]
// By default, the following heap configuration is used:
// * 16KB fixed heap
// * 1.2MB(rounded up to be 16-byte aligned) dynamic heap
// * Minimal memory block in dynamic heap is 64 bytes
// For more details, please refer to ckb-std's default_alloc macro
// and the buddy-alloc alloc implementation.
ckb_std::default_alloc!(16384, 1258306, 64);

use ckb_std::ckb_constants::Source;

pub fn program_entry() -> i8 {
    ckb_std::debug!("witness-door-lock running");

    let expected = b"OPEN_CAPSULE";

    match ckb_std::high_level::load_witness(0, Source::Input) {
        Ok(witness) => {
            ckb_std::debug!("Witness length: {}", witness.len());
            ckb_std::debug!("Witness bytes: {:02x?}", witness);

            if witness == expected {
                ckb_std::debug!("Witness matched. Door opened.");
                0
            } else {
                ckb_std::debug!("Witness did not match OPEN_CAPSULE.");
                -1
            }
        }
        Err(err) => {
            ckb_std::debug!("load_witness failed: {:?}", err);
            -1
        }
    }
}
