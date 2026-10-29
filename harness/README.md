# Eureka web harness (static applications)
Creates a self-contained HTML/CSS/JavaScript file through EM Installer, tests it in Chromium, attempts one evidence-based repair, and exposes a sandboxed preview at /factory.

This is not autonomous arbitrary shell execution, npm project building, backend hosting, or an EM Factory MCP connection. Factory remains a separate resource-packaging capability.

## Isolation
Only the authenticated runner on the private runtime network has the Docker socket (host administration authority). Never expose runner port 3100 publicly. The model does not choose Docker arguments or shell commands. Each job has no network, no host mounts, no secrets, a read-only root, resource limits and a fixed browser entrypoint. Browser screenshots and test results are evidence only for the stated checks. A passing result is not a general correctness guarantee. A Docker container shares the host kernel; it is not a VM security boundary.

Preview iframe has allow-scripts without allow-same-origin, a restrictive CSP and no forms/popups/top navigation. External resources and integrations are intentionally unsupported.

## Operation
Use compose.yaml + compose.existing-caddy.yaml + compose.harness.yaml for future deployments.
Jobs persist in the existing data volume; refresh resumes polling. Runtime restarts mark unfinished jobs interrupted rather than claiming success. One generation at a time; up to two model calls, each with up to 12000 output tokens. Cancellation terminates the browser job. Generated files are downloadable; existing chat conversations are not automatically imported.

## Validation
Local integration test: node harness/integration.test.mjs (mock inference and browser transport).
Deployment requires an actual isolated browser smoke test and container health checks.
Playwright image and npm package versions must match: https://playwright.dev/docs/docker
