# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Playwright (TypeScript) end-to-end tests against the **live production** Convocore app at `https://convocore.ai` (set as `baseURL`). There is no app source here and no local server; tests drive real agents in a real QA account (`Gehad_QA`), so tests that click "Save & Publish" change real agent config.

## Commands

No npm scripts are defined; use `npx playwright` directly. The user runs tests themselves; don't run them unless asked (see Working rules).

```sh
npx playwright test                                        # all tests (chromium only)
npx playwright test tests/agent-dashboard-smoke.spec.ts    # one file
npx playwright test tests/<file> --list                    # list tests (check the count after big edits)
npx playwright test -g "TC11"                              # one test by title
npx playwright test --headed                               # watch it run
npx playwright show-report                                 # open HTML report
npx playwright show-trace test-results/<dir>/trace.zip     # traces kept on failure
```

## Authentication

Every test runs with `storageState: 'auth.json'` (gitignored, includes IndexedDB). To create or refresh it:

```sh
node save-auth.mjs   # opens a browser at /login; log in, then resume the Playwright inspector
```

If tests suddenly land on a sign-in page, the session expired: re-run `save-auth.mjs`. Because `auth.json` isn't committed, the GitHub Actions workflow (`.github/workflows/playwright.yml`) has no session unless one is provided separately.

`workers: 1` is deliberate: parallel browsers sharing one session snapshot are flaky.

## Recording helpers

- `record.mjs` opens the QA Recording Agent's Prompt page with the saved session and pauses, for recording locators with the Playwright inspector.
- `recordings.txt` is a scratch file of raw recorded snippets per test case (TCxx). It's input for writing specs, not runnable code.
- `Bugs.md` collects findings made while writing tests, under the sections **Bugs**, **Console/tracking**, **Accessibility**, **Suggestions**. Add new findings there rather than working around them silently.

## Test architecture

- **Test agents** are hardcoded by ID, region `na`:
  - `agent-dashboard-smoke.spec.ts` uses the QA Test Agent (`1FOifPWa034oAWhWQ5p3`). It's read-only: it visits each sidebar page and checks key elements are visible.
  - `prompt-start-settings-text.spec.ts` uses the QA Functional Agent (`yjcqF4irAPsWuhhOlWsW`). It tests Prompt > Start Settings > Text (who speaks first, AI opening message modes: Fixed message, AI from prompt, Design with AI).
- **Popups get in the way.** The app shows tours (`.driver-popover`), a "Try Convocore MCP" dialog, a "System Prompt" dialog, and "Skip & Never Show Again" prompts. Each spec has a `dismissBlockingUi(page)` helper and/or a `page.addLocatorHandler` for the MCP dialog; call it after navigation. Wait for `getByRole('status', { name: 'Loading' })` to be hidden before asserting.
- Helpers are **duplicated per spec file** (no shared fixtures or page objects yet). Keep them in sync if you change one.
- **State-changing tests start from and return to the baseline** (see "Baseline and restore" below). `restoreOpeningMode(page)` resets AI starts + "AI from prompt" and publishes only if something changed. Functional specs run `mode: 'serial'` and must not depend on starting state (see commit "Make TC03 independent of initial state"). `saveAndPublish` also closes the optional "Published — pick a channel to deploy" popup.
- Some panels have no accessible structure (test chat, design preview, instructions editor). `testChat`, `designPreview` and `instructionsCard` find the innermost `div` that contains two known elements: `locator('div').filter({ has: A }).filter({ has: B }).last()`.
- Test titles use a `TCxx - description` convention that matches `recordings.txt` and the commit messages.

## Working rules

### Agents

- **QA Functional Agent** (`yjcqF4irAPsWuhhOlWsW`) is used only by automation.
- **QA Recording Agent** ("QA recording", `6PNqdDZlvxUazeAeCBwF`) is used by the user for manual recordings. Tests must never touch it.
- **QA Test Agent** (`1FOifPWa034oAWhWQ5p3`) is for read-only smoke tests.

### Baseline and restore

- Baseline of the QA Functional Agent: **Text** tab, **AI starts**, AI opening **"AI from prompt"**, Instructions = `BASELINE_INSTRUCTIONS`.
- Never read the "original" value from the page to restore it (it once captured hidden CSS). Restore to the known baseline constants.
- Every test that saves must first check its starting state and fix it, then restore in `try`/`finally`. Close the test chat ("Hide Test") before restoring.
- Always save with `saveAndPublish` (it closes the "Published — pick a channel" popup).

### Locators

- Prefer `getByRole` / `getByText` with `{ exact: true }`. No CSS classes.
- Scope to the block (Start Settings card, AI opening dialog, Instructions card, `testChat`). The page repeats names like Text/Voice.
- Keep locators short. No long nested `hasNot` / XPath chains.
- For AI replies, use a regex that matches only the token, e.g. `^\W*TOKEN\W*$`, inside `testChat`, to skip the "Thought briefly" block.
- Use unique tokens (`QA-${Date.now()}`) to verify saves and AI replies.

### Workflow

- Do **not** run tests unless the user asks. They run them themselves.
- Exploration scripts: max 60s, no `page.pause()`, only on the QA Functional Agent; delete them afterwards.
- Never click Delete, Convert to Canvas view, AI Assist, or anything in Tools / Channels / Settings unless asked.
- Don't remove or rename existing tests. After big edits, tell the user to run `npx playwright test <file> --list` to check the test count.
- Record findings in `Bugs.md` (sections: Bugs, Console/tracking, Accessibility, Suggestions).
