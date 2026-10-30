# Fleet policy

The catalog answers which repositories the framework covers and what each one owes.
The standard in [`repo-standard`](https://github.com/simpsonm09-org/simpsonm09-repo-standard)
answers what conformance means. This page records the intent that GitHub cannot
report, so the checks have something to check against.

## Tiers

| Tier | Owes |
| --- | --- |
| `standard` | The standard, the checkers, the reusable workflows, and the rulesets. |
| `template` | A reference implementation of the standard. Its community files, `.aislop/config.yml`, `.github/config/flint.toml`, `trivy.yaml`, `CODEOWNERS`, and `pin-update.yml` match the standard's copies byte for byte. Its `ci.yml`, `dependabot.yml`, `mise.toml`, `justfile`, and `.gitattributes` differ by design. |
| `catalog` | This roster and policy. |
| `plugin` | A published plugin layer that consumes the standard. |
| `tooling` | Developer and machine tooling that consumes the standard. |
| `feature` | An application that consumes the standard. |
| `fixture` | A conformance repository used to validate the framework, not a product. |
| `legacy` | A repository kept for reference but outside the fleet. |

## Expectations

Every non-legacy repository carries the standard's community files, the docs layout,
the pinned caller CI, a `protect-main` ruleset, the owner topic, and public-repo
secret scanning and push protection. A repository's own CI runs the `standard` check,
which covers the tree-local files plus the settings, topics, and ruleset the
repository can read about itself. No repository audits another.

A repository may add a second test job named `test-<suffix>`. maxstack runs its installer
suite as `test-node` on a Windows runner, in addition to `test`.

## Membership

Every organization repository is either in `repos.json` or in `ignore.json` with a
reason. `scripts/validate.mjs` fails when the roster and the organization disagree,
so a new repository cannot appear unnoticed.

## Agent access

Each repository states the intended level for AI agent work against the organization
repository. This catalog is policy data; it does not activate a runtime grant. The
resolver and plugin integration must be reviewed and ready before this catalog change
is merged or applied.

`repos.json` sets a default per tier in `agentAccessDefaults`, and a repository may
override it with `agentAccess`. All eight tier defaults and all 17 current fleet
repositories are `full`. An override, when present, must be one of the selectable
levels below. `read` is the internal baseline for destinations without a grant; it is
not selectable. A roster repository's effective level is its explicit `agentAccess`
override when present, otherwise its tier default. An identity in `agentAccessIgnore`
overrides any tier default or roster grant and receives no writes. Unknown organization
targets and owned targets without a separate authorization receive no writes. Separately
authorized owned-fork and owned-repository policies continue to use their own rules.
Deny is a separate identity rule, not a level.

| Level | Agent may | Review and enforcement intent |
| --- | --- | --- |
| `propose` | Manage branches and pull requests, create issues, and request review. No merge. | One human review is required. A repository administrator may bypass only that approval requirement for a pull request. |
| `merge` | Everything in `propose`, plus normal pull request merges. | One human review is required. A repository administrator may bypass only that approval requirement for a pull request. |
| `full` | Full fleet access, including milestone and administrative actions. Pull requests use GitHub's native merge path, with required checks and signatures enforced. | Checks-only native merge; no agent App bypass. `@simpsonm09` CODEOWNER approval is optional. |

At `full`, this checks-only approval rule also applies when a pull request changes CI workflows, security scans, or permission rules; no human-review exception applies.

Required CI checks and signed commits remain hard requirements at every level. The
approval-only administrator bypass does not bypass either requirement. The catalog
does not record live ruleset state or guarantee that the policy is active.

### Explicit agent-access ignores

Three existing entries in `ignore.json` carry `agentAccessIgnore`: the archived capstone,
`pdf_field_automation_acrobat`, and `steam_wishlist_cleanup`. Each lists the exact
`simpsonm09/<repository>` and `simpsonm09-org/<repository>` identities. Matching is
case-insensitive and requires both owner and repository name to match. Other ignore
entries remain inventory-only. The pure catalog validator checks the shape offline;
organization roster reconciliation remains a live CLI check.

This identity list defines policy intent. It is not a universal deny sandbox: tools or
paths outside the integrated resolver may not consult it. No rollout or activation is
claimed by this source change.

## Personally owned forks

`owned-forks.json` records repositories owned by `simpsonm09` and the upstream repository
each fork came from. It does not add a repository to the `simpsonm09-org` roster or change
the organization membership reconciliation. Each entry names both repositories as
fully qualified `owner/repository` identities. The target must belong to `simpsonm09`.
The upstream records provenance and never grants write access.

The collection accepts only `propose`. For a personally owned target, `propose` means an
agent may push a branch and open a pull request. It does not allow merging or pushing to
`main`. A third-party upstream never receives pull requests or writes from this policy.
A missing policy file or malformed, duplicate, or unsupported entry fails local
validation. This validator checks policy data only. It does not grant access in the
installed gate.

Deployment is staged. The repo-standard resolver must read `owned-forks.json`, and the
organization plugin must add a target-aware adapter before this policy can affect gate
decisions. The adapter must keep upstreams read-only and restrict `propose` to the owned
target. Update pinned standard versions and apply the workspace after those changes land.
Until then, pstack writes remain denied.

## Personally owned repositories

`owned-repositories.json` records exact `owner/repository` identities owned by
`simpsonm09` that have no upstream repository. It is separate from `owned-forks.json`,
which requires upstream provenance. Each record accepts only `repository` and
`agentAccess`, and the only supported access level is `propose`. The validator rejects
other owners, malformed identities, duplicates, unknown fields, and identities that
collide with an owned-fork target or upstream.

The committed policy grants `propose` to the exact identity `simpsonm09/simpsonm09`.
That grant permits non-default branch pushes and pull requests within that same
repository. It denies default-branch pushes, force pushes, deletions, tag pushes,
merges, and administration. Local validation checks the record shape before the
validator queries the organization roster. The record affects no installed gate until
the runtime consumer uses the reviewed standard resolver and loads this policy from
committed `upstream/main`. Catalog validation does not prove that an installed consumer
has adopted that resolver or policy. See
[the owned-repository reference](docs/features/owned-repositories.md) for the file
shape and validation errors.

The tier defaults.

| Tier | Default |
| --- | --- |
| `standard` | `full` |
| `template` | `full` |
| `catalog` | `full` |
| `plugin` | `full` |
| `tooling` | `full` |
| `feature` | `full` |
| `fixture` | `full` |
| `legacy` | `full` |

## What does not belong here

Visibility, settings, topics, ruleset names, and CI conclusions are state. Read them
live from GitHub. A second copy of state in this repository would rot.
