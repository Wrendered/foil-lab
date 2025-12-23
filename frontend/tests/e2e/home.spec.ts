import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the home page with title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Foil Lab');
  });

  test('should have start analysis button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Start Analysis')).toBeVisible();
  });

  test('should navigate to analysis page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Start Analysis');
    await expect(page).toHaveURL('/analyze');
  });
});
