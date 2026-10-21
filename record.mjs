import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ storageState: 'auth.json' });
const page = await context.newPage();

await page.goto('https://convocore.ai/app/na/agents/yjcqF4irAPsWuhhOlWsW/nodes');

await page.pause();

await browser.close();