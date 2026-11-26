# Container deployment profile

This profile qualifies an inert static HTTP image as a deployment candidate. It checks the Dockerfile with Trivy, builds a pinned digest image with the local Docker daemon, checks the built image, exercises health and accepted-response behavior on a loopback-published port, and rehearses restoring a saved accepted image after a rejected replacement. The image uses BusyBox `httpd` on pinned Alpine 3.24.4, so it has no application package manager or Python runtime to drift. When the product changes the page, update `RILL_EXPECTED_MARKER` or the default marker in `scripts/image.sh` with the product behavior.

## Setup

Install a local Docker daemon and review the pinned tools in `mise.toml`. `RILL_DOCKER_HOST` selects a non-default Docker socket; the default is `$HOME/.colima/rill-issue-13/docker.sock`. Start the daemon before running any task. `tests/profile.sh` activates the pinned Docker CLI plugin when `docker-cli-plugin-docker-buildx` is installed, so builds use the supported BuildKit path rather than the deprecated legacy builder.

Review `trivy.yaml`, `image/Dockerfile`, and the scripts before trusting them. Run:

```sh
mise trust
mise install --locked
mise lock --check
mise run verify
mise run qualify
```

`verify` runs format, shell syntax, shell lint, local links, secret scanning, policy checks, a real build, and a runtime smoke check. `qualify` repeats those checks and injects a root-user Dockerfile, an empty policy scope, changed HTTP behavior, and a recovery from a saved image archive. Evidence is written under `.rill-deployment/`. A missing daemon or absent Linux target is a blocker; do not claim deployment acceptance from a static inspection alone.

The pinned tool lock covers macOS arm64. Qualify other targets before listing them as supported. No registry push or cloud deployment is performed.
