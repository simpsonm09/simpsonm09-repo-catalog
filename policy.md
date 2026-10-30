# Fleet policy

The catalog answers which repositories the framework covers and what each one owes.
The standard in [`repo-standard`](https://github.com/simpsonm09-org/simpsonm09-repo-standard)
answers what conformance means. This page records the intent that GitHub cannot
report, so the checks have something to check against.

## Tiers

| Tier | Owes |
| --- | --- |
| `standard` | The standard, the checkers, the reusable workflows, and the rulesets. |
| `template` | A byte-identical reference implementation of the standard. |
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

## Membership

Every organization repository is either in `repos.json` or in `ignore.json` with a
reason. `scripts/validate.mjs` fails when the roster and the organization disagree,
so a new repository cannot appear unnoticed.

## Agent access

Each repository states how much an AI agent may do against the organization
repository. The value is intent. GitHub has no such setting, and enforcement lives in
[`repo-standard`](https://github.com/simpsonm09-org/simpsonm09-repo-standard), not
here. Until an agent runs as an identity separate from the maintainer, the value is a
documented policy, not a control.

`repos.json` sets a default per tier in `agentAccessDefaults`, and a repository may
override it with `agentAccess`. The effective level is `agentAccess` when present,
otherwise the tier default.

| Level | Agent may | Mechanism once enforced |
| --- | --- | --- |
| `none` | Nothing. No credential reaches the organization repository. | No identity grant. |
| `read` | Clone, fetch, read. | Read-only collaborator or a read-only app install. |
| `propose` | Push a branch and open a pull request, never merge. | Write access, the agent absent from the ruleset bypass list, and at least one required approval the agent cannot give. |
| `merge` | Merge its own green pull requests, with no direct push to `main`. | The agent in the bypass list with mode `pull_request`. |
| `full` | Push to `main` or change settings. | Bypass mode `always`, or an admin role. |

`propose` needs at least one required approval that the agent cannot give. The
standard's committed [`protect-main.json`](https://github.com/simpsonm09-org/simpsonm09-repo-standard/blob/main/rulesets/protect-main.json)
sets `required_approving_review_count` to `1`. This describes the committed policy,
not the live GitHub ruleset. A separate agent identity and the correct bypass mode
are still needed to enforce the level. See the standard's
[`governance guide`](https://github.com/simpsonm09-org/simpsonm09-repo-standard/blob/main/docs/governance.md).

The tier defaults.

| Tier | Default |
| --- | --- |
| `standard` | `propose` |
| `template` | `propose` |
| `catalog` | `propose` |
| `plugin` | `propose` |
| `tooling` | `propose` |
| `feature` | `merge` |
| `fixture` | `read` |
| `legacy` | `none` |

## What does not belong here

Visibility, settings, topics, ruleset names, and CI conclusions are state. Read them
live from GitHub. A second copy of state in this repository would rot.
