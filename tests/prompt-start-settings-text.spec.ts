import { test, expect, type Page } from '@playwright/test';

const FUNCTIONAL_AGENT_ID = 'yjcqF4irAPsWuhhOlWsW';
const AGENT_URL = `/app/na/agents/${FUNCTIONAL_AGENT_ID}/nodes`;
const BASELINE_INSTRUCTIONS =
  'Greet the user warmly and tell him that you are ready to help him.';

async function dismissBlockingUi(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip & Never Show Again' });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  }

  const tour = page.locator('.driver-popover');
  if (await tour.isVisible().catch(() => false)) {
    await tour.getByRole('button', { name: 'Skip & Never Show Again' }).click({ timeout: 2_000 }).catch(() => {});
    await tour.getByRole('button', { name: 'Close' }).click({ timeout: 2_000 }).catch(() => {});
    await tour.getByRole('button', { name: 'Done' }).click({ timeout: 2_000 }).catch(() => {});
  }

  const mcp = page.getByRole('dialog', { name: 'Try Convocore MCP' });
  if (await mcp.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Dismiss' }).click({ force: true, timeout: 2_000 });
  }

  const systemPrompt = page.getByRole('dialog', { name: 'System Prompt' });
  if (await systemPrompt.isVisible().catch(() => false)) {
    await systemPrompt.getByRole('button', { name: 'Skip & Never Show Again' }).click({ timeout: 2_000 }).catch(() => {});
    await systemPrompt.getByRole('button', { name: 'Close' }).click({ timeout: 2_000 }).catch(() => {});
  }
}

async function waitForLoadingDone(page: Page) {
  await expect(page.getByRole('status', { name: 'Loading' })).toBeHidden({ timeout: 30_000 });
}

function startSettings(page: Page) {
  return page.locator('section').filter({
    has: page.getByText('Start Settings', { exact: true }),
  });
}

function textTab(page: Page) {
  const card = startSettings(page);
  return card
    .getByRole('button', { name: 'Text', exact: true, pressed: true })
    .or(card.getByRole('button', { name: 'Text', exact: true, pressed: false }));
}

async function ensureTextTabSelected(page: Page) {
  const tab = textTab(page);
  await expect(tab).toBeVisible({ timeout: 30_000 });
  if ((await tab.getAttribute('aria-pressed')) !== 'true') {
    await tab.click();
  }
  await expect(tab).toHaveAttribute('aria-pressed', 'true');
}

async function prepareAgentPage(page: Page) {
  await waitForLoadingDone(page);
  await dismissBlockingUi(page);
  await expect(page.getByRole('button', { name: 'Back to Agents' })).toBeVisible({ timeout: 30_000 });
  await ensureTextTabSelected(page);
}

function openingPopup(page: Page) {
  return page.getByRole('dialog').filter({
    has: page.getByText('AI opening · Text'),
  });
}

// The matching divs are nested, and .last() is the innermost one.
function testChat(page: Page) {
  return page
    .locator('div')
    .filter({ has: page.getByText('Your virtual assistant.', { exact: true }) })
    .filter({ has: page.getByText('Message', { exact: true }) })
    .last();
}

function designPreview(page: Page) {
  return page
    .locator('div')
    .filter({ has: page.getByText('Design studio · tweak & accept', { exact: true }) })
    .filter({ has: page.getByText('Live chat preview', { exact: true }) })
    .last();
}

async function readOpeningSummary(page: Page) {
  const edit = startSettings(page).getByRole('button', { name: 'Edit' });
  await expect(edit).toBeVisible();
  return edit.evaluate((button) => {
    const label = [...button.querySelectorAll('*')].find((el) => {
      const own = [...el.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      return own === 'AI opening message';
    });
    const lines = (label?.parentElement?.parentElement?.innerText ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line !== 'AI opening message' && line !== 'Edit');
    return lines[0] ?? '';
  });
}

async function saveAndPublish(page: Page) {
  await page.getByRole('button', { name: 'Save & Publish' }).click();
  // Publishing can be slow: the button shows "Loading Save & Publish" until the server responds.
  await expect(page.getByText('Published', { exact: true })).toBeVisible({ timeout: 30_000 });

  const deployHeading = page.getByRole('heading', {
    name: 'Published — pick a channel to deploy',
    exact: true,
  });
  const shown = await deployHeading
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!shown) return;

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(deployHeading).toBeHidden();
}

