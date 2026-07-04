# Strave Translations

Community translations for [Strave](https://strave.gg), the Rainbow Six Siege
tournament platform. This repo is mounted into the main app as a git
submodule; every merged PR here ships with the next app deploy.

## How it works

- English is the source language. It lives inline in the app code and is
  extracted automatically into `locales/en/messages.po` — **never edit the
  English catalog here** (CI rejects it).
- Every other locale has a `locales/<locale>/messages.po` file in gettext PO
  format. Each entry pairs the English source (`msgid`) with its translation
  (`msgstr`).
- New and changed strings are pre-filled by machine translation and marked
  with a `#. machine-translated (codex) — review welcome` comment. Reviewing
  one means fixing the wording if needed and deleting that comment line.
- Docs translations live under `docs/<locale>/`, mirroring the app's English
  docs tree as full MDX files.

## Contributing

1. Pick untranslated (`msgstr ""`) or machine-translated entries in your
   locale's `messages.po`.
2. Translate, keeping every placeholder exactly as in the source — see
   [CONTRIBUTING.md](./CONTRIBUTING.md) for the rules and
   [glossary.md](./glossary.md) for terminology.
3. Open a PR. CI validates the file format and placeholders automatically.

## Adding a new language

Open an issue first. Adding a locale also needs a small change in the app
(locale list + routing), so we coordinate the rollout.
