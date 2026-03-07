import { test, expect } from '@playwright/test';

test.describe('Floor-based Interaction Restrictions', () => {
    test.beforeEach(async ({ page }) => {
        // プロジェクト画面へ遷移
        await page.goto('http://localhost:3000/projects');

        // ビューアーのロードを待機 (IssueExtension が登録されるまで)
        await page.waitForFunction(() => (window as any).__E2E_TRIGGER_ISSUE_CREATE__ !== undefined, { timeout: 30000 });
    });

    test('Should show alert and NOT open dialog when "All Floors" is selected', async ({ page }) => {
        // デフォルトで「全フロア表示」が選択されていることを確認
        const floorSelect = page.locator('select').first();
        await expect(floorSelect).toHaveValue('all-floors');

        // カスタムヘルパー経由で作成を試行 (Canvasクリックを模倣)
        await page.evaluate(() => {
            (window as any).__E2E_TRIGGER_ISSUE_CREATE__();
        });

        // 警告メッセージ（トースト通知）を確認
        const toast = page.locator('[data-testid="notification-toast"]');
        await expect(toast).toBeVisible({ timeout: 5000 });
        await expect(toast).toContainText('特定フロアを表示してから、再度クリックしてください');

        // 作成ダイアログが表示されていないことを確認
        const dialog = page.locator('text=新しい指摘事項を作成');
        await expect(dialog).not.toBeVisible();
    });

    test('Should allow opening dialog when a specific floor is selected', async ({ page }) => {
        // フロア「2F」を選択 (シードデータ/モデルデータに依存するため、存在するのを待つ)
        const floorSelect = page.locator('select').first();
        await floorSelect.waitFor({ state: 'visible' });

        // 「2F」という名前のオプションを探して選択
        await floorSelect.selectOption({ label: '2F' });

        // 作成を試行
        await page.evaluate(() => {
            (window as any).__E2E_TRIGGER_ISSUE_CREATE__();
        });

        // 作成ダイアログが表示されることを確認
        const dialog = page.locator('text=新しい指摘事項を作成');
        await expect(dialog).toBeVisible();
    });
});
