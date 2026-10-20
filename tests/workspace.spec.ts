import { test, expect } from '@playwright/test';

test.describe('workspace', () => {
  test.describe.configure({ mode: 'serial' });

  test('logged-in user lands on workspace', async ({ page }) => {
    await page.goto('/app/na/agents');

    await expect(page.getByRole('status', { name: 'Loading' })).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.getByRole('textbox', { name: 'Search agents' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/app\/na\/agents/);
    await expect(page.getByText('Sign in', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'avatar' }).click();
    await expect(page.getByText('Gehad_QA')).toBeVisible({ timeout: 10_000 });
  });
});
