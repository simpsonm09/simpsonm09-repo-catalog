# Fleet architecture

This page is the guiding document for the fleet. It names the four groups of repositories, what each group owns, and how a person reaches a model through the workspace. It states the target. The last section lists where the fleet differs from the target today.

`<workspace>` means the workspace root. It is an install target, not a repository. Every clone lives under `<workspace>/projects/repos`, and every linked worktree lives under `<workspace>/projects/worktrees`.

## The four groups

| Group | Repositories | Answers |
| --- | --- | --- |
| AI tooling | `simpsonm09-maxstack`, `pstack-max` (our fork of pstack-claude), `simpsonm09-org-ai-plugin`, `simpsonm09-personal-ai-plugin` | How does an agent session get its harness, its skills, and its rules? |
| Human tooling | `simpsonm09-dev-setup` | Which tools does the person have, and how does a command get a secret? |
| Reference | `simpsonm09-repo-standard`, `simpsonm09-repo-catalog`, `simpsonm09-repo-template` | What is in the fleet, what does "done" mean, and what may an agent do? |
| Feature | Every other repository | What does the fleet build? |

```mermaid
flowchart TB
    Human(["Human"])

    subgraph AI["AI tooling"]
        Pstack["pstack-max<br/>base layer"]
        Org["org-ai-plugin<br/>general layer"]
        Personal["personal-ai-plugin<br/>person and machine layer"]
        Maxstack["maxstack<br/>composer and installer"]
    end

    subgraph Tooling["Human tooling"]
        DevSetup["dev-setup<br/>tools, settings/.env, secret wrappers"]
    end

    subgraph Reference["Reference"]
        Catalog["repo-catalog<br/>roster, tiers, agent access"]
        Standard["repo-standard<br/>checks, workflows, rulesets"]
        Template["repo-template<br/>reference implementation"]
    end

    subgraph Workspace["Workspace root (install target, not a repository)"]
        T3["T3 Code"]
        Generated["Generated harness config<br/>and the T3 snapshot"]
        Features["Feature repositories<br/>projects/repos"]
    end

    Pstack --> Maxstack
    Org --> Maxstack
    Personal --> Maxstack
    Maxstack -- "install, update, remove" --> Generated
    Maxstack -- "install and set defaults" --> T3
    T3 -- "snapshot" --> Maxstack
    Generated --> T3
    Human --> T3
    T3 -- "sessions" --> Features
    DevSetup -- "tools and secrets" --> Human
    Catalog -- "agent access level" --> Org
    Standard -- "gates and CI" --> Features
    Template -- "starting point" --> Features
    Catalog -- "roster" --> Features
```

## The path from a person to a model

A person works in T3 Code. T3 Code starts one of seven harnesses. The harness talks to a model provider, and the provider path differs by harness. maxstack sets no model. The person picks the model in the T3 model picker.

```mermaid
flowchart LR
    Human(["Human"]) --> T3["T3 Code"]

    subgraph Harnesses["Harnesses"]
        Claude["Claude Code"]
        Copilot["GitHub Copilot CLI"]
        OpenCode["OpenCode"]
        Pi["Pi"]
        Codex["Codex"]
        Cursor["Cursor"]
        Antigravity["Antigravity"]
    end

    T3 --> Claude & Copilot & OpenCode & Pi & Codex & Cursor & Antigravity

    Layers["Plugin layers<br/>pstack, org, personal"] -. "skills, hooks, gate" .-> Harnesses

    Claude --> Anthropic["Anthropic subscription"]
    Copilot --> GitHub["GitHub Copilot"]
    OpenCode --> OpenCodeProviders["Providers connected in OpenCode"]
    Pi --> LocalModel["Local model server"]
    Codex --> OpenAI["OpenAI"]
    Cursor --> CursorSub["Cursor"]
    Antigravity --> Google["Google"]
```

Claude Code uses the Anthropic subscription, and Codex uses the OpenAI one. Those are the two paid accounts. Copilot, Cursor and Antigravity run on free usage. OpenCode uses the providers the user has connected in OpenCode. Pi uses a locally hosted model. maxstack sets no model and no provider for any harness.

Pi is the validation harness. It loads no third-party extensions. Its only extensions are the org gate and pstack's own Pi extension. It also loads the skills of all three layers, and the user-level agent skills folder, which `PI_CODING_AGENT_DIR` does not isolate.

The three plugin layers load in order, and a later layer wins where two layers set the same value.

1. `pstack` is the base layer. It comes from the `plugins/pstack` folder of pstack-max at one pinned commit.
2. `simpsonm09-org-ai-plugin` is the general layer. It holds the skills, the integration registry, and the tool-call gate that apply to any person or machine.
3. `simpsonm09-personal-ai-plugin` is the person and machine layer. It holds the skills that name one person's accounts and one machine.

