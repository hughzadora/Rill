use std::ffi::OsStr;
use std::io::{Write, stdout};
use std::num::NonZeroU64;
use std::process::ExitCode;

const HELP: &str = "Usage: batch-plan ITEMS CAPACITY\n\
Print the minimum number of batches needed for ITEMS with a positive CAPACITY.";

fn decimal(argument: &OsStr) -> Option<u64> {
    let text = argument.to_str()?;
    if !text.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}

fn usage_error(reason: &str) -> ExitCode {
    eprintln!("batch-plan: {reason}; see --help");
    ExitCode::from(2)
}

fn write_output(output: impl std::fmt::Display) -> ExitCode {
    let mut stdout = stdout().lock();
    if writeln!(stdout, "{output}")
        .and_then(|()| stdout.flush())
        .is_err()
    {
        eprintln!("batch-plan: could not write stdout; check the output destination");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}

fn main() -> ExitCode {
    let mut arguments = std::env::args_os().skip(1);
    let items = arguments.next();
    let capacity = arguments.next();
    match (items.as_deref(), capacity.as_deref()) {
        (Some(flag), None) if flag == "--help" => return write_output(HELP),
        (Some(flag), None) if flag == "--version" => {
            return write_output(concat!("batch-plan ", env!("CARGO_PKG_VERSION")));
        }
        _ => {}
    }
    let (Some(items), Some(capacity), None) = (items, capacity, arguments.next()) else {
        return usage_error("expected ITEMS and CAPACITY");
    };
    let Some(items) = decimal(&items) else {
        return usage_error("ITEMS must be an unsigned 64-bit decimal");
    };
    let Some(capacity) = decimal(&capacity).and_then(NonZeroU64::new) else {
        return usage_error("CAPACITY must be a positive unsigned 64-bit decimal");
    };
    write_output(batch_plan::minimum_batches(items, capacity))
}
