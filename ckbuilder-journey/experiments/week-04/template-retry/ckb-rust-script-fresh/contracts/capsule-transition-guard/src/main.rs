#![cfg_attr(not(any(feature = "library", test)), no_std)]
#![cfg_attr(not(test), no_main)]

#[cfg(any(feature = "library", test))]
extern crate alloc;

use ckb_std::{ckb_constants::Source, default_alloc, entry, high_level::load_cell_data};

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
const MAGIC: &[u8; 10] = b"CAPSULE_V1";
const MAGIC_LEN: usize = 10;
const VERSION_LEN: usize = 4;
const CAPSULE_ID_LEN: usize = 32;
const HEADER_LEN: usize = MAGIC_LEN + VERSION_LEN + CAPSULE_ID_LEN;

const MAX_DATA_LEN: usize = 1024; // will enforce a nicer UX limit in the frontend

#[derive(Clone, Copy)]
struct CapsuleHeader<'a> {
    version: u32,
    capsule_id: &'a [u8],
}


pub fn program_entry() -> i8 {
    ckb_std::debug!("capsule-transition-guard running");

    let input0 = load_optional_cell_data(0, Source::GroupInput);
    let output0 = load_optional_cell_data(0, Source::GroupOutput);

    // Keep v0 simple: exactly 0 or 1 input, exactly 0 or 1 output.
    // This avoids ambiguous batch updates while I am learning the model.
    if load_cell_data(1, Source::GroupInput).is_ok() {
        ckb_std::debug!("Rejected: more than one Capsule input in script group.");
        return -10;
    }

    if load_cell_data(1, Source::GroupOutput).is_ok() {
        ckb_std::debug!("Rejected: more than one Capsule output in script group.");
        return -11;
    }

    match (input0, output0) {
        // Mint: no previous capsule, one new capsule.
        (None, Some(output_data)) => validate_mint(&output_data),

        // Update: old capsule consumed, new capsule created.
        (Some(input_data), Some(output_data)) => validate_update(&input_data, &output_data),

        // Burn/archive: old capsule consumed, no replacement.
        // v0.
        (Some(input_data), None) => {
            ckb_std::debug!("Archive/burn transition detected.");
        
            match parse_capsule(&input_data) {
                Ok(_) => {
                    ckb_std::debug!("Archive/burn accepted: valid Capsule input consumed.");
                    0
                }
                Err(code) => {
                    ckb_std::debug!("Archive/burn rejected: invalid Capsule input.");
                    code
                }
            }
        }

        // Nothing to validate.
        (None, None) => {
            ckb_std::debug!("Rejected: no Capsule input or output in group.");
            -12
        }
    }
}

fn validate_mint(output_data: &[u8]) -> i8 {
    ckb_std::debug!("Mint transition detected.");

    let output = match parse_capsule(output_data) {
        Ok(header) => header,
        Err(code) => return code,
    };

    if output.version != 1 {
        ckb_std::debug!("Rejected mint: first version must be 1.");
        return -20;
    }

    ckb_std::debug!("Mint accepted: CAPSULE_V1 with version 1.");
    0
}

fn validate_update(input_data: &[u8], output_data: &[u8]) -> i8 {
    ckb_std::debug!("Update transition detected.");

    let input = match parse_capsule(input_data) {
        Ok(header) => header,
        Err(code) => return code,
    };

    let output = match parse_capsule(output_data) {
        Ok(header) => header,
        Err(code) => return code,
    };

    if input.capsule_id != output.capsule_id {
        ckb_std::debug!("Rejected update: capsule_id changed.");
        return -30;
    }

    let expected_next_version = match input.version.checked_add(1) {
        Some(v) => v,
        None => {
            ckb_std::debug!("Rejected update: version overflow.");
            return -31;
        }
    };

    if output.version != expected_next_version {
        ckb_std::debug!("Rejected update: output version must be input version + 1.");
        return -32;
    }

    if input_data == output_data {
        ckb_std::debug!("Rejected update: output data is identical to input data.");
        return -33;
    }

    ckb_std::debug!("Update accepted: same capsule_id and version incremented.");
    0
}

fn parse_capsule(data: &[u8]) -> Result<CapsuleHeader, i8> {
    if data.len() > MAX_DATA_LEN {
        ckb_std::debug!("Rejected: capsule data too large.");
        return Err(-40);
    }

    if data.len() <= HEADER_LEN {
        ckb_std::debug!("Rejected: capsule data too short or missing body.");
        return Err(-41);
    }

    if &data[0..MAGIC_LEN] != MAGIC {
        ckb_std::debug!("Rejected: missing CAPSULE_V1 magic prefix.");
        return Err(-42);
    }

    let version_offset = MAGIC_LEN;

    let version = u32::from_le_bytes([
        data[version_offset],
        data[version_offset + 1],
        data[version_offset + 2],
        data[version_offset + 3],
    ]);

    if version == 0 {
        ckb_std::debug!("Rejected: version cannot be 0.");
        return Err(-43);
    }

    let id_start = MAGIC_LEN + VERSION_LEN;
    let id_end = id_start + CAPSULE_ID_LEN;
    let capsule_id = &data[id_start..id_end];

    let body = &data[HEADER_LEN..];

    if body.is_empty() {
        ckb_std::debug!("Rejected: capsule body cannot be empty.");
        return Err(-44);
    }

    Ok(CapsuleHeader {
        version,
        capsule_id,
    })
}

fn load_optional_cell_data(index: usize, source: Source) -> Option<alloc::vec::Vec<u8>> {
    match load_cell_data(index, source) {
        Ok(data) => Some(data),
        Err(err) => {
            ckb_std::debug!("No cell data at this index/source: {:?}", err);
            None
        }
    }
}
