import { test, expect } from '@playwright/test';

test.describe('Comprehensive Floor Filtering', () => {
    test.setTimeout(120000); // Further increase timeout for stability

    test.beforeEach(async ({ page }) => {
        await page.goto('/projects');
        await expect(page.locator('.adsk-viewing-viewer').first()).toBeVisible({ timeout: 45000 });
        // Wait for helper to be registered (this ensures extension is loaded and initialized)
        await page.waitForFunction(() => typeof (window as any).__E2E_TRIGGER_ISSUE_CREATE__ === 'function', { timeout: 60000 });
    });

    test('Should isolate issues by floor and sync with viewer', async ({ page }) => {
        const floorSelect = page.locator('[data-testid="floor-select"]');
        await floorSelect.waitFor({ state: 'visible' });
        // Wait for options to be populated
        await page.waitForFunction((select) => (select as HTMLSelectElement).options.length > 1, await floorSelect.elementHandle());

        // Debug log available options
        const options = await floorSelect.evaluate((select: HTMLSelectElement) =>
            Array.from(select.options).map(o => o.label)
        );
        console.log(`[DEBUG TEST] Available floors: ${JSON.stringify(options)}`);

        // 1. Create an issue on 1F
        if (!options.includes('1F')) throw new Error(`"1F" not found in ${JSON.stringify(options)}`);
        await floorSelect.selectOption({ label: '1F' });
        await page.waitForTimeout(2000);

        const title1F = `1F Issue ${Date.now()}`;
        await page.evaluate(() => (window as any).__E2E_TRIGGER_ISSUE_CREATE__());
        await expect(page.locator('text=新しい指摘事項を作成')).toBeVisible({ timeout: 15000 });

        const titleInput = page.locator('[data-testid="create-issue-title"]');
        await titleInput.waitFor({ state: 'visible', timeout: 15000 });
        await titleInput.fill(title1F);

        await page.locator('[data-testid="create-issue-category"]').selectOption({ label: '品質不良' });
        await page.locator('[data-testid="create-issue-submit"]').click();
        await expect(page.getByText(title1F)).toBeVisible({ timeout: 20000 });

        // 2. Create an issue on 2F
        if (!options.includes('2F')) throw new Error(`"2F" not found in ${JSON.stringify(options)}`);
        await floorSelect.selectOption({ label: '2F' });
        await page.waitForTimeout(2000);

        const title2F = `2F Issue ${Date.now()}`;
        await page.evaluate(() => (window as any).__E2E_TRIGGER_ISSUE_CREATE__());
        await expect(page.locator('text=新しい指摘事項を作成')).toBeVisible({ timeout: 15000 });

        const titleInput2 = page.locator('[data-testid="create-issue-title"]');
        await titleInput2.waitFor({ state: 'visible', timeout: 15000 });
        await titleInput2.fill(title2F);

        await page.locator('[data-testid="create-issue-category"]').selectOption({ label: '安全不備' });
        await page.locator('[data-testid="create-issue-submit"]').click();
        await expect(page.getByText(title2F)).toBeVisible({ timeout: 20000 });

        // 3. Verify Isolation
        await floorSelect.selectOption({ label: '1F' });
        await page.waitForTimeout(2500);
        await expect(page.getByText(title1F)).toBeVisible();
        await expect(page.getByText(title2F)).not.toBeVisible();

        await floorSelect.selectOption({ label: '2F' });
        await page.waitForTimeout(2500);
        await expect(page.getByText(title2F)).toBeVisible();
        await expect(page.getByText(title1F)).not.toBeVisible();

        await floorSelect.selectOption({ value: 'all-floors' });
        await page.waitForTimeout(2500);
        await expect(page.getByText(title1F)).toBeVisible();
        await expect(page.getByText(title2F)).toBeVisible();

        // 4. Verify Pin visibility
        const markers = page.locator('.issue-marker-label');
        await expect(markers.first()).toBeVisible({ timeout: 15000 });
    });
});
