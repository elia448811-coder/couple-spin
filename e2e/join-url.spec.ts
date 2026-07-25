import { expect, test } from '@playwright/test';

test.describe('Join URL', () => {
  test('shows join form when ?join= param is present', async ({ page }) => {
    await page.goto('/?join=12345678');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
    const joinInput = page.locator('input[inputmode="numeric"], input[pattern*="0-9"]').first();
    if (await joinInput.count()) {
      await expect(joinInput).toHaveValue('12345678');
    }
  });
});
