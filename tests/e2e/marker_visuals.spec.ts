import { test, expect } from '@playwright/test';

/**
 * マーカーの外観とホバー動作のテスト
 * 1. マーカーに不要な縁取り（アウトラインメッシュ）が存在しないこと
 * 2. 通常時の opacity が 0.5 であること
 * 3. マーカーにホバーした際、renderOrder が 100 になり、opacity が 1.0 になること
 * 4. ホバー時に大きさ（スケール）が変化しないこと
 */
test.describe('Marker Visuals and Hover', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/projects');
        await page.waitForSelector('canvas', { timeout: 30000 });

        // 1Fを選択
        const floorSelect = page.getByTestId('floor-select');
        await floorSelect.selectOption({ label: '1F' });

        // リストが表示されるまで待機
        await page.waitForSelector('[data-testid^="issue-list-item-"]', { timeout: 20000 });
    });

    test('マーカーに不要な縁取りが存在せず、ホバー時に最前面表示・不透明化され、拡大はされないこと', async ({ page }) => {
        // マーカーの情報を取得（extensionがマーカーを保持するまで待機する evaluate）
        const markerData = await page.evaluate(async () => {
            const getExt = () => {
                const viewer = (window as any).NOP_VIEWER;
                return viewer?.getExtension('Autodesk.Aps.IssueExtension');
            };

            // 最大 15秒間、マーカーが出るのを待つ
            for (let i = 0; i < 30; i++) {
                const ext = getExt();
                if (ext && ext.markers && ext.markers.size > 0) {
                    const firstMarker = Array.from(ext.markers.values())[0] as any;

                    const hasOutlines = (mesh: any) => {
                        if (mesh.children.length !== 1) return true;
                        if (mesh.children[0].children.length > 0) return true;
                        return false;
                    };

                    const viewer = (window as any).NOP_VIEWER;
                    const screenPos = viewer.worldToClient(firstMarker.position);

                    return {
                        id: firstMarker.userData.issueId,
                        x: screenPos.x,
                        y: screenPos.y,
                        initialScaleX: firstMarker.scale.x,
                        hasOutlines: hasOutlines(firstMarker),
                        initialOpacity: firstMarker.material.opacity
                    };
                }
                await new Promise(r => setTimeout(r, 500));
            }
            return null;
        });

        expect(markerData).not.toBeNull();
        if (!markerData) return;

        // 1. 縁取りがないことのアサーション
        expect(markerData.hasOutlines).toBe(false);
        // 通常時の透過度確認 (0.5)
        expect(markerData.initialOpacity).toBeCloseTo(0.5, 1);
        // 通常時のサイズ確認 (0.0005 などの極端に小さい値ではないこと)
        expect(markerData.initialScaleX).toBeGreaterThan(0.001);

        // 2. ホバー動作の検証
        await page.mouse.move(markerData.x, markerData.y);
        await page.waitForTimeout(1000);

        const hoverState = await page.evaluate((id: string) => {
            const viewer = (window as any).NOP_VIEWER;
            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension');
            const marker = ext.markers.get(id);
            return marker ? {
                scaleX: marker.scale.x,
                renderOrder: marker.renderOrder,
                opacity: marker.material.opacity
            } : null;
        }, markerData.id);

        expect(hoverState).not.toBeNull();
        if (hoverState) {
            // 3. 最前面表示、不透明化のアサーション (拡大はしない)
            expect(hoverState.renderOrder).toBe(100);
            expect(hoverState.opacity).toBeCloseTo(1.0, 1);
            expect(hoverState.scaleX).toBeCloseTo(markerData.initialScaleX, 5); // Allow very minor floating point diff
        }

        // 4. マウスを離すと元に戻ることの検証
        await page.mouse.move(0, 0);
        await page.waitForTimeout(500);

        const finalState = await page.evaluate((id: string) => {
            const viewer = (window as any).NOP_VIEWER;
            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension');
            const marker = ext.markers.get(id);
            return marker ? {
                renderOrder: marker.renderOrder,
                opacity: marker.material.opacity
            } : null;
        }, markerData.id);

        expect(finalState?.renderOrder).toBe(0);
        expect(finalState?.opacity).toBeCloseTo(0.5, 1);
    });
});
