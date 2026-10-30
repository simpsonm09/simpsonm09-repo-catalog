# Agent access policy change

Date: 2026-10-24

This catalog change declares `full` as the default for all eight tiers and the effective
level for all 17 current fleet repositories. The four previous fixture overrides are
removed. `propose`, `merge`, and `full` are the selectable levels; `read` remains an
internal baseline and is not a catalog grant.

`propose` covers branch and pull request management and issue creation. `merge` adds
normal pull request merges. Those levels require one human review. A repository
administrator may bypass only that approval requirement; required checks and signed
commits remain separate hard rules. `full` includes milestone and administrative
actions and uses GitHub's native checks-only merge path without an agent App bypass.
`@simpsonm09` CODEOWNER approval is optional at `full`.
At `full`, this checks-only approval rule also applies when a pull request changes CI workflows, security scans, or permission rules; no human-review exception applies.

The three existing ignored repositories `The_Gaming_Index_Video_Game_Database_Final_Capstone`,
`pdf_field_automation_acrobat`, and `steam_wishlist_cleanup` each name both
`simpsonm09/<repository>` and `simpsonm09-org/<repository>` in `agentAccessIgnore`.
Identity matching is case-insensitive and checks the complete owner/repository pair.
The other ignore entries are unchanged and inventory-only.

This is reviewed source data, not activation. Merge it only after the resolver and plugin
integration are ready. The offline unit tests validate catalog policy shape. The live
organization roster check remains in `scripts/validate.mjs` and was not run for this
change. No live rollout, universal deny sandbox, or guarantee of zero secrets or personal
information is claimed.
