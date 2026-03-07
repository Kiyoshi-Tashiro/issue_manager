import { test, expect } from '@playwright/test';

test.describe('Interaction UI Regression', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/projects');
        // Wait for Viewer load
        await expect(page.locator('.adsk-viewing-viewer').first()).toBeVisible({ timeout: 30000 });
        // Give some time for extensions and issues to potentially load
        await page.waitForTimeout(5000);
    });

    test('should show creation dialog when clicking on the model', async ({ page }) => {
        // We use the canvas to click. Since we can't easily "hit" a dbId from Playwright without coordinates,
        // we'll use a coordinate that likely hits the model in the default view.
        // Or better, we use the global helper to simulate a click if it's available.
        // But since the BUG makes the helper unavailable, we try to use it and expect it to fail or not exist.

        const isHelperDefined = await page.evaluate(() => typeof (window as any).__E2E_TRIGGER_ISSUE_CREATE__ === 'function');
        
        // If the bug is present, this will be false, and the following test steps would fail anyway.
        // But the user wants to see the UI NOT appearing.
        
        if (isHelperDefined) {
            await page.evaluate(() => (window as any).__E2E_TRIGGER_ISSUE_CREATE__());
            await expect(page.locator('text=新しい指摘事項を作成')).toBeVisible({ timeout: 5000 });
        } else {
            // If helper is not defined, we can't even trigger it from E2E easily, 
            // confirming the "Interaction is broken" from a developer/E2E perspective.
            throw new Error('E2E helper is not defined. Interaction tool registration failed.');
        }
    });

    test('should show detail modal when clicking an existing pin', async ({ page }) => {
        // Check if issues are loaded in the list
        const firstIssueItem = page.locator('[data-testid^="issue-list-item-"]').first();
        await expect(firstIssueItem).toBeVisible({ timeout: 10000 });
        
        // Even if we click the list item, it might work, but clicking the PIN via extension is what's broken.
        // Since we can't easily click a 3D pin from Playwright without precise coords, 
        // we check if the extension is actually active and has the tool.
        
        const isToolActive = await page.evaluate(() => {
            const viewer = (window as any).NOP_VIEWER;
            if (!viewer) return false;
            return !!viewer.toolController.getTool('issueInteractionTool');
        });

        expect(isToolActive, 'Issue interaction tool is NOT active in the viewer!').toBe(true);
    });
});
