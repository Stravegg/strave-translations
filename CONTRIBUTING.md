# Contributing translations

## Hard rules (CI enforces these)

- Never edit `locales/en/` — English is generated from the app source.
- Keep every ICU placeholder exactly as written in the `msgid`:
  - `{name}`, `{count}`, `{0}` — variable slots. Keep the braces and the name.
  - `<0>…</0>`, `<1>…</1>` — formatting tags (links, bold, …). Keep the tags
    paired and keep their content translated inside them.
  - Plurals: `{count, plural, one {…} other {…}}` — keep the syntax; German
    uses `one` and `other`.
- Don't translate placeholders' contents when they are data: team names,
  event names, and usernames arrive at runtime.

## Style

- German: informal du-Form, wie in Gaming-Communities üblich.
- Keep UI strings short — buttons and labels have little space.
- Terminology: see [glossary.md](./glossary.md). When in doubt, keep the
  English term (Siege slang is largely untranslated in the community).

## Machine-translated entries

Entries marked `#. machine-translated (codex) — review welcome` were
pre-filled by an LLM. They are live in the app until a human improves them.
When you review one:

1. Fix the translation if needed.
2. Delete the `#. machine-translated …` comment line.

## Workflow

- Small fixes: edit the PO file directly in the GitHub UI and open a PR.
- Bigger sessions: any PO editor works (Poedit, Lokalize, or a plain text
  editor).
- CI runs on every PR: PO syntax, placeholder integrity, English-catalog
  protection, and docs frontmatter checks.
