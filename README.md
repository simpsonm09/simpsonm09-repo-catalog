# repo-catalog

The fleet roster and policy for the `simpsonm09-org` organization.

The original lives in `simpsonm09-org/simpsonm09-repo-catalog`.
See [`repo-standard`](https://github.com/simpsonm09-org/simpsonm09-repo-standard).

## What it does

It holds the repositories tracked under the fleet framework, the tier of each one,
the adoption status, and the policy for the tiers. The standard holds the checks.
This repository holds only the intent that GitHub cannot report.

## Layout

- `repos.json` is the roster.
- `ignore.json` lists the organization repositories that are out of the fleet.
- `owned-forks.json` records personally owned forks and their upstream repositories.
- `owned-repositories.json` records exact personal repository identities without upstreams.
- `policy.md` describes the tiers and the expectations.
- `scripts/catalog-policy.mjs` validates access defaults, overrides, and ignore identities offline.
- `scripts/validate.mjs` validates local policy, then checks the roster against the organization.

## Quick start

```bash
just install
just verify
```

## Commands

| Command | Does |
| --- | --- |
| `just install` | Installs the pinned tools. |
| `just lint` | Runs the linters. |
| `just test` | Validates the roster against the organization. |
| `just test-policy` | Runs local owned-target policy tests without querying GitHub. |
| `just test-catalog-policy` | Runs catalog policy unit tests without querying GitHub. |
| `just verify` | Lints and tests. |

## Documentation

Read [`docs/README.md`](docs/README.md).

## License

MIT. See [`LICENSE`](LICENSE).

## Related repositories

- [`repo-standard`](https://github.com/simpsonm09-org/simpsonm09-repo-standard) owns the shared CI, linting, security, and governance.
- [`repo-template`](https://github.com/simpsonm09-org/simpsonm09-repo-template) is the reference implementation.
