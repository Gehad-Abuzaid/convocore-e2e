import { test, expect, type Page } from '@playwright/test';

const AGENT_ID = '1FOifPWa034oAWhWQ5p3';
const AGENT_URL = `/app/na/agents/${AGENT_ID}/nodes`;

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

async function openAgentDashboard(page: Page) {
  await page.goto(AGENT_URL, { waitUntil: 'domcontentloaded' });
  await waitForLoadingDone(page);
  await dismissBlockingUi(page);
  await expect(page.getByRole('button', { name: 'Back to Agents' })).toBeVisible({ timeout: 30_000 });
}

async function goToSidebarPage(
  page: Page,
  item:
    | 'Prompt'
    | 'Voice'
    | 'Widget'
    | 'Chats'
    | 'Analytics'
    | 'Knowledge'
    | 'Channels'
    | 'Leads'
    | 'Simulator'
    | 'Settings',
) {
  await dismissBlockingUi(page);
  await page.getByRole('link', { name: item, exact: true }).click();
  await waitForLoadingDone(page);
  await dismissBlockingUi(page);
}

async function assertNoErrorState(page: Page) {
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
}

test.describe('agent dashboard smoke', () => {
  test.beforeEach(async ({ page }) => {
    const mcpPopup = page.getByRole('dialog', { name: 'Try Convocore MCP' });
    await page.addLocatorHandler(mcpPopup, async (dialog) => {
      await dialog.getByRole('button', { name: 'Close' }).click();
    });
  });

  test('Prompt', async ({ page }) => {
    await openAgentDashboard(page);
    await goToSidebarPage(page, 'Prompt');

    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_ID}/nodes`));
    await expect(page.getByText('Start Settings', { exact: true })).toBeVisible();
    await expect(page.getByText('Who speaks first in chat?', { exact: true })).toBeVisible();
    await expect(page.getByText('LLM', { exact: true })).toBeVisible();
    await expect(page.getByText('Instructions', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add tool' })).toBeVisible();
    await expect(page.getByText('Knowledge base', { exact: true })).toBeVisible();
    await expect(page.getByText('UI Tools', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Language' })).toBeVisible();
    await assertNoErrorState(page);
  });

  test('Voice', async ({ page }) => {
    await openAgentDashboard(page);
    await goToSidebarPage(page, 'Voice');

    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_ID}/voice`));
    await expect(page.getByText('Voice Setup')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voice Library' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Speech Gen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Phone Numbers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Explore All Voices' })).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Enter text to generate voice samples...' }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search by name or ID...' })).toBeVisible();
    await assertNoErrorState(page);
  });

  test('Widget', async ({ page }) => {
    await openAgentDashboard(page);
    await goToSidebarPage(page, 'Widget');

    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_ID}/overview`));
    await expect(page.getByText('Agent title and description')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Customer Support Title' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Your virtual ai assistant Description' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Widget Code & Configuration/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Logo, header and background images/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Font, Theme & Colors/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Tabs Configuration/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Privacy & Legal/ })).toBeVisible();
    await assertNoErrorState(page);
  });

  test('Chats', async ({ page }) => {
    await openAgentDashboard(page);
    await goToSidebarPage(page, 'Chats');

    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_ID}/convos`));
    await expect(page.getByRole('button', { name: 'Active' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resolved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archived' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Web Chat' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Custom Tag' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Enter metric value' })).toBeVisible();
    await expect(page.getByText('Conversations', { exact: true })).toBeVisible();
    await assertNoErrorState(page);
  });

  test('Analytics', async ({ page }) => {
    await openAgentDashboard(page);
    await goToSidebarPage(page, 'Analytics');

    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_ID}/analytics`));
    await expect(page.getByRole('tab', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Topics' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Custom Metrics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview Metrics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Resolve CSAT' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chat ratings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'User Engagement' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Geographic Distribution' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conversation Metrics' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Metric' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh Analytics' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset Time Range' })).toBeVisible();
    await assertNoErrorState(page);
  });

  test('Knowledge', async ({ page }) => {
    await openAgentDashboard(page);
    await goToSidebarPage(page, 'Knowledge');

    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_ID}/kb`));
    await expect(page.getByRole('heading', { name: 'Select a document' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings & Tags' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview KB' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search documents...' })).toBeVisible();
    await assertNoErrorState(page);
  });

  test('Channels', async ({ page }) => {
    await openAgentDashboard(page);
    await goToSidebarPage(page, 'Channels');

    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_ID}/channels`));
    await expect(page.getByRole('heading', { name: 'WhatsApp' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Instagram' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Messenger' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Discord' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Telegram' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Google Business Chat' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SMS' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Channel Settings' })).toBeVisible();
    await assertNoErrorState(page);
  });

  test('Leads', async ({ page }) => {
    await openAgentDashboard(page);
    await goToSidebarPage(page, 'Leads');

    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_ID}/leads`));
    await expect(page.getByRole('tab', { name: 'Leads' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Campaigns' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search & filters' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Columns' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Contact' })).toBeVisible();
    await assertNoErrorState(page);
  });

  test('AI Suggestions (Soon)', async ({ page }) => {
    await openAgentDashboard(page);

    const link = page.getByRole('link', { name: 'AI Suggestions (Soon)', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveCSS('pointer-events', 'none');
  });

  test('Simulator', async ({ page }) => {
    await openAgentDashboard(page);
    await goToSidebarPage(page, 'Simulator');

    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_ID}/tester`));
    await expect(page.getByText('Test Mode', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Select test configuration/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test Scenarios' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Conversation Length/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Auto-Trigger Tests' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Test History/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Test' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Logs/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Analysis' })).toBeVisible();
    await assertNoErrorState(page);
  });

  test('Settings', async ({ page }) => {
    await openAgentDashboard(page);
    await goToSidebarPage(page, 'Settings');

    await expect(page).toHaveURL(new RegExp(`/agents/${AGENT_ID}/settings`));
   await expect(page.getByText('Web Widget Settings', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('Configure your web widget settings and behavior', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Core Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'User Interface' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Language & Comms' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Security & Limits' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Handoff & Support' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Technical Config' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analytics & Monitoring' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Advanced' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Integrations' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Enable Agent' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'AI Introduction Message' })).toBeVisible();
    await assertNoErrorState(page);
  });
});
