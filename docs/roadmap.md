# Fleet roadmap

The intent the roster does not carry: what the fleet is building next. State lives on
GitHub; this page holds goals and open work.

## Goals

1. Every repository ships code a reviewer trusts: real linting, tests that gate, and a
   proof of behavior on the real artifact.
2. A change lands through one pull request that runs the same checks locally and in CI.
3. An agent can work in any repository from its `just` entry points and its docs alone.
4. No secret, credential, or machine path is ever committed, and every public repository
   carries branch protection and security scanning.

## Done

- The standard, the reusable workflows, the rulesets, and the two checkers.
- The gates: signed commits and the `test` check are required, and a definition of done
  backs the pull request checklist.
- CodeQL on the code repositories, and a report-only Trivy license scan.
- Dependabot as the single updater.
- Kotlin and Java in the shared lint table, so a JVM repository lints through the same job.
- A generated-OpenAPI contract rule: an API repository emits its document from annotations, and the checker fails a hand edit or a missing `spec` recipe.
- The standard's committed `protect-main.json` requires one approval. Live ruleset
  deployment is not recorded here.

## Open

- Language linting. Pin the per-language linters and formatters in each repository's
  `mise.toml` and run them through the shared lint job. See the standard's
  [`linting`](https://github.com/simpsonm09-org/simpsonm09-repo-standard/blob/main/docs/linting.md).
- Coverage. Gate changed-line coverage at 80 percent on the code repositories.
- Verification. A per-repository verification skill, a container build smoke job for the
  image repositories, and an end-to-end job for the Playwright and Postman repositories.
- Releases. Adopt the release workflow and a changelog for the artifacts that publish.
- Plugin identifiers. Align the OpenCode plugin ids with the repository names.
- Agent access. Enforce the per-repository levels in `repo-standard` with a dedicated
  agent identity and the correct ruleset bypass modes. The committed approval
  requirement is in place; live deployment and identity enforcement need verification.

## How open work lands

The standard changes in `simpsonm09-repo-standard` first, then roll out to the fleet
through same-repo pull requests on the organization. Each wave ends in a verified state,
checked by each repository's own `check-repo` job. A maintainer may also run the
standard's local `audit-fleet` over sibling checkouts. This local audit does not run
in a consuming repository's CI and does not query another repository through the API.
