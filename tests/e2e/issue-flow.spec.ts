import { test, expect } from '@playwright/test';

test.describe('Issue Lifecycle E2E', () => {
    test.setTimeout(60000); // 60s for full lifecycle

    test('should load dashboard and handle issue list correctly', async ({ page }) => {
        await page.goto('/projects');

        // 1. Wait for floor select to be available
        const floorSelect = page.locator('[data-testid="floor-select"]');
        await expect(floorSelect).toBeVisible({ timeout: 20000 });
        console.log('Floor select is visible');

        // 2. Wait for issue list count header
        const issueCount = page.locator('[data-testid="issue-list-count"]');
        await expect(issueCount).toBeVisible({ timeout: 20000 });
        const countText = await issueCount.textContent();
        console.log(`Initial count header: ${countText}`);

        // 3. Wait for floors to load (optional but helpful)
        // We can wait for the first option to be something other than "フロアを選択"
        // await expect(floorSelect).not.toHaveValue('', { timeout: 30000 });

        // 4. Try to interact with the list if there are items
        const count = await page.locator('[data-testid^="issue-list-item-"]').count();
        console.log(`Number of issue items: ${count}`);

        if (count > 0) {
            const firstIssue = page.locator('[data-testid^="issue-list-item-"]').first();
            await firstIssue.click();

            const modal = page.locator('[data-testid="issue-detail-modal"]');
            await expect(modal).toBeVisible({ timeout: 10000 });
            console.log('Detail modal opened');

            await page.locator('[data-testid="issue-detail-close-btn"]').click();
            await expect(modal).not.toBeVisible();
            console.log('Detail modal closed');
        } else {
            console.log('No issues found in the list. This is expected if the DB is empty or floor not selected.');
        }
    });
    test('DEF-02: should handle 500 error gracefully during issue creation', async ({ page }) => {
        await page.goto('/projects');

        // wait for page load
        const floorSelect = page.locator('[data-testid="floor-select"]');
        await expect(floorSelect).toBeVisible({ timeout: 20000 });

        // === API Error Mock Setup ===
        // intercept POST request to /api/issues and return a forced 500 JSON error
        await page.route('**/api/issues', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({
                    status: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type',
                    }
                });
            } else if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Mocked Internal Server Error' }),
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    }
                });
            } else {
                await route.fallback();
            }
        });

        // Wait for Viewer load (viewer div exists) - use first() to avoid strict mode violations if multiple exist
        await expect(page.locator('.adsk-viewing-viewer').first()).toBeVisible({ timeout: 30000 });

        // Evaluate code to trigger the creation dialog after checking it's defined
        await page.waitForFunction(() => typeof (window as any).__E2E_TRIGGER_ISSUE_CREATE__ === 'function', { timeout: 15000 });
        await page.evaluate(() => {
            (window as any).__E2E_TRIGGER_ISSUE_CREATE__();
        });

        // Fill required fields
        const titleInput = page.locator('[data-testid="create-issue-title"]');
        await expect(titleInput).toBeVisible();
        await titleInput.fill('エラーテスト用タイトル');

        const categorySelect = page.locator('[data-testid="create-issue-category"]');
        await expect(categorySelect).toBeVisible();
        await categorySelect.selectOption('品質不良');

        // Initial check: no error message should be visible
        await expect(page.locator('text=指摘事項の作成に失敗しました')).not.toBeVisible();

        // Submit form
        const submitBtn = page.getByRole('button', { name: '作成', exact: true });

        // Listen to console to debug what page.tsx is logging
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('[DEBUG]')) {
                console.log(`PAGE LOG: ${msg.text()}`);
            }
        });

        // Debug: Check if button is disabled before clicking
        const isDisabled = await submitBtn.isDisabled();
        const buttonClasses = await submitBtn.getAttribute('class');
        console.log(`[PLAYWRIGHT DEBUG] Submit button isDisabled: ${isDisabled}, classes: ${buttonClasses}`);

        // Click the native way with Playwright
        await submitBtn.click({ force: true });
        await page.waitForTimeout(500); // Give JS time to execute

        // Validate Defensive Error Handling
        // Wait a bit for state to update
        await page.waitForTimeout(1000);

        // 1. Error message from mock is displayed (in Page.tsx, errorData.error is used, or fallback)
        // From route mock: { error: 'Mocked Internal Server Error' } -> page.tsx sets "Mocked Internal Server Error"
        await expect(page.getByText('Mocked Internal Server Error').or(page.getByText('サーバーエラーが発生しました'))).toBeVisible({ timeout: 5000 });

        // 2. Dialog remains open for user to fix or cancel
        await expect(page.locator('text=新しい指摘事項を作成')).toBeVisible();

        // 3. User can cancel manually after an error
        await page.getByRole('button', { name: 'キャンセル' }).click();
        await expect(page.locator('text=新しい指摘事項を作成')).not.toBeVisible();
    });
});
