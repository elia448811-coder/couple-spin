import { expect, test } from '@playwright/test';

test.describe('Couple Spin smoke', () => {
  test('welcome screen loads and opens setup', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
    const start = page.getByRole('button', { name: /התחילו|התחל|בואו/i }).first();
    if (await start.count()) {
      await start.click();
      await expect(page.getByText(/וייב|התחלה מהירה|שלב/i).first()).toBeVisible();
    }
  });
});
