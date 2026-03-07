import { test, expect } from '@playwright/test';

test.describe('Requirements Verification: Interactions', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/projects');
        // Wait for Viewer load
        await expect(page.locator('.adsk-viewing-viewer').first()).toBeVisible({ timeout: 30000 });
    });

    test('REQ-26: Clicking a pin should display the issue detail view', async ({ page }) => {
        // Wait for at least one pin label to be visible
        const pinLabel = page.locator('.issue-marker-label').first();
        await expect(pinLabel).toBeVisible({ timeout: 20000 });

        // Get coordinates of the pin
        const box = await pinLabel.boundingBox();
        if (!box) throw new Error('Could not find pin bounding box');

        // Click at the center of the pin label 
        // Note: pointer-events is none on the label, so it clicks the canvas behind it
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

        // Expect detail modal to appear
        const modal = page.locator('[data-testid="issue-detail-modal"]');
        await expect(modal, 'Issue detail modal should appear when clicking a pin').toBeVisible({ timeout: 10000 });
    });

    test('REQ-27: Clicking a component (member) should display the issue creation view', async ({ page }) => {
        // Wait for the viewer canvas
        const canvas = page.locator('.adsk-viewing-viewer canvas').first();
        await expect(canvas).toBeVisible();

        // Click in the middle of the viewer area (likely hitting some part of the model)
        const box = await canvas.boundingBox();
        if (!box) throw new Error('Could not find canvas bounding box');

        // We click a bit offset from center to avoid icons/overlays if any
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

        // Expect creation dialog to appear
        const dialog = page.locator('text=新しい指摘事項を作成');
        await expect(dialog, 'Issue creation dialog should appear when clicking a model component').toBeVisible({ timeout: 10000 });
    });
});
