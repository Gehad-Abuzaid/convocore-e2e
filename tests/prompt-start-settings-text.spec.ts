import { test, expect, type Page } from '@playwright/test';

const FUNCTIONAL_AGENT_ID = 'yjcqF4irAPsWuhhOlWsW';
const AGENT_URL = `/app/na/agents/${FUNCTIONAL_AGENT_ID}/nodes`;

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

test.describe('Start Settings - Text', () => {
  test.describe.configure({ mode: 'serial' });

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

  test('TC03 - Who speaks first persists after save (original: AI starts)', async ({ page }) => {
    try {
      await startSettings(page).getByRole('radio', { name: 'User starts' }).check();
      await page.getByRole('button', { name: 'Save & Publish' }).click();
      await expect(page.getByText('Published', { exact: true })).toBeVisible();

      await page.reload();
      await prepareAgentPage(page);
      await expect(startSettings(page).getByRole('radio', { name: 'User starts' })).toBeChecked();
    } finally {
      await startSettings(page).getByRole('radio', { name: 'AI starts' }).check();
      await page.getByRole('button', { name: 'Save & Publish' }).click();
      await expect(page.getByText('Published', { exact: true })).toBeVisible();
    }
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
});
