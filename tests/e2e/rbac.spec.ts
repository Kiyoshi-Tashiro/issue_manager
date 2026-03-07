import { test, expect } from '@playwright/test';

test.describe('Role-Based Access Control (RBAC) E2E', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Mock users API
        await page.route('**/api/users', async route => {
            const mockUsers = [
                { id: 'admin-1', displayName: '管理者', role: 'Admin' },
                { id: 'editor-1', displayName: '担当者A', role: 'Editor' },
                { id: 'editor-2', displayName: '担当者B', role: 'Editor' },
                { id: 'viewer-1', displayName: '閲覧者', role: 'Viewer' },
            ];
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockUsers),
            });
        });

        // Go to projects page
        await page.goto('/projects');

        // Wait for user selector to appear
        await expect(page.locator('label', { hasText: 'ユーザー切替:' })).toBeVisible({ timeout: 20000 });

        // Wait for Viewer load
        await expect(page.locator('.adsk-viewing-viewer').first()).toBeVisible({ timeout: 30000 });
    });

    test('Editor (担当者A) should be able to create and edit own issue, but cannot change status', async ({ page }) => {
        // Select Editor A
        const userSelect = page.locator('select#user-select');
        await userSelect.selectOption({ label: '担当者A (Editor)' });

        // Select a floor (creation is disabled for "All Floors")
        const floorSelect = page.locator('[data-testid="floor-select"]');
        await floorSelect.selectOption({ label: '1F' });
        await page.waitForTimeout(1000); // Wait for state sync

        // Trigger issue creation
        await page.waitForFunction(() => typeof (window as any).__E2E_TRIGGER_ISSUE_CREATE__ === 'function', { timeout: 15000 });
        await page.evaluate(() => {
            (window as any).__E2E_TRIGGER_ISSUE_CREATE__();
        });

        // Fill issue form
        const titleInput = page.locator('[data-testid="create-issue-title"]');
        await expect(titleInput).toBeVisible();
        const testTitle = `RBAC Test Option A ${Date.now()}`;
        await titleInput.fill(testTitle);

        // Submit
        await page.getByRole('button', { name: '作成', exact: true }).click();

        // Wait for it to appear in the list
        await expect(page.getByText(testTitle)).toBeVisible({ timeout: 15000 });

        // Click the issue to open detail modal
        await page.getByText(testTitle).click();

        // Verify modal is open
        const modal = page.locator('[data-testid="issue-detail-modal"]');
        await expect(modal).toBeVisible();

        // Assert: Title input is editable
        const detailTitleInput = page.locator('[data-testid="issue-detail-title-input"]');
        await expect(detailTitleInput).toBeEnabled();

        // Assert: Status select is DISBLED for Editor
        const statusSelect = page.locator('[data-testid="issue-detail-status-select"]');
        await expect(statusSelect).toBeDisabled();

        // Assert: Save button is enabled
        const saveBtn = page.locator('[data-testid="issue-detail-save-btn"]');
        await expect(saveBtn).toBeEnabled();

        // Close modal
        await page.locator('[data-testid="issue-detail-close-btn"]').click();
        await expect(modal).not.toBeVisible();

        // Switch to Editor B
        await userSelect.selectOption({ label: '担当者B (Editor)' });

        // Click the same issue
        await page.getByText(testTitle).click();
        await expect(modal).toBeVisible();

        // Assert: Editor B cannot save (Save button is hidden or disabled)
        await expect(detailTitleInput).toHaveValue(testTitle, { timeout: 5000 });
        await expect(saveBtn).not.toBeVisible();

        // Close modal
        await page.locator('[data-testid="issue-detail-close-btn"]').click();
    });

    test('Admin (管理者) can edit Editor A\'s issue and change its status', async ({ page }) => {
        // Select Editor A to create an issue
        const userSelect = page.locator('select#user-select');
        await userSelect.selectOption({ label: '担当者A (Editor)' });

        // Select a floor
        const floorSelect = page.locator('[data-testid="floor-select"]');
        await floorSelect.selectOption({ label: '1F' });
        await page.waitForTimeout(1000);

        // Trigger issue creation
        await page.evaluate(() => {
            (window as any).__E2E_TRIGGER_ISSUE_CREATE__();
        });

        // Fill issue form
        const titleInput = page.locator('[data-testid="create-issue-title"]');
        const testTitle = `Admin Edit Test Option ${Date.now()}`;
        await titleInput.fill(testTitle);

        // Submit
        await page.getByRole('button', { name: '作成', exact: true }).click();

        // Wait for it to appear in the list
        await expect(page.getByText(testTitle)).toBeVisible({ timeout: 15000 });

        // Now switch to Admin
        await userSelect.selectOption({ label: '管理者 (Admin)' });

        // Open the issue
        await page.getByText(testTitle).click();

        const modal = page.locator('[data-testid="issue-detail-modal"]');
        await expect(modal).toBeVisible();

        const detailTitleInput = page.locator('[data-testid="issue-detail-title-input"]');
        const statusSelect = page.locator('[data-testid="issue-detail-status-select"]');

        await expect(detailTitleInput).toHaveValue(testTitle, { timeout: 5000 });

        // Assert: Admin can edit Title
        await detailTitleInput.fill(`${testTitle} - Updated by Admin`);

        // Assert: Admin can change Status
        await expect(statusSelect).toBeEnabled();
        await statusSelect.selectOption('In Progress');

        // Assert: Save button is visible and enabled
        const saveBtn = page.locator('[data-testid="issue-detail-save-btn"]');
        await expect(saveBtn).toBeVisible();
        await expect(saveBtn).toBeEnabled();

        // Save and Verify Modal Closes
        await saveBtn.click();
        await expect(modal).not.toBeVisible({ timeout: 10000 });

        // Re-open and verify status
        await page.getByText(`${testTitle} - Updated by Admin`).click();
        await expect(modal).toBeVisible();
        await expect(statusSelect).toHaveValue('In Progress', { timeout: 5000 });
    });
});
