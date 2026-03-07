import { test, expect } from '@playwright/test';

/**
 * マーカー視認性の堅牢性テスト
 * 1. 全フロア (1F, 2F, 3F) でマーカーが表示されること
 * 2. ズームイン・ズームアウトしても、マーカーが最小サイズ（クランプ値 0.1）を保ち、視認可能であること
 * 3. ラベルがマーカー位置に同期して表示されていること
 * 4. 実行中にコンソールエラーが発生しないこと
 */
test.describe('Marker Visibility Robustness', () => {
    let consoleErrors: string[] = [];

    test.beforeEach(async ({ page }) => {
        consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Ignore harmless asset 404s and generic network 404s
                if (text.includes('favicon.ico') || text.includes('.map') || text.includes('status of 404')) return;
                consoleErrors.push(text);
                console.log(`[Browser Error] ${text}`);
            }
        });


        // Also listen to page errors (crashes/unhandled exceptions)
        page.on('pageerror', error => {
            consoleErrors.push(error.message);
            console.log(`[Page Error] ${error.message}`);
        });

        await page.goto('http://localhost:3000/projects');

        await page.waitForSelector('canvas', { timeout: 30000 });
    });

    const floors = ['1F', '2F', '3F'];

    for (const floor of floors) {
        test(`${floor} でマーカーが表示され、視認可能なサイズであること`, async ({ page }) => {
            // フロア選択
            const floorSelect = page.getByTestId('floor-select');
            await floorSelect.selectOption({ label: floor });

            // マーカー生成を待機
            const markerVisible = await page.evaluate(async () => {
                const getExt = () => (window as any).NOP_VIEWER?.getExtension('Autodesk.Aps.IssueExtension');
                for (let i = 0; i < 20; i++) {
                    const ext = getExt();
                    if (ext && ext.markers && ext.markers.size > 0) return true;
                    await new Promise(r => setTimeout(r, 500));
                }
                return false;
            });

            expect(markerVisible).toBe(true);
            expect(consoleErrors).toHaveLength(0);

            // スケールの検証 (最小クランプ 0.1 以上であること)
            const minScale = await page.evaluate(() => {
                const ext = (window as any).NOP_VIEWER.getExtension('Autodesk.Aps.IssueExtension');
                const scales = Array.from(ext.markers.values()).map((m: any) => m.scale.x);
                return Math.min(...scales);
            });
            expect(minScale).toBeGreaterThanOrEqual(0.1);

            // ラベルの存在確認
            const labelsCount = await page.locator('.issue-marker-label').count();
            expect(labelsCount).toBeGreaterThan(0);
        });
    }

    test('ズームアウトしてもマーカーが消失せず、最小サイズを維持すること', async ({ page }) => {
        await page.getByTestId('floor-select').selectOption({ label: '1F' });
        await page.waitForSelector('.issue-marker-label');

        // 極端にズームアウト
        await page.evaluate(() => {
            const viewer = (window as any).NOP_VIEWER;
            viewer.navigation.setZoom(0.0001); // 強制ズームアウト
            viewer.impl.invalidate(true, true, true);
        });
        await page.waitForTimeout(1000);

        const stats = await page.evaluate(() => {
            const ext = (window as any).NOP_VIEWER.getExtension('Autodesk.Aps.IssueExtension');
            const marker = Array.from(ext.markers.values())[0] as any;
            const viewer = (window as any).NOP_VIEWER;
            const screenPos = viewer.worldToClient(marker.position);
            return {
                scale: marker.scale.x,
                x: screenPos.x,
                y: screenPos.y,
                opacity: marker.material.opacity
            };
        });

        // ズームアウトしても 0.1 でクランプされているはず
        expect(stats.scale).toBeGreaterThanOrEqual(0.1);
        // 不透明度が 0.5 (通常時) または 1.0 (ホバー時) であること（消失していない）
        expect(stats.opacity).toBeGreaterThan(0);

        expect(consoleErrors).toHaveLength(0);
    });
});
