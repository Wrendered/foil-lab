# Foil Lab Testing Guide

## Overview

This guide covers setting up and running end-to-end tests with Playwright.

## Setup

### 1. Install Playwright

```bash
cd frontend
npm install --save-dev @playwright/test
npx playwright install chromium
```

### 2. Create Playwright Config

Create `frontend/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cd ../backend && source venv/bin/activate && python run_api.py',
      port: 8000,
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: true,
    },
  ],
});
```

### 3. Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:report": "playwright show-report",
    "playwright:install": "playwright install chromium"
  }
}
```

## Writing Tests

### Directory Structure

```
frontend/
├── tests/
│   └── e2e/
│       ├── home.spec.ts
│       ├── analysis.spec.ts
│       └── upload.spec.ts
└── playwright.config.ts
```

### Example Test: Home Page

```typescript
// tests/e2e/home.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Foil Lab');
  });

  test('should navigate to analysis page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Start Analysis');
    await expect(page).toHaveURL('/analyze');
  });
});
```

### Example Test: Track Analysis

```typescript
// tests/e2e/analysis.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Track Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analyze');
  });

  test('should display analysis interface', async ({ page }) => {
    await expect(page.locator('text=Upload GPX')).toBeVisible();
  });

  test('should upload and analyze GPX file', async ({ page }) => {
    test.setTimeout(60000); // Allow time for analysis

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.join(__dirname, '../../backend/data/test_file_270_degrees.gpx')
    );

    // Wait for analysis to complete
    await expect(page.locator('text=Wind Direction')).toBeVisible({ timeout: 30000 });

    // Verify results displayed
    await expect(page.locator('text=VMG')).toBeVisible();
  });
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run with UI (interactive mode)
npm run test:ui

# Run specific test file
npx playwright test tests/e2e/home.spec.ts

# View HTML report after tests
npm run test:report
```

## Common Patterns

### Waiting for API Responses

```typescript
test('analysis with timeout', async ({ page }) => {
  test.setTimeout(90000); // Extend timeout for slow operations

  // ... perform action ...

  await expect(page.locator('.results')).toBeVisible({ timeout: 60000 });
});
```

### Checking Loading States

```typescript
// Verify loading indicator appears
await expect(page.locator('text=Analyzing...')).toBeVisible();

// Wait for it to disappear
await expect(page.locator('text=Analyzing...')).not.toBeVisible({ timeout: 30000 });
```

### File Upload

```typescript
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles('/path/to/file.gpx');
```

## CI/CD Integration

For GitHub Actions, add `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install backend dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Install frontend dependencies
        run: |
          cd frontend
          npm ci

      - name: Install Playwright
        run: |
          cd frontend
          npx playwright install chromium

      - name: Run tests
        run: |
          cd frontend
          npm test
```

## Debugging Tips

1. **Use headed mode** for debugging:
   ```bash
   npx playwright test --headed
   ```

2. **Pause execution** in tests:
   ```typescript
   await page.pause();
   ```

3. **View traces** on failure:
   - Traces are saved automatically on first retry
   - Open with: `npx playwright show-trace trace.zip`

4. **Screenshot on specific step**:
   ```typescript
   await page.screenshot({ path: 'debug.png' });
   ```
