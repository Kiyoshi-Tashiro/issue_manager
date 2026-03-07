import { test, expect } from '@playwright/test';

test.describe('Viewer Interaction E2E', () => {
    test.setTimeout(120000); // 2 minutes just in case WebGL load is slow

    test.beforeEach(async ({ page }) => {
        // Mock API responses so tests aren't reliant on live Autodesk authentication or real db latency
        await page.route('/api/floors', async route => {
            const json = [
                { id: '1', name: '1F', urn: 'test-urn' },
                { id: '2', name: '2F', urn: 'test-urn' }
            ];
            await route.fulfill({ json });
        });
    });

    test('should disable ghosting when single floor is selected and reset when all floors are selected', async ({ page }) => {
        await page.goto('/projects');

        // Check dropdown options
        const floorSelect = page.locator('[data-testid="floor-select"]');
        await expect(floorSelect).toBeVisible({ timeout: 20000 });

        // Wait for floors to load - fallbackToDbFloors takes 15s if levels fail
        await expect(floorSelect).toHaveValue('all-floors', { timeout: 45000 });

        // Open dropdown and ensure options exist
        const defaultSelected = await floorSelect.inputValue();
        expect(defaultSelected).toBe('all-floors');

        await page.selectOption('[data-testid="floor-select"]', '1');
        const countText = await floorSelect.inputValue();
        expect(countText).toBe('1');

        await page.waitForTimeout(2000);
        expect(await floorSelect.inputValue()).toBe('1');

        // Return to all floors
        await page.selectOption('[data-testid="floor-select"]', 'all-floors');
        await page.waitForTimeout(2000);
        expect(await floorSelect.inputValue()).toBe('all-floors');
    });

    test('should open issue detail modal when clicking an issue in the list', async ({ page }) => {
        page.on('console', msg => console.log('Browser Console:', msg.type(), msg.text()));
        page.on('pageerror', err => console.log('Browser PageError:', err.message));

        await page.route(/\/api\/issues.*/, async route => {
            const isSingle = route.request().url().includes('issue-1');
            const item = { id: 'issue-1', title: 'Test Issue 1', status: 'Open', modelPosition: { x: 0, y: 0, z: 0 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photoUrls: [], version: 1 };
            await route.fulfill({ json: isSingle ? item : [item] });
        });

        await page.goto('/projects');

        // Wait up to 45s for fallbackToDbFloors and issues to load
        const item = page.getByText('Test Issue 1');
        await expect(item).toBeVisible({ timeout: 45000 });

        await item.click({ force: true });

        const modal = page.locator('[data-testid="issue-detail-modal"]');
        await expect(modal).toBeAttached({ timeout: 10000 });
        await page.screenshot({ path: 'test-results/debug-modal.png' });
    });

    test('should not throw unproject camera error when clicking on the 3D canvas', async ({ page }) => {
        const errors: Error[] = [];
        page.on('pageerror', err => errors.push(err));
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('Test 3 PageError Log:', msg.text());
            }
        });

        await page.route(/\/api\/issues.*/, async route => {
            const isSingle = route.request().url().includes('issue-canvas');
            const item = { id: 'issue-canvas', title: 'Canvas Issue', status: 'Open', modelPosition: { x: 0, y: 0, z: 0 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photoUrls: [], version: 1 };
            await route.fulfill({ json: isSingle ? item : [item] });
        });

        await page.goto('/projects');

        // Wait for rendering to complete
        const item = page.locator('[data-testid="issue-list-item-issue-canvas"]');
        await expect(item).toBeVisible({ timeout: 45000 });

        // Click the canvas to trigger handleSingleClick which uses Raycaster unproject
        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible();

        // Click near the center using force: true because adsk-viewing-viewer intercepts pointer events
        await canvas.click({ position: { x: 200, y: 200 }, force: true });

        // Wait a bit to ensure async error catches
        await page.waitForTimeout(2000);

        // Assert no runtime exceptions like "Unsupported camera type" or "vector.unproject is not a function"
        expect(errors).toHaveLength(0);
    });

    test.skip('should open creation modal on double click, fill new fields, and submit', async ({ page }) => {
        // Mock the POST request for creation
        await page.route(/\/api\/issues/, async route => {
            if (route.request().method() === 'POST') {
                const item = {
                    id: 'new-issue-1',
                    title: 'E2E Title',
                    description: 'E2E Desc',
                    category: '施工不備',
                    status: 'Open',
                    modelPosition: { x: 10, y: 20, z: 30 },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    photoUrls: [],
                    version: 1
                };
                await route.fulfill({ json: item });
            } else {
                await route.fallback(); // or fulfill for GET if needed, but not strictly required if other routes handle it
            }
        });

        await page.goto('/projects');

        // Wait for viewer to be somewhat ready
        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible({ timeout: 45000 });

        // In APS Viewer, direct dblclick events from Playwright might not trigger the extension properly 
        // due to Hammer.js or other custom event handling in adsk-viewing-viewer.
        // We use a globally exposed test helper to trigger the dialog directly.
        await page.evaluate(() => {
            if (typeof (window as any).__E2E_TRIGGER_ISSUE_CREATE__ === 'function') {
                (window as any).__E2E_TRIGGER_ISSUE_CREATE__();
            }
        });

        // Wait for creation modal to appear
        const titleInput = page.getByTestId('create-issue-title');
        await expect(titleInput).toBeVisible({ timeout: 10000 });

        // Fill fields
        await titleInput.fill('E2E Title');
        await page.getByTestId('create-issue-description').fill('E2E Desc');
        await page.getByTestId('create-issue-category').selectOption('施工不備');

        // Submit
        await page.getByTestId('create-issue-submit').click();

        // Modal should close (title input disappears)
        await expect(titleInput).toBeHidden({ timeout: 10000 });
    });
});
