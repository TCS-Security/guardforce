# AGENTS.md — TCS Workspace Rules for AI Coding Agents

These rules apply to every AI coding agent (Claude Code, opencode, Codex, Cursor, etc.) working anywhere under this directory. A repo under `repos/` may add its own `AGENTS.md` with repo-specific commands; that file **extends** this one, and where they conflict, the repo's file wins for work inside that repo.

---

## 1. Testing — non-negotiable

**No change lands without tests. Full stop.**

Whatever you implement must be verified before the work counts as done:

1. **Test as you build, not after.** A feature is not "done" until its tests exist and pass. "Implemented, tests to follow later" is never an acceptable end state.
2. **Unit tests.** Every function, module, or behavior you add or change gets unit tests covering the happy path, edge cases, and failure modes.
3. **End-to-end flow tests.** Every user-visible or cross-component flow gets at least one e2e test that exercises the real path (real API request → response, real DB read/write, real UI/CLI interaction) — not just the internals in isolation.
4. **Zero regressions.** Before finishing any task, run the repo's **entire existing test suite**, not just the tests you wrote. If anything that passed before your change now fails, the change is not done — fix it or revert it. A green full suite is the only acceptable end state.
5. **Bug fixes ship with a regression test** — a test that fails without the fix and passes with it.
6. **Definition of done** = implementation + new tests covering it + full suite green + lint and typecheck clean.

Practical rules:

- If the repo has no test framework set up yet, stop and set one up (or ask the user) before building features on top of nothing.
- If the full suite is slow, run targeted tests while iterating — but **always** run the full suite before declaring a task done.
- Never weaken, skip, delete, or flake-mark an existing test to make your change pass. If a test's expectation is genuinely outdated, say so explicitly and get the user's approval first.
- When bootstrapping a new repo, write the first tests with the first commit, and record the exact `test`, `lint`, and `typecheck` commands in that repo's `AGENTS.md` so future agents never have to guess how to verify their work.

---

## 2. Workspace layout

This directory is a **workspace container**, not a git repo. It holds multiple independent git repositories plus shared assets:

```
TCS/
├── AGENTS.md            # shared agent rules (this file)
├── CLAUDE.md            # symlink → AGENTS.md (same rules, for Claude Code)
├── docs/                # product docs: PRDs, specs, founder notes — source of truth
├── .agents/skills/      # workspace-level agent skills (SKILL.md format)
├── .claude/skills       # symlink → .agents/skills (for Claude Code)
└── repos/               # independent git repos, one subdirectory per repo
```

- **Never `git init` at the workspace root.** Every project is its own git repo under `repos/`, with its own history, remotes, branches, and CI. Do not create commits that span multiple repos.
- **`docs/` is the product source of truth.** Read the relevant PRD/spec before implementing a feature (`prd-v2-guard-platform.md` supersedes `prd-mvp.md`; founder's notes in `guard-crm-notes.md` win over both). Update docs when product behavior or decisions change.
- **Skills** follow the standard `SKILL.md` format: `.agents/skills/<name>/SKILL.md` with `name` and `description` frontmatter. Read and follow any skill relevant to your current task.
- **When bootstrapping a new repo** under `repos/`, create its own `AGENTS.md` containing: stack, how to run locally, how to run tests, lint/typecheck commands, and repo-specific conventions.

---

## 3. General conduct

- Run lint and typecheck before declaring any task done — an agent that skips verification is not done, it is guessing.
- Never commit, push, or create PRs unless the user explicitly asks. Never commit secrets, keys, or credentials.
- Keep work scoped: one logical change per task; match the repo's existing code style and conventions over your own preferences.
- If a requested change would break an existing flow and the docs don't cover the decision, stop and ask instead of guessing.
