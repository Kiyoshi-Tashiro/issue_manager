import { test, expect } from '@playwright/test';

test.describe('Unified Floor Filtering Bug Fix', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/projects');
        // ヘルパーが登録されるまで待つ（Viewer準備完了の目安）
        await page.waitForFunction(() => (window as any).__E2E_TRIGGER_ISSUE_CREATE__ !== undefined, { timeout: 30000 });
    });

    test('Issues #1 and #4 should ONLY show on 2F or All Floors', async ({ page }) => {
        const floorSelect = page.locator('select').first();

        // 1. 「全フロア表示」時は #1 と #4 がリストにあることを確認
        await floorSelect.selectOption({ value: 'all-floors' });
        await expect(page.locator('text=#1 ')).toBeVisible();
        await expect(page.locator('text=#4 ')).toBeVisible();

        // 2. 「1F」に切り替えた時、#1 と #4 がリストから消えることを確認
        // (1F という名前のオプションがある前提。なければ存在する別のフロア ID)
        const option1F = await page.locator('select option:has-text("1F")').getAttribute('value');
        if (option1F) {
            await floorSelect.selectOption({ value: option1F });
            await expect(page.locator('text=#1 ')).not.toBeVisible();
            await expect(page.locator('text=#4 ')).not.toBeVisible();
            await expect(page.locator('text=表示する指摘事項がありません。')).toBeVisible();
        }

        // 3. 「2F」に切り替えた時、#1 と #4 が再表示されることを確認
        const option2F = await page.locator('select option:has-text("2F")').getAttribute('value');
        if (option2F) {
            await floorSelect.selectOption({ value: option2F });
            await expect(page.locator('text=#1 ')).toBeVisible();
            await expect(page.locator('text=#4 ')).toBeVisible();
            // #2 や #3 (all-floors 設定のもの) は2Fでは非表示のはず
            await expect(page.locator('text=#2 ')).not.toBeVisible();
        }
    });
});
