import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Track Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analyze');
  });

  test('should display analysis interface', async ({ page }) => {
    // Check for file upload area
    await expect(page.getByRole('heading', { name: 'Upload GPX Files' })).toBeVisible();
  });

  test('should upload and analyze 270 degree wind track', async ({ page }) => {
    test.setTimeout(180000); // 3 minute timeout for larger file

    // Wait for analyze button area to be ready (indicates page is loaded)
    await expect(page.getByRole('heading', { name: 'Upload GPX Files' })).toBeVisible({ timeout: 15000 });

    // Find file input and upload test file
    const fileInput = page.locator('input[type="file"]');
    const testFile = path.join(__dirname, '../../../backend/data/test_file_270_degrees.gpx');
    await fileInput.setInputFiles(testFile);

    // Wait for file to appear in list
    await expect(page.getByText('test_file_270_degrees.gpx')).toBeVisible({ timeout: 15000 });

    // Click analyze and wait for results
    await page.getByRole('button', { name: /Analyze All Files/i }).click();

    // Wait for Analysis Results - give plenty of time for large file
    await expect(page.getByRole('heading', { name: 'Analysis Results' })).toBeVisible({ timeout: 120000 });
  });

  test('should upload and analyze 90 degree wind track', async ({ page }) => {
    test.setTimeout(90000);

    // Wait for page to be ready
    await expect(page.getByRole('heading', { name: 'Upload GPX Files' })).toBeVisible({ timeout: 15000 });

    // Upload test file
    const fileInput = page.locator('input[type="file"]');
    const testFile = path.join(__dirname, '../../../backend/data/3m_rocket_18kn_90degrees.gpx');
    await fileInput.setInputFiles(testFile);

    // Wait for file to appear and click analyze
    await expect(page.getByText('3m_rocket_18kn_90degrees.gpx')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Analyze All Files/i }).click();

    // Wait for Analysis Results
    await expect(page.getByRole('heading', { name: 'Analysis Results' })).toBeVisible({ timeout: 60000 });
  });

  test('should handle multiple file uploads', async ({ page }) => {
    test.setTimeout(60000);

    // Wait for page to be ready
    await expect(page.getByRole('heading', { name: 'Upload GPX Files' })).toBeVisible({ timeout: 15000 });

    // Upload both files at once
    const fileInput = page.locator('input[type="file"]');
    const testFile1 = path.join(__dirname, '../../../backend/data/test_file_270_degrees.gpx');
    const testFile2 = path.join(__dirname, '../../../backend/data/3m_rocket_18kn_90degrees.gpx');
    await fileInput.setInputFiles([testFile1, testFile2]);

    // Both files should appear in the list
    await expect(page.getByText('test_file_270_degrees.gpx')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('3m_rocket_18kn_90degrees.gpx')).toBeVisible({ timeout: 15000 });

    // Analyze button should be visible
    await expect(page.getByRole('button', { name: /Analyze All Files/i })).toBeVisible();
  });
});
