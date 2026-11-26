use assert_cmd::cargo::cargo_bin_cmd;
use std::io::pipe;
use std::process::{Command, Stdio};
use std::time::Duration;

#[test]
fn rounds_up_to_fit_every_item() {
    let workspace = tempfile::tempdir().unwrap();
    cargo_bin_cmd!("batch-plan")
        .current_dir(workspace.path())
        .args(["13", "5"])
        .assert()
        .success()
        .stdout("3\n")
        .stderr("");
    assert_eq!(workspace.path().read_dir().unwrap().count(), 0);
}

#[test]
fn invalid_usage_does_not_print_a_result_or_echo_input() {
    let cases: &[(&[&str], &str)] = &[
        (&[], "expected ITEMS and CAPACITY"),
        (&["1"], "expected ITEMS and CAPACITY"),
        (&["1", "2", "3"], "expected ITEMS and CAPACITY"),
        (&["-1", "2"], "ITEMS must be an unsigned 64-bit decimal"),
        (&["+1", "2"], "ITEMS must be an unsigned 64-bit decimal"),
        (&["", "2"], "ITEMS must be an unsigned 64-bit decimal"),
        (&["１", "2"], "ITEMS must be an unsigned 64-bit decimal"),
        (
            &["18446744073709551616", "1"],
            "ITEMS must be an unsigned 64-bit decimal",
        ),
        (
            &["1", "0"],
            "CAPACITY must be a positive unsigned 64-bit decimal",
        ),
        (
            &["1", "private-input"],
            "CAPACITY must be a positive unsigned 64-bit decimal",
        ),
    ];
    for (args, reason) in cases {
        cargo_bin_cmd!("batch-plan")
            .args(*args)
            .assert()
            .code(2)
            .stdout("")
            .stderr(format!("batch-plan: {reason}; see --help\n"));
    }
}

#[test]
fn help_and_version_describe_the_public_command() {
    cargo_bin_cmd!("batch-plan")
        .arg("--help")
        .assert()
        .success()
        .stdout("Usage: batch-plan ITEMS CAPACITY\nPrint the minimum number of batches needed for ITEMS with a positive CAPACITY.\n")
        .stderr("");
    cargo_bin_cmd!("batch-plan")
        .arg("--version")
        .assert()
        .success()
        .stdout(concat!("batch-plan ", env!("CARGO_PKG_VERSION"), "\n"))
        .stderr("");
}

#[test]
fn closed_output_is_reported_and_retry_works() {
    let workspace = tempfile::tempdir().unwrap();
    let (reader, writer) = pipe().unwrap();
    drop(reader);
    let output = Command::new(assert_cmd::cargo::cargo_bin!("batch-plan"))
        .current_dir(workspace.path())
        .args(["13", "5"])
        .stdin(Stdio::null())
        .stdout(writer)
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert_eq!(
        output.stderr,
        b"batch-plan: could not write stdout; check the output destination\n"
    );

    cargo_bin_cmd!("batch-plan")
        .current_dir(workspace.path())
        .timeout(Duration::from_secs(5))
        .write_stdin("ignored\n")
        .args(["13", "5"])
        .assert()
        .success()
        .stdout("3\n")
        .stderr("");
    assert_eq!(workspace.path().read_dir().unwrap().count(), 0);
}
