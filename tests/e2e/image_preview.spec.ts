import { test, expect } from '@playwright/test';

/**
 * 画像プレビュー機能のテスト
 * 1. 新規作成ダイアログで画像を選択した際、プレビューが表示されること
 * 2. 詳細ビューで画像を選択した際、プレビューが表示されること
 */
test.describe('Image Preview functionality', () => {
    test.beforeEach(async ({ page }) => {
        // プロジェクトページへ移動
        await page.goto('http://localhost:3000/projects');
        // ビューワーの読み込み待ち（canvas要素の出現を確認）
        await page.waitForSelector('canvas', { timeout: 30000 });
    });

    test('新規作成ダイアログで画像選択時にプレビューが表示されること', async ({ page }) => {
        // フロアを選択
        const floorSelect = page.getByTestId('floor-select');
        await floorSelect.selectOption({ label: '1F' });

        // グローバルヘルパーを使用して作成ダイアログを表示
        await page.evaluate(() => {
            if (typeof (window as any).__E2E_TRIGGER_ISSUE_CREATE__ === 'function') {
                (window as any).__E2E_TRIGGER_ISSUE_CREATE__({ x: 0, y: 0, z: 0 }, 1);
            }
        });

        // ダイアログが出現するのを待機
        await expect(page.locator('h2', { hasText: '新しい指摘事項を作成' })).toBeVisible();

        // 画像ファイルを選択
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test-preview.png',
            mimeType: 'image/png',
            buffer: Buffer.from('fake-image-content-creation'),
        });

        // プレビューコンテナが表示されることを確認
        const preview = page.getByTestId('new-photo-preview').first();
        await expect(preview).toBeVisible();

        // imgタグが存在し、Blob URLが設定されていることを確認
        const img = preview.locator('img');
        await expect(img).toBeVisible();
        const src = await img.getAttribute('src');
        expect(src).toMatch(/^blob:/);
    });

    test('詳細ビューで画像追加時にプレビューが表示されること', async ({ page }) => {
        // リストが表示されるまで待機（全フロアだと表示されない場合があるので1Fを選択）
        const floorSelect = page.getByTestId('floor-select');
        await floorSelect.selectOption({ label: '1F' });

        // リストが表示されない場合は1つ作成する
        const listItem = page.locator('[data-testid^="issue-list-item-"]');
        if (await listItem.count() === 0) {
            await page.evaluate(() => {
                (window as any).__E2E_TRIGGER_ISSUE_CREATE__({ x: 0, y: 0, z: 0 }, 1);
            });
            await page.getByTestId('create-issue-title').fill('Test Issue for Preview');
            await page.getByTestId('create-issue-submit').click();
            await expect(listItem.first()).toBeVisible({ timeout: 15000 });
        }

        // 指摘事項をクリックして詳細を開く
        await listItem.first().click();

        // 詳細モーダルが表示されるのを待機（data-testidがあればそちらを優先したいが、h2で待機）
        const detailHeader = page.locator('h2:has-text("項目詳細"), h2:has-text("詳細")').first();
        await expect(detailHeader).toBeVisible({ timeout: 15000 });

        // 画像ファイルを選択
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'test-preview-detail.png',
            mimeType: 'image/png',
            buffer: Buffer.from('fake-image-content-detail'),
        });

        // プレビューコンテナが表示されることを確認
        const preview = page.getByTestId('new-photo-preview').first();
        await expect(preview).toBeVisible();

        // imgタグが存在し、Blob URLが設定されていることを確認
        const img = preview.locator('img');
        await expect(img).toBeVisible();
        const src = await img.getAttribute('src');
        expect(src).toMatch(/^blob:/);

        // プレビューの削除ボタンが動作することを確認
        await preview.locator('button').click();
        await expect(preview).not.toBeVisible();
    });
});