One layer is one plugin in every harness. Edit a layer in its own repository, never in an installed copy.

### Harness tiers

The fleet sorts its harnesses into two tiers. Each harness uses its own provider, with two exceptions: OpenCode uses the providers the user has connected in it, and Pi uses any locally hosted model.

| Tier | Harnesses | Receives |
| --- | --- | --- |
| First | OpenCode, Codex, Claude Code, GitHub Copilot | The full set from the layers: skills, agents, hooks or gate, MCP servers, and instructions. Each piece a harness does not receive has a documented reason. |
| Second | Pi, Cursor, Antigravity | Skills and instructions at minimum. Gaps are recorded in the [parity matrix](https://github.com/simpsonm09-org/simpsonm09-maxstack/blob/main/docs/parity-matrix.md). |

The current gaps, as [maxstack's T3 setup](https://github.com/simpsonm09-org/simpsonm09-maxstack/blob/main/docs/t3-setup.md) and the parity matrix record them:

- Codex is not set up. maxstack writes no Codex runtime, config, or T3 instance.
- Cursor and Antigravity receive none of the layers yet.
- GitHub Copilot's pre-tool hook is a no-op on Windows for pstack's own checks (G2 in the parity matrix).
- MCP writers are not built for Claude Code, Copilot, Pi, or Codex, so the composed MCP set is empty (G18).
- Repo-local subagent profiles exist only for OpenCode (G19).

A provider may later be reached through a local proxy, CLIProxyAPI. Nothing in the fleet assumes a direct provider endpoint or one account per harness.

## AI tooling

### maxstack

maxstack composes the AI stack and owns its lifecycle in a workspace. It owns no layer. Its inputs are one settings file and the ordered layer manifest. Its output is a workspace that a person can open in T3 Code.

```mermaid
flowchart LR
    Settings["Settings<br/>harnesses, providers, OS,<br/>layers, CLI installs"] --> Plan["Plan<br/>audit, no writes"]
    Defaults["T3 defaults<br/>held in maxstack"] --> Plan
    Layers["layers.json<br/>and the pstack pin"] --> Plan
    Plan --> Apply["Install or update"]
    Plan --> Remove["Remove"]
    Apply --> CLIs["Harness CLIs and T3 Code<br/>winget or Brewfile"]
    Apply --> Config["Harness config<br/>in the workspace"]
    Apply --> T3Set["T3 provider instances<br/>and defaults"]
    Apply --> Lock["stack.lock.json"]
    T3Live["Live T3 settings"] --> Snapshot["Snapshot<br/>in the workspace"]
    Snapshot -. "drift against defaults" .-> Plan
```

maxstack has six jobs.

| Job | What it means |
| --- | --- |
| Hold the T3 defaults | The T3 Code setup the fleet wants lives in maxstack as a file. The defaults file names the provider instances and the app defaults. It sets no model. The T3 settings keys `defaultModelSelection` and `textGenerationModelSelection` are left to the person. It holds no secret and no machine path. |
| Generate a workspace | Given a target directory, maxstack installs T3 Code, then applies either the T3 defaults or the maxstack defaults. The target is an argument, not a fixed path. |
| Set up the harnesses | For each harness the settings select, maxstack writes the config that harness needs on this OS: plugin folders, wrappers, agent folders, and the matching T3 provider instance. A harness the settings leave out gets nothing. |
| Install the CLIs | maxstack installs T3 Code and each selected harness CLI with the OS package manager. It uses winget on Windows and a Brewfile on macOS. |
| Manage its own lifecycle | Install, update, and remove are one command with one plan. Each run converges on the same end state, so a second run changes nothing. Remove deletes only what the lock file records. Update applies a change in the settings, the layers, or the pin. |
| Snapshot T3 | maxstack reads the live T3 settings and writes a snapshot into the workspace. The snapshot excludes logins, tokens, and session history. A diff of the snapshot against the defaults is the drift report. |

The workspace rule follows from these jobs. Settings live in the workspace, not in a global folder. When a tool only reads a global file, maxstack keeps the wanted value in the repository, keeps the observed value in the workspace snapshot, and reports the difference.

### The layers

| Repository | Owns | Does not own |
| --- | --- | --- |
| `pstack-max` | The PStack plugin for every harness: skills, playbooks, hooks, and agent profiles. | The pin. maxstack holds it. |
| `simpsonm09-org-ai-plugin` | General skills, the integration registry, and the gate that enforces the catalog's agent access level. | Any value that names a person, an account, or a machine. |
| `simpsonm09-personal-ai-plugin` | The personal concretes: accounts, identities, and personal services. | A secret value. It says where a value comes from. |

PStack began as Lauren Tan's original in `cursor/plugins`. Michael Denyer ported it to Claude Code as pstack-claude, and pstack-max is our fork of that port. Changes stay in pstack-max. `chhoumann/t3-pstack` is a reference for a planned optional T3 dispatch overlay; nothing was copied from it. No pull request goes to a repository the organization does not own.

## Human tooling

`simpsonm09-dev-setup` is for the person, not the agent. It has two jobs.

- **Tooling.** It installs the tools a person uses on a machine and applies their app settings. `tools.yaml` is the one hand-edited source, and the Brewfile and the winget list render from it.
- **Secrets consumption.** It owns `settings/.env` and the wrappers that hand a secret to one command. `with-secrets [--offline] [--require NAMES] <tool>` is the human path. Agents use `with-vault --role agent <tool>`, where the tool never holds the token.

`.envrc` is retired for now. A secret reaches a command through a wrapper, not through a shell that loaded everything on entry. `settings/.env` stays, with its committed `settings/.env.example`, so the bootstrap values and the list of expected names survive. The `.env` file holds only what unlocks the secret store plus a small offline fallback, and it is never committed.

The boundary with maxstack is the harness. maxstack installs T3 Code and the harness CLIs. dev-setup installs everything else.

## Reference

The three reference repositories describe the fleet. They do not run it.

| Repository | Answers | Holds |
| --- | --- | --- |
| `simpsonm09-repo-catalog` | What is in the fleet, and what may an agent do in each repository? | The roster, the tiers, and the agent access levels. |
| `simpsonm09-repo-standard` | What is best practice, and what does "done" mean? | The per-language lint and test rules, the reusable GitHub Actions workflows, the rulesets, and the conformance checker. |
| `simpsonm09-repo-template` | What does a conforming repository look like? | A working reference implementation to start a new repository from. |

The catalog holds intent, and the standard holds checks. Each repository runs the checks against itself in its own CI. No repository audits another.

Agent access is one selectable value per repository: `propose`, `merge`, or `full`. All eight tier defaults and all 17 current fleet repositories declare `full`; `read` is an internal baseline, and deny is identity-based. The policy is not active until the resolver and plugin integration are ready. See [`policy.md`](../policy.md) and the [agent-access change note](features/agent-access.md).

## Feature

Every repository outside the three groups above is a feature repository. It consumes the standard, starts from the template, and appears in the roster. It owns no fleet rule.

| Kind | Repositories | Note |
| --- | --- | --- |
| Feature | `simpsonm09-browser-calculator`, `simpsonm09-postman-test-utils`, `simpsonm09-playwright-api-wrapper`, `simpsonm09-pokeapi-wrapper`, `simpsonm09-openclaw-homelab` | Products. |
| Fixture | `simpsonm09-fixture-nest`, `simpsonm09-fixture-go`, `simpsonm09-fixture-rust`, `simpsonm09-fixture-dotnet` | Language fixtures that validate the framework and are not products. |
| Tooling data | `simpsonm09-machine-inventory` | Read by the org layer. |
| Third-party forks | `t3code`, `cursor-plugins`, `Win-CodexBar` | Kept for reference and local patches. Outside the roster, and never a pull request target upstream. |

## Where a change goes

| The change | Repository |
| --- | --- |
| A skill, playbook, or hook that applies to any PStack user | `pstack-max` |
| A skill, registry entry, or gate rule that applies to anyone in the fleet | `simpsonm09-org-ai-plugin` |
| An account, identity, or personal service | `simpsonm09-personal-ai-plugin` |
| Layer order, the pstack pin, a harness, a T3 default, a harness CLI install | `simpsonm09-maxstack` |
| A human tool, an app setting, a secret name, a wrapper | `simpsonm09-dev-setup` |
| A lint rule, a workflow, a ruleset, the definition of done | `simpsonm09-repo-standard` |
| A new repository, a tier, an agent access level | `simpsonm09-repo-catalog` |
| What a new repository starts with | `simpsonm09-repo-template` |
| Product behavior | The feature repository |

## Gaps as of 2026-10-12

Each row is a difference between the target above and what the repositories hold today. Move a row to the owning repository's roadmap when work starts.

| Target | Today | Owner |
| --- | --- | --- |
| Seven harnesses composed | `layers.json` composes four: Claude Code, Copilot, OpenCode, and Pi. T3 Code ships provider instances for Codex, Cursor, and Antigravity. maxstack adds its own instances only for Claude, Copilot, and Pi, and writes no config for Codex, Cursor, or Antigravity. | maxstack |
| T3 defaults held in maxstack | The instances are a table in `docs/t3-setup.md` and are set by hand. | maxstack |
| T3 snapshot in the workspace | T3 settings live in the user profile. The dev-setup snapshot records only whether that folder exists. | maxstack |
| maxstack installs T3 Code and the harness CLIs | `tools.yaml` in dev-setup lists `t3-code`, `opencode`, and `claude-code`. The Brewfile also lives in dev-setup. | maxstack, dev-setup |
| Workspace generated at any target | Discovery takes `-Workspace`, then `MAXSTACK_WORKSPACE`, then a marker file, then the script layout. The legacy fixed path is the last step. It prints a warning, and the fallback is removed after one release. | maxstack |
| One settings file as the input | `maxstack.settings.json` selects runtimes and layers. Per-layer sources in the file are recorded but not applied. The T3 snapshot, the T3 defaults, and harness CLI installs are not built yet. | maxstack |
| One lifecycle command on every OS | The installer is PowerShell and declares itself Windows-only. It has `-Apply`, `-Status`, `-Remove`, `-Uninstall`, `-Update`, and `-Update -Check`. It selects runtimes and layers with `-Runtimes` and `-Layers`, and it sets layer sources with `-Source` or `-LayerSource`. The macOS wrappers are untested. | maxstack |
| Generated harness config from one source | A standalone neutral layer generator writes skills for `claude`, `copilot`, `opencode`, and `pi`, and OpenCode MCP servers for `opencode` only. The installer does not call it. Codex, Cursor, and Antigravity get nothing. Instructions, agents, and hooks are not generated yet. | maxstack |
| `.envrc` does not load secrets | A human reaches a secret only through `with-secrets [--offline] [--require NAMES] <tool>`, and agents through `with-vault --role agent`. The plugin and maxstack docs say so. A leftover workspace-root `.envrc` that imports secrets still exists and must be removed by hand. `with-secrets` warns when it finds one. dev-setup still ships `settings/.envrc.example`, which is a migration note only. | dev-setup |
| Each model path is in the ownership record | The installer writes the Pi wrappers and records them in `stack.lock.json`. It uses a Pi installed in the workspace when one exists. The local model server and its Pi provider file are not owned by maxstack's ownership record yet. | maxstack |
| The gate runs in every harness that can run a pre-tool hook | The gate runs in Claude Code, Copilot, OpenCode, and Pi only. There is no gate on Codex, Cursor, or Antigravity. See G1 in the [parity matrix](https://github.com/simpsonm09-org/simpsonm09-maxstack/blob/main/docs/parity-matrix.md). | org-ai-plugin, maxstack |
| pstack's own pre-tool checks run on every OS | The Copilot PreToolUse hook is a no-op stub on Windows for pstack's own checks, so the file-read and subagent-model checks do not run there. See G2 in the [parity matrix](https://github.com/simpsonm09-org/simpsonm09-maxstack/blob/main/docs/parity-matrix.md). | org-ai-plugin, maxstack |
| The gate fails closed on every path | The gate has paths that fail open silently. Claude allows a call when its hook is killed at the timeout, and a call runs with no gate and no error when `node` is not on the hook shell's PATH. See G3 in the [parity matrix](https://github.com/simpsonm09-org/simpsonm09-maxstack/blob/main/docs/parity-matrix.md). | org-ai-plugin, maxstack |
| The gate's live path is proven on every harness that runs it | The OpenCode gate path is not proven end to end. OpenCode rewrites a denied command and does not block it, and the rewrite is not measured live. See G4 in the [parity matrix](https://github.com/simpsonm09-org/simpsonm09-maxstack/blob/main/docs/parity-matrix.md). | org-ai-plugin, maxstack |

**Sequence.** The work runs in this order. First, per-layer sources in the settings file. Then the read-only T3 snapshot and the drift report. Then harness CLI installs, with ownership. maxstack records only the CLIs it installed, and it never removes a CLI the person installed. Then T3 apply. Then macOS. Then the generator is wired into the installer. Then agents and hooks conversion. Cursor is the first new harness.

## Open decisions

- **Where the T3 snapshot lives.** T3 Code reads its settings from the user profile. Either maxstack copies an allowlisted snapshot into the workspace, or T3 Code is pointed at a workspace folder if it supports that. The first works today.
- **How `tools.yaml` splits.** Either the harness entries move to maxstack, or maxstack reads them from dev-setup. Moving them keeps the rule that the two manifests never read each other.
- **Whether WSL keeps a loader.** Without `.envrc`, a WSL shell loads nothing on entry. The wrappers cover single commands. A long-lived server that needs a secret needs another answer.