// Restores the baseline: AI starts, AI opening "AI from prompt".
async function restoreOpeningMode(page: Page) {
  if (page.isClosed()) return;

  try {
    const hide = page.getByRole('button', { name: 'Hide Test' });
    if (await hide.isVisible().catch(() => false)) {
      await hide.click();
      await expect(hide).toBeHidden();
    }

    let changed = false;
    const aiStarts = startSettings(page).getByRole('radio', { name: 'AI starts' });
    if (!(await aiStarts.isChecked())) {
      await aiStarts.check();
      changed = true;
    }

    if (!isAiFromPrompt(await readOpeningSummary(page))) {
      const popup = openingPopup(page);
      await startSettings(page).getByRole('button', { name: 'Edit' }).click();
      await popup.getByText('AI from prompt', { exact: true }).click();
      await popup.getByRole('button', { name: 'Next' }).click();
      await popup.getByRole('button', { name: 'Done' }).click();
      changed = true;
    }

    if (changed) await saveAndPublish(page);
  } catch (error) {
    if (page.isClosed()) return;
    throw error;
  }
}

function isAiFromPrompt(summary: string) {
  return /ai-generated from prompt|ai from prompt/i.test(summary);
}

function instructionsCard(page: Page) {
  return page
    .locator('div')
    .filter({ has: page.getByRole('button', { name: 'Enter fullscreen' }) })
    .filter({ has: page.getByRole('button', { name: 'AI Assist', exact: true }) })
    .last();
}

async function setInstructions(page: Page, text: string) {
  const card = instructionsCard(page);
  await card.getByText('Instructions', { exact: true }).click();
  const editor = card.locator('[contenteditable="true"]');
  await editor.waitFor({ state: 'visible' });
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(text);
  expect((await editor.innerText()).trim()).toBe(text);
}

async function testChatHasHistory(page: Page) {
  if (await testChat(page).getByText('Thought briefly', { exact: true }).isVisible().catch(() => false)) {
    return true;
  }
  const extra = (await testChat(page).innerText())
    .replace(/QA Functional Agent/g, '')
    .replace(/Your virtual assistant\./g, '')
    .replace(/Hide Test/g, '')
    .replace(/Message/g, '')
    .replace(/\s+/g, '')
    .trim();
  return extra.length > 0;
}

