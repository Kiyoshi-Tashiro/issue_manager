import { test, expect } from '@playwright/test';

test.describe('Multiple Issue Creation on Same Element', () => {
    test.setTimeout(180000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/projects');
        await expect(page.locator('.adsk-viewing-viewer').first()).toBeVisible({ timeout: 60000 });
        await page.waitForFunction(() => typeof (window as any).__E2E_TRIGGER_ISSUE_CREATE__ === 'function', { timeout: 45000 });

        const floorSelect = page.locator('[data-testid="floor-select"]');
        await expect(floorSelect).toBeVisible();
        await floorSelect.selectOption({ label: '1F' });
        await page.waitForTimeout(3000);
    });

    test('Should allow creating multiple issues on the same element by clicking different locations', async ({ page }) => {
        // 1. Create the first issue
        const uniqueTitle1 = `Multi-Issue Test 1 ${Date.now()}`;
        await page.evaluate(() => {
            (window as any).__E2E_TRIGGER_ISSUE_CREATE__({ x: 0, y: 0, z: 0 }, 100);
        });

        await page.locator('[data-testid="create-issue-title"]').fill(uniqueTitle1);
        await page.locator('[data-testid="create-issue-submit"]').click();

        const listItem1 = page.locator(`[data-testid^="issue-list-item-"]:has-text("${uniqueTitle1}")`);
        await expect(listItem1).toBeVisible({ timeout: 20000 });
        const testId = await listItem1.getAttribute('data-testid');
        const issueId = testId?.replace('issue-list-item-', '');

        // 2. Wait for the marker to be registered in the Extension
        await page.waitForFunction((id) => {
            const viewer = (window as any).NOP_VIEWER;
            if (!viewer) return false;
            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension');
            return ext && ext.markers && ext.markers.has(id);
        }, issueId, { timeout: 30000 });

        // Check if label is visible
        const label = page.locator('.issue-marker-label').filter({ hasText: /^#\d+/ }).first();
        await expect(label).toBeVisible({ timeout: 10000 });

        // 3. Verify that clicking the pin head opens the detail modal
        await page.evaluate((id) => {
            const viewer = (window as any).NOP_VIEWER;
            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension');
            const tool = viewer.toolController.getTool('issueInteractionTool');

            const marker = ext.markers.get(id);
            const headPos = marker.userData.labelPosition.clone();
            const screenPoint = viewer.worldToClient(headPos);
            const rect = viewer.container.getBoundingClientRect();

            tool.handleSingleClick({ clientX: screenPoint.x + rect.left, clientY: screenPoint.y + rect.top }, 0);
        }, issueId);

        const detailModal = page.locator('[data-testid="issue-detail-modal"]');
        await expect(detailModal).toBeVisible({ timeout: 15000 });
        await page.locator('[data-testid="issue-detail-cancel-btn"]').click();
        await expect(detailModal).not.toBeVisible();

        // 4. Verify the FIX: Click near the tip (on the member) triggers new creation dialog
        await page.evaluate((id) => {
            const viewer = (window as any).NOP_VIEWER;
            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension');
            const tool = viewer.toolController.getTool('issueInteractionTool');

            const marker = ext.markers.get(id);
            const tipPos = marker.position.clone();
            const screenPoint = viewer.worldToClient(tipPos);
            const rect = viewer.container.getBoundingClientRect();

            tool.handleSingleClick({ clientX: screenPoint.x + rect.left, clientY: screenPoint.y + rect.top }, 0);
        }, issueId);

        const creationModal = page.locator('text=新しい指摘事項を作成');
        await expect(creationModal).toBeVisible({ timeout: 15000 });

        // Submit second issue
        const uniqueTitle2 = `Multi-Issue Test 2 ${Date.now()}`;
        await page.locator('[data-testid="create-issue-title"]').fill(uniqueTitle2);
        await page.locator('[data-testid="create-issue-submit"]').click();

        // Verify both issues now exist
        await expect(page.locator(`[data-testid^="issue-list-item-"]:has-text("${uniqueTitle1}")`)).toBeVisible({ timeout: 20000 });
        await expect(page.locator(`[data-testid^="issue-list-item-"]:has-text("${uniqueTitle2}")`)).toBeVisible({ timeout: 20000 });
    });
});
