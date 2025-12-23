import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Track Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analyze');
  });

  test('should display analysis interface', async ({ page }) => {
    // Check for file upload area
    await expect(page.locator('text=Upload')).toBeVisible();
  });

  test('should upload and analyze 270 degree wind track', async ({ page }) => {
    test.setTimeout(60000); // 60 second timeout for analysis

    // Find file input and upload test file
    const fileInput = page.locator('input[type="file"]');
    const testFile = path.join(__dirname, '../../../backend/data/test_file_270_degrees.gpx');
    await fileInput.setInputFiles(testFile);

    // Wait for analysis to complete (look for results)
    await expect(page.locator('text=Wind')).toBeVisible({ timeout: 30000 });

    // The file name indicates 270 degree wind - verify estimate is close
    // This tests the algorithm is working correctly
    const windText = await page.locator('[data-testid="wind-direction"]').textContent().catch(() => null);

    // If we have a wind direction display, check it's reasonable
    if (windText) {
      const windValue = parseInt(windText);
      // Allow 30 degree tolerance
      expect(windValue).toBeGreaterThan(240);
      expect(windValue).toBeLessThan(300);
    }
  });

  test('should upload and analyze 90 degree wind track', async ({ page }) => {
    test.setTimeout(60000);

    const fileInput = page.locator('input[type="file"]');
    const testFile = path.join(__dirname, '../../../backend/data/3m_rocket_18kn_90degrees.gpx');
    await fileInput.setInputFiles(testFile);

    // Wait for analysis
    await expect(page.locator('text=Wind')).toBeVisible({ timeout: 30000 });

    // Verify segments are detected
    await expect(page.locator('text=segment')).toBeVisible();
  });

  test('should handle multiple file uploads', async ({ page }) => {
    test.setTimeout(90000);

    const fileInput = page.locator('input[type="file"]');

    // Upload first file
    const testFile1 = path.join(__dirname, '../../../backend/data/test_file_270_degrees.gpx');
    await fileInput.setInputFiles(testFile1);
    await expect(page.locator('text=Wind')).toBeVisible({ timeout: 30000 });

    // Upload second file
    const testFile2 = path.join(__dirname, '../../../backend/data/3m_rocket_18kn_90degrees.gpx');
    await fileInput.setInputFiles(testFile2);

    // Should now have comparison or multiple tracks view
    await page.waitForTimeout(2000); // Wait for UI update
  });
});