test.describe('Start Settings - Text', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto(AGENT_URL, { waitUntil: 'domcontentloaded' });
    await prepareAgentPage(page);
  });

  test('TC01 - User starts', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'User starts' }).check();
    await expect(page.getByText('The AI stays silent at the start')).toBeVisible();
    await expect(startSettings(page).getByText('AI opening message', { exact: true })).toBeHidden();
  });

  test('TC02 - AI starts', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await expect(startSettings(page).getByText('AI opening message', { exact: true })).toBeVisible();
    await expect(startSettings(page).getByRole('button', { name: 'Edit' })).toBeVisible();
  });

  test('TC03 - Who speaks first persists after save', async ({ page }) => {
    // beforeEach + save + reload + restore: page loads alone can take ~75s.
    test.setTimeout(120_000);

    try {
      // Start from the saved baseline (AI starts) so the switch is a real change.
      await restoreOpeningMode(page);

      await startSettings(page).getByRole('radio', { name: 'User starts' }).check();
      await saveAndPublish(page);

      await page.reload();
      await prepareAgentPage(page);
      await expect(startSettings(page).getByRole('radio', { name: 'User starts' })).toBeChecked();
    } finally {
      await restoreOpeningMode(page);
    }
  });

  test('TC05 - Edit opens the options popup', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    const popup = openingPopup(page);

    await expect(popup.getByText('AI opening · Text · 1/2')).toBeVisible();
    await expect(popup.getByText('Fixed message', { exact: true })).toBeVisible();
    await expect(popup.getByText('Design with AI', { exact: true })).toBeVisible();
    await expect(popup.getByText('AI from prompt', { exact: true })).toBeVisible();
    // The selected option has no accessible state (see Bugs.md #6), so it is not asserted.

    await page.keyboard.press('Escape');
  });

  test('TC06 - Next then Back keeps the selected option', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByText('AI opening · Text · 1/2')).toBeVisible();

    await page.getByText('Fixed message', { exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('AI opening · Text · 2/2')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('AI opening · Text · 1/2')).toBeVisible();
    await page.getByText('Who speaks first in chat?').click();
    // "Fixed message" stays selected after Back, but the option button has no
    // aria-checked, aria-selected, or aria-pressed. Selection is only a CSS
    // class, so there is no accessible state to assert.
  });

  test('TC07 - Closing the popup without Done doesn\'t change the setting', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await expect(page.getByText('AI-generated from prompt')).toBeVisible();

    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    await page.getByText('Fixed message', { exact: true }).click();

    // close the popup by clicking outside it
    await page.getByText('Who speaks first in chat?').click();

    await expect(page.getByText('AI opening · Text · 1/2')).toBeHidden();
    await expect(page.getByText('AI-generated from prompt')).toBeVisible();
  });

  test('TC07b - Escape closes the popup without changing the setting', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await expect(page.getByText('AI-generated from prompt')).toBeVisible();

    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    await page.getByText('Fixed message', { exact: true }).click();

    await page.keyboard.press('Escape');

    await expect(page.getByText('AI opening · Text · 1/2')).toBeHidden();
    await expect(page.getByText('AI-generated from prompt')).toBeVisible();
  });

  test('TC08 - Fixed message: Next opens the message input', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    const popup = openingPopup(page);
    await popup.getByText('Fixed message', { exact: true }).click();
    await popup.getByRole('button', { name: 'Next' }).click();

    await expect(popup.getByText('AI opening · Text · 2/2')).toBeVisible();
    await expect(popup.getByText('Write the fixed opening message.')).toBeVisible();
    await expect(popup.getByRole('textbox')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('TC09 - Empty message: Done is disabled', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    const popup = openingPopup(page);
    await popup.getByText('Fixed message', { exact: true }).click();
    await popup.getByRole('button', { name: 'Next' }).click();

    await expect(popup.getByRole('button', { name: 'Done' })).toBeDisabled();
    await page.keyboard.press('Escape');
  });

  test('TC10 - Spaces only: Done is disabled', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    const popup = openingPopup(page);
    await popup.getByText('Fixed message', { exact: true }).click();
    await popup.getByRole('button', { name: 'Next' }).click();

    await popup.getByRole('textbox').fill('     ');
    await expect(popup.getByRole('button', { name: 'Done' })).toBeDisabled();
    await page.keyboard.press('Escape');
  });

  test('TC11 - Fixed message is saved and shown in the summary', async ({ page }) => {
    // beforeEach + save + reload + restore: page loads alone can take ~75s.
    test.setTimeout(120_000);
    const message = `QA fixed ${Date.now()}`;

    try {
      // Start from the saved baseline (AI starts, AI from prompt).
      await restoreOpeningMode(page);

      await startSettings(page).getByRole('button', { name: 'Edit' }).click();
      const popup = openingPopup(page);
      await popup.getByText('Fixed message', { exact: true }).click();
      await popup.getByRole('button', { name: 'Next' }).click();
      await popup.getByRole('textbox').fill(message);
      await expect(popup.getByRole('button', { name: 'Done' })).toBeEnabled();
      await popup.getByRole('button', { name: 'Done' }).click();

      await expect(startSettings(page).getByText(message, { exact: true })).toBeVisible();

      await saveAndPublish(page);

      await page.reload();
      await prepareAgentPage(page);
      await expect(startSettings(page).getByText(message, { exact: true })).toBeVisible();
    } finally {
      await restoreOpeningMode(page);
    }
  });

  test('TC12 - Test chat starts with the exact fixed message', async ({ page }) => {
    // beforeEach + save + test chat reply (up to 30s) + restore.
    test.setTimeout(120_000);
    const message = `QA fixed ${Date.now()}`;

    try {
      // Start from the saved baseline (AI starts, AI from prompt).
      await restoreOpeningMode(page);

      await startSettings(page).getByRole('button', { name: 'Edit' }).click();
      const popup = openingPopup(page);
      await popup.getByText('Fixed message', { exact: true }).click();
      await popup.getByRole('button', { name: 'Next' }).click();
      await popup.getByRole('textbox').fill(message);
      await popup.getByRole('button', { name: 'Done' }).click();
      await saveAndPublish(page);

      await page.getByRole('button', { name: 'Show Test' }).click();
      // No accessible name on this button (see Bugs.md #7). Replace with getByRole when fixed.
      await testChat(page).locator('button').filter({
        has: page.locator('svg.vg-footer-reload--icon'),
      }).click();
      await page.getByRole('button', { name: 'Refresh the Conversation' }).click();

    await expect(testChat(page).getByText(message, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    } finally {
      await restoreOpeningMode(page);
    }
  });

  test('TC13 - AI from prompt: Next shows the cache note', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    const popup = openingPopup(page);
    await popup.getByText('AI from prompt', { exact: true }).click();
    await popup.getByRole('button', { name: 'Next' }).click();

    await expect(popup.getByText('AI opening · Text · 2/2')).toBeVisible();
    await expect(popup.getByText('Always cached', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup.getByText('AI opening · Text · 2/2')).toBeHidden();
  });

  test('TC14 - AI from prompt is saved and shown in the summary', async ({ page }) => {
    test.setTimeout(120_000);

    try {
      await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();

      if (isAiFromPrompt(await readOpeningSummary(page))) {
        const message = `QA fixed ${Date.now()}`;
        await startSettings(page).getByRole('button', { name: 'Edit' }).click();
        const popup = openingPopup(page);
        await popup.getByText('Fixed message', { exact: true }).click();
        await popup.getByRole('button', { name: 'Next' }).click();
        await popup.getByRole('textbox').fill(message);
        await popup.getByRole('button', { name: 'Done' }).click();
        await saveAndPublish(page);
      }

      const popup = openingPopup(page);
      await startSettings(page).getByRole('button', { name: 'Edit' }).click();
      await popup.getByText('AI from prompt', { exact: true }).click();
      await popup.getByRole('button', { name: 'Next' }).click();
      await popup.getByRole('button', { name: 'Done' }).click();

      await expect(startSettings(page).getByText('AI-generated from prompt')).toBeVisible();
      await saveAndPublish(page);

      await page.reload();
      await prepareAgentPage(page);
      await expect(startSettings(page).getByText('AI-generated from prompt')).toBeVisible();
    } finally {
      await restoreOpeningMode(page);
    }
  });

  test('TC15 - Instructions opening line is used in the test chat', async ({ page }) => {
    test.setTimeout(120_000);
    const token = `QA-${Date.now()}`;

    try {
      await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();

      if (!isAiFromPrompt(await readOpeningSummary(page))) {
        const popup = openingPopup(page);
        await startSettings(page).getByRole('button', { name: 'Edit' }).click();
        await popup.getByText('AI from prompt', { exact: true }).click();
        await popup.getByRole('button', { name: 'Next' }).click();
        await popup.getByRole('button', { name: 'Done' }).click();
      }

      await setInstructions(page, `Always start by saying "${token}".`);
      await saveAndPublish(page);

      await page.getByRole('button', { name: 'Show Test' }).click();
      if (await testChatHasHistory(page)) {
        // No accessible name on this button (see Bugs.md #7). Replace with getByRole when fixed.
        await testChat(page).locator('button').filter({
          has: page.locator('svg.vg-footer-reload--icon'),
        }).click();
        const confirm = page.getByRole('button', { name: 'Refresh the Conversation' });
        const appeared = await confirm
          .waitFor({ state: 'visible', timeout: 3_000 })
          .then(() => true)
          .catch(() => false);
        if (appeared) await confirm.click();
      }

      await expect(
        testChat(page).getByText(new RegExp(`^\\W*${token}\\W*$`))
      ).toBeVisible({ timeout: 60_000 });
    } finally {
      let instructionsError: unknown;
      if (!page.isClosed()) {
        try {
          const hide = page.getByRole('button', { name: 'Hide Test' });
          if (await hide.isVisible().catch(() => false)) await hide.click();
          await setInstructions(page, BASELINE_INSTRUCTIONS);
          await saveAndPublish(page);
          await expect(
            instructionsCard(page).getByText(BASELINE_INSTRUCTIONS, { exact: true }),
          ).toBeVisible();
        } catch (error) {
          instructionsError = error;
        }
      }
      await restoreOpeningMode(page);
      if (instructionsError && !page.isClosed()) throw instructionsError;
    }
  });

  test('TC16 - Design with AI: Next shows the design step', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    const popup = openingPopup(page);
    await popup.getByText('Design with AI', { exact: true }).click();
    await popup.getByRole('button', { name: 'Next' }).click();

    await expect(popup.getByText('AI opening · Text · 2/2')).toBeVisible();
    await expect(popup.getByText('Stream speed', { exact: true })).toBeVisible();
    await expect(popup.getByText('Describe your UI', { exact: true })).toBeVisible();
    await expect(popup.getByText('Drag & drop, or')).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Generate' })).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Done' })).toBeDisabled();

    await page.keyboard.press('Escape');
  });

  test('TC17 - Generate with empty description shows an error and uses no credits', async ({ page }) => {
    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    const popup = openingPopup(page);
    await popup.getByText('Design with AI', { exact: true }).click();
    await popup.getByRole('button', { name: 'Next' }).click();

    await popup.getByRole('button', { name: 'Generate' }).click();

    await expect(
      page.getByText('Describe the opening or attach a reference image/doc'),
    ).toBeVisible();
    await expect(page.getByText('Design studio · tweak & accept')).toBeHidden();
    await expect(page.getByText(/credits used/)).toBeHidden();

    await page.keyboard.press('Escape');
  });

  test('TC18 - Description is kept after Back and Next', async ({ page }) => {
    const description = 'A welcome card with a Book QA demo button.';

    await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
    await startSettings(page).getByRole('button', { name: 'Edit' }).click();
    const popup = openingPopup(page);
    await popup.getByText('Design with AI', { exact: true }).click();
    await popup.getByRole('button', { name: 'Next' }).click();

    await popup.getByPlaceholder(/Welcome card with logo/).fill(description);

    await popup.getByRole('button', { name: 'Back' }).click();
    await expect(popup.getByText('AI opening · Text · 1/2')).toBeVisible();
    await popup.getByRole('button', { name: 'Next' }).click();

    await expect(popup.getByPlaceholder(/Welcome card with logo/)).toHaveValue(description);

    await page.keyboard.press('Escape');
  });

  test('TC19 - Design with AI full flow: generate, accept, save, show in chat', async ({ page }) => {
    test.setTimeout(180_000);
    const token = `QA-${Date.now()}`;

    try {
      // Start from the saved baseline (AI starts, AI from prompt).
      await restoreOpeningMode(page);

      await startSettings(page).getByRole('button', { name: 'Edit' }).click();
      const popup = openingPopup(page);
      await popup.getByText('Design with AI', { exact: true }).click();
      await popup.getByRole('button', { name: 'Next' }).click();
      await popup.getByPlaceholder(/Welcome card with logo/).fill(
        `A welcome card with the title "${token}" and one button labeled "Book QA demo".`,
      );
      await popup.getByRole('button', { name: 'Generate' }).click();

      await expect(page.getByText(/Opening updated · [\d.]+ credits used/)).toBeVisible({
        timeout: 60_000,
      });

      const preview = designPreview(page);
      await expect(page.getByText('Design studio · tweak & accept')).toBeVisible();
      await expect(preview.getByText(token, { exact: true })).toBeVisible();
      await expect(preview.getByRole('button', { name: 'Book QA demo' })).toBeVisible();

      await page.getByRole('button', { name: 'Accept' }).click();
      await expect(startSettings(page).getByText(/Designed UI · \d+ blocks/)).toBeVisible();

      await saveAndPublish(page);

      await page.reload();
      await prepareAgentPage(page);
      await expect(startSettings(page).getByText(/Designed UI · \d+ blocks/)).toBeVisible();

      await page.getByRole('button', { name: 'Show Test' }).click();
      if (await testChatHasHistory(page)) {
        // No accessible name on this button (see Bugs.md #7). Replace with getByRole when fixed.
        await testChat(page).locator('button').filter({
          has: page.locator('svg.vg-footer-reload--icon'),
        }).click();
        const confirm = page.getByRole('button', { name: 'Refresh the Conversation' });
        const appeared = await confirm
          .waitFor({ state: 'visible', timeout: 3_000 })
          .then(() => true)
          .catch(() => false);
        if (appeared) await confirm.click();
      }

      await expect(testChat(page).getByText(token, { exact: true })).toBeVisible({
        timeout: 60_000,
      });
      await expect(testChat(page).getByRole('button', { name: 'Book QA demo' })).toBeVisible();
    } finally {
      await restoreOpeningMode(page);
    }
  });
});

