# Bugs & findings to report

## 🐞 Bugs

1. **"You have unsaved changes" appears without any edits**
   - Area: Agent Dashboard (header)
   - Steps: Open any agent from the workspace. Don't change anything.
   - Expected: Header shows "Published", no unsaved-changes warning.
   - Actual: "You have unsaved changes" appears in red next to "Save & Publish".
   - Evidence: Playwright traces + manual check.

2. **`domain-to-agency` request returns 400 on every dashboard load**
   - Area: Agent Dashboard (network)
   - Method: POST, Status: 400 (preflight returns 200)
   - Reproduced in normal Chrome and in automated tests.
   - Question: is this expected, or a bug?

3. **Settings page sometimes shows empty content for more than 5 seconds**
   - Area: Agent Dashboard > Settings
   - The URL changes and the sidebar is visible, but the main content stays
     blank, with no loading indicator.

## 🌐 Console / tracking

4. **Google Ads conversion scripts are blocked by CSP**
   - `googleads.g.doubleclick.net` is not in the Content Security Policy
     `script-src`, so conversion tracking scripts are blocked.
   - Affects 2 Ads accounts (AW-17603389534, AW-16884772849).
   - Impact: marketing conversion tracking may not work.

5. **Several console errors on dashboard pages**
   - Multiple red console errors appear on agent dashboard pages (to review).

## ♿ Accessibility

6. **"AI opening" popup options have no selected state**
   - Fixed message / Design with AI / AI from prompt have no
     aria-checked / aria-selected / aria-pressed.
   - Screen readers can't tell which option is selected.
   - (Text/Voice tabs in Start Settings do use aria-pressed.)

7. **Test chat refresh button has no accessible name**
   - The refresh icon in the Test chat input area has no aria-label,
     title or text, so screen readers announce it only as "button".

8. **"Published — pick a channel to deploy" popup is not a dialog**
   - The popup has no role="dialog", so screen readers don't announce it.
   - (The "AI opening" popup does use role="dialog".)

9. **Test chat messages have no accessible role or label**
   - Area: Prompt page > Show Test (chat panel)
   - Chat messages have no role (e.g. role="log" on the list or
     role="article"/aria-label on each message) that tells whether a message
     is from the AI or from the user.
   - Impact: screen readers can't tell who sent each message, and new AI
     replies are not announced (no aria-live region).
   - Also makes automated tests rely on fragile locators to find the AI reply.

## 💡 Suggestions / UX improvements

10. **Edit should open on the current option**
    - Start Settings > AI opening message > Edit opens the options list (1/2).
    - Suggestion: open directly on the current option's step (2/2).
      Back is already available to switch type, so no flexibility is lost.

11. **Add test IDs to Test chat messages**
    - Request: add data-testid (e.g. "chat-message-ai" / "chat-message-user")
      to chat message bubbles.
    - Why: automated tests currently need long, fragile locators to find
      the AI reply and exclude the "Thought briefly" debug block.

12. **Generate is enabled with an empty description**
    - Design with AI step: Generate is clickable when Describe your UI is
      empty and no mockup is attached; it then shows an error toast
      ("Describe the opening or attach a reference image/doc").
    - Done is disabled in the same state, so behavior is inconsistent.
    - Suggestion: disable Generate until a description or file is added.