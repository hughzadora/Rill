# Adopt Rill

Tell Codex which exact Rill release to use and select an empty directory for your product. Ask Codex to handle the steps below. When the workspace is ready, describe what you want the product to do in your own words.

1. Download `rill-kit-<version>.tar.gz` and its `.sha256` file from the same GitHub release tag. Run `shasum -a 256 -c rill-kit-<version>.tar.gz.sha256` or the equivalent `sha256sum -c` in the download directory. Stop on a mismatch.
2. Extract the kit outside the project directory. Choose one archive under `templates/`. Use the base template if Rill should select the toolchain from your product requirements. Use a named profile when it matches the target.
3. Verify the chosen archive with its matching `.sha256` file. Extract it into the empty project directory. Keep the kit's SHA-256 and the template's SHA-256 with the project in `docs/PROJECT.md` or its current adoption record. The template's `RILL_VERSION` identifies its release.
4. Open the project directory in Codex and start Rill. Follow the chosen profile's locked installation steps and run the workflow's checks.

For an upgrade, review the release and apply it as a separate change in Git. Preserve your product files and lock choices, rerun the applicable checks, and keep the previous version and its acceptance evidence available. Use Git to revert the adoption change if it fails acceptance.
