import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://convocore.ai/login');
await page.pause();

await context.storageState({ path: 'auth.json', indexedDB: true });
await browser.close();
console.log('✅ Session saved to auth.json');
