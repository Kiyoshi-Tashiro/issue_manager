import { test, expect } from '@playwright/test';

test.describe('Additional UI Requirements Verification', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/projects');
        await expect(page.locator('.adsk-viewing-viewer').first()).toBeVisible({ timeout: 30000 });
        // Wait for helper to be registered
        await page.waitForFunction(() => typeof (window as any).__E2E_TRIGGER_ISSUE_CREATE__ === 'function', { timeout: 45000 });
        // Wait for Floor Select to be populated
        const floorSelect = page.locator('[data-testid="floor-select"]');
        await expect(floorSelect).toBeVisible();
    });

    test('REQ-47/60: Cancel buttons should close modals without saving', async ({ page }) => {
        const floorSelect = page.locator('[data-testid="floor-select"]');
        await floorSelect.selectOption({ label: '1F' });
        await page.waitForTimeout(1000);

        // 1. Test Creation Modal Cancel
        await page.evaluate(() => {
            (window as any).__E2E_TRIGGER_ISSUE_CREATE__();
        });
        const creationModal = page.locator('text=新しい指摘事項を作成');
        await expect(creationModal).toBeVisible();
        await page.locator('[data-testid="create-issue-cancel"]').click();
        await expect(creationModal).not.toBeVisible();

        // 2. Test Detail Modal Cancel
        // Wait for issues to load
        await page.waitForTimeout(2000);
        const firstIssue = page.locator('[data-testid^="issue-list-item-"]').first();
        if (await firstIssue.isVisible()) {
            await firstIssue.click();
            const detailModal = page.locator('[data-testid="issue-detail-modal"]');
            await expect(detailModal).toBeVisible();
            await page.locator('[data-testid="issue-detail-cancel-btn"]').click();
            await expect(detailModal).not.toBeVisible();
        }
    });

    test('REQ-54/58: Creation validation (Title and Category required)', async ({ page }) => {
        const floorSelect = page.locator('[data-testid="floor-select"]');
        await floorSelect.selectOption({ label: '1F' });
        await page.waitForTimeout(1000);

        await page.evaluate(() => {
            (window as any).__E2E_TRIGGER_ISSUE_CREATE__();
        });

        const dialog = page.locator('text=新しい指摘事項を作成');
        await expect(dialog).toBeVisible({ timeout: 10000 });

        const submitBtn = page.locator('[data-testid="create-issue-submit"]');
        await submitBtn.waitFor({ state: 'visible' });

        // Initial state: disabled (title is empty in helper)
        const titleVal = await page.locator('[data-testid="create-issue-title"]').inputValue();
        console.log(`[DEBUG] Initial Title value: "${titleVal}"`);
        const isBtnDisabled = await submitBtn.isDisabled();
        console.log(`[DEBUG] Is Submit Button disabled: ${isBtnDisabled}`);

        await expect(submitBtn).toBeDisabled();

        // Fill Title -> enabled (category defaults to '品質不良')
        await page.locator('[data-testid="create-issue-title"]').fill('Validation Test');
        await expect(submitBtn).toBeEnabled();

        // Clear title -> disabled again
        await page.locator('[data-testid="create-issue-title"]').fill('');
        await expect(submitBtn).toBeDisabled();
    });

    test('REQ-??: UI should display Floor and Category correctly in list and detail', async ({ page }) => {
        const floorSelect = page.locator('[data-testid="floor-select"]');
        await floorSelect.selectOption({ label: '1F' });
        await page.waitForTimeout(1000);

        // Create a new issue with specific data
        const uniqueTitle = `UI Display Test ${Date.now()}`;
        await page.evaluate(() => {
            (window as any).__E2E_TRIGGER_ISSUE_CREATE__();
        });
        await page.locator('[data-testid="create-issue-title"]').fill(uniqueTitle);
        await page.locator('[data-testid="create-issue-category"]').selectOption({ label: '安全不備' });
        await page.locator('[data-testid="create-issue-submit"]').click();

        // Wait for item in list
        const listItem = page.locator(`[data-testid^="issue-list-item-"]:has-text("${uniqueTitle}")`);
        await expect(listItem).toBeVisible({ timeout: 10000 });

        // Check if Floor "1F" and Category "安全不備" are visible in the list item
        await expect(listItem).toContainText('1F');
        await expect(listItem).toContainText('安全不備');

        // Open Detail Modal
        await listItem.click();
        const detailModal = page.locator('[data-testid="issue-detail-modal"]');
        await expect(detailModal).toBeVisible();

        // Check display labels in Detail Modal
        await expect(detailModal).toContainText('1F');
        await expect(detailModal).toContainText('安全不備');
    });
});
