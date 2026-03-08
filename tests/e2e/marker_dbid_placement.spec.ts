import { test, expect } from '@playwright/test';

/**
 * dbId に基づくマーカー配置の検証テスト
 * 1. 初期表示時（フロア選択前）にマーカーが自動的に配置されること
 * 2. dbId を持つ指摘事項が、オブジェクトの重心位置に配置されること
 * 3. dbId を持たない指摘事項が、modelPosition の位置に配置されること
 */
test.describe('Marker dbId Placement', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/projects');
        // Canvasの出現だけでなく、Viewerの初期化とモデルのロード完了まで待機する
        await page.waitForSelector('canvas', { timeout: 30000 });
        await page.waitForFunction(() => {
            const viewer = (window as any).NOP_VIEWER;
            return viewer && viewer.model && viewer.isLoadDone && viewer.isLoadDone();
        }, { timeout: 60000 });
    });

    test('初期表示時に dbId を持つマーカーが自動的に配置されること', async ({ page }) => {
        // フロア選択は行わず、モデルロード完了を待つ (beforeEachで待ち済み)
        // さらに、Extensionが内部で再適用するのをわずかに待つ
        await page.waitForTimeout(3000);

        const result = await page.evaluate(async () => {
            console.log('[E2E-DEBUG] Checking initial markers');
            const viewer = (window as any).NOP_VIEWER;
            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension');

            // シードデータ（dbId 20865 など）が配置されているか確認
            const markers = ext.markers;
            console.log('[E2E-DEBUG] Initial markers count:', markers.size);

            if (markers.size === 0) return { error: '初期表示でマーカーが1つも見つかりません' };

            const markerArray = Array.from(markers.values() as any[]);
            // 座標が 0,0,0 でないマーカーを探す（dbId解決に成功していれば座標が入っている）
            const resolvedMarkers = markerArray.filter(m =>
                Math.abs(m.position.x) > 0.0001 ||
                Math.abs(m.position.y) > 0.0001 ||
                Math.abs(m.position.z) > 0.0001
            );

            return {
                count: markers.size,
                resolvedCount: resolvedMarkers.length
            };
        });

        if (result.error) throw new Error(result.error);
        // シードデータは3件あり、すべて dbId を持っているので、3件とも解決されているはず
        expect(result.resolvedCount).toBeGreaterThan(0);
        console.log(`[E2E-DEBUG] Resolved markers count: ${result.resolvedCount}`);
    });

    test('dbId を持つ指摘事項がオブジェクトの重心に配置されること', async ({ page }) => {
        // フロアリストが読み込まれるのを待つ
        await page.waitForFunction(() => {
            const select = document.querySelector('[data-testid="floor-select"]') as HTMLSelectElement;
            return select && Array.from(select.options).some(o => (o as HTMLOptionElement).label === '7F');
        }, { timeout: 30000 });

        await page.getByTestId('floor-select').selectOption({ label: '7F' });

        const result = await page.evaluate(async () => {
            console.log('[E2E-DEBUG] Starting evaluation for dbId placement');
            const viewer = (window as any).NOP_VIEWER;
            if (!viewer) return { error: 'Viewer (NOP_VIEWER) が見つかりません' };

            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension');
            if (!ext) return { error: 'IssueExtension がロードされていません' };

            const testIssueId = 'test-dbid-issue';
            const targetDbId = 20865;

            const expectedPos = ext.getComponentCenter(targetDbId);
            if (!expectedPos) return { error: `dbId ${targetDbId} の重心が取得できませんでした` };

            ext.setIssues([{
                id: testIssueId,
                issueNumber: 999,
                title: 'Test dbId Placement',
                status: 'Open',
                dbId: targetDbId,
                floor: '7F',
                modelPosition: { x: 0, y: 0, z: 0 }
            }]);

            const marker = ext.markers.get(testIssueId);
            if (!marker) return { error: 'マーカーが生成されませんでした' };

            const dist = expectedPos.distanceTo(marker.position);
            return {
                dist,
                markerPos: { x: marker.position.x, y: marker.position.y, z: marker.position.z },
                expectedPos: { x: expectedPos.x, y: expectedPos.y, z: expectedPos.z }
            };
        });

        if (result.error) throw new Error(result.error);
        expect(result.dist).toBeDefined();
        if (result.dist !== undefined) {
            expect(result.dist).toBeLessThan(0.01);
        }
    });

    test('dbId を持たない指摘事項が modelPosition に配置されること', async ({ page }) => {
        // フロアリストが読み込まれるのを待つ
        await page.waitForFunction(() => {
            const select = document.querySelector('[data-testid="floor-select"]') as HTMLSelectElement;
            return select && Array.from(select.options).some(o => (o as HTMLOptionElement).label === '7F');
        }, { timeout: 30000 });

        await page.getByTestId('floor-select').selectOption({ label: '7F' });

        const result = await page.evaluate(async () => {
            console.log('[E2E-DEBUG] Starting evaluation for manual placement');
            const viewer = (window as any).NOP_VIEWER;
            if (!viewer) return { error: 'Viewer (NOP_VIEWER) が見つかりません' };

            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension');
            if (!ext) return { error: 'IssueExtension がロードされていません' };

            const testIssueId = 'test-manual-issue';
            const manualPos = { x: 100, y: 100, z: 100 };

            ext.setIssues([{
                id: testIssueId,
                issueNumber: 888,
                title: 'Test Manual Placement',
                status: 'In Progress',
                floor: '7F',
                modelPosition: manualPos
            }]);

            const marker = ext.markers.get(testIssueId);
            if (!marker) return { error: 'マーカーが生成されませんでした' };

            return {
                markerPos: { x: marker.position.x, y: marker.position.y, z: marker.position.z },
                manualPos
            };
        });

        if (result.error) throw new Error(result.error);
        expect(result.markerPos).toBeDefined();
        expect(result.manualPos).toBeDefined();
        if (result.markerPos && result.manualPos) {
            expect(result.markerPos.x).toBe(result.manualPos.x);
            expect(result.markerPos.y).toBe(result.manualPos.y);
            expect(result.markerPos.z).toBe(result.manualPos.z);
        }
    });

    test('空域をクリックしたときに新規作成ダイアログが表示され、妥当な3D座標で作成されること', async ({ page }) => {
        // 7Fを選択してモデルを孤立させる
        await page.waitForFunction(() => {
            const select = document.querySelector('[data-testid="floor-select"]') as HTMLSelectElement;
            return select && Array.from(select.options).some(o => (o as HTMLOptionElement).label === '7F');
        }, { timeout: 30000 });
        await page.getByTestId('floor-select').selectOption({ label: '7F' });

        // Viewerのキャンバスを取得
        const canvas = page.locator('canvas').first();

        // 空間の特定の位置をクリック
        const clickPos = { x: 300, y: 300 };
        await canvas.click({ position: clickPos });

        // ダイアログが表示されるのを確認し、入力をシミュレート
        await expect(page.getByText('新しい指摘事項を作成')).toBeVisible({ timeout: 10000 });

        // フォーム入力 (プレースホルダーやラベルは実装に合わせる必要があるが、一般的な想定)
        // もし入力フィールドが見つからない場合はスキップされる
        const titleField = page.locator('input[placeholder*="タイトル"], input[name="title"]').first();
        if (await titleField.isVisible()) {
            await titleField.fill('E2E Test Space Click');
        }

        // 作成ボタンをクリック
        const createButton = page.getByRole('button', { name: '作成' });
        await createButton.click();

        // マーカーの生成を待機
        await page.waitForTimeout(2000);

        // マーカーの3D座標が(0,0,0)付近でなく、かつ以前の「浮遊」座標でないことを検証
        const result = await page.evaluate(() => {
            const viewer = (window as any).NOP_VIEWER;
            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension');
            const markers = Array.from(ext.markers.values() as any[]);
            if (markers.length === 0) return { error: 'マーカーが生成されませんでした' };

            // 最新のマーカーを取得
            const lastMarker = markers[markers.length - 1];
            const pos = lastMarker.position;

            // カメラの状態も取得して参考にする
            const camera = viewer.getCamera();
            const target = viewer.navigation.getTarget();
            const depth = pos.clone().sub(camera.position).dot(viewer.navigation.getEyeVector());

            return {
                x: pos.x,
                y: pos.y,
                z: pos.z,
                depth,
                targetDepth: target.clone().sub(camera.position).dot(viewer.navigation.getEyeVector())
            };
        });

        if (result.error) throw new Error(result.error);

        console.log(`[E2E-DEBUG] Created marker pos: (${result.x}, ${result.y}, ${result.z}), depth: ${result.depth}`);

        // 座標が 0 でないこと
        expect(result.x).not.toBe(0);
        expect(result.y).not.toBe(0);

        // 深度が極端に浅すぎない（カメラのすぐ手前 -1 や 0 付近でない）ことを確認
        // 通常の建物モデルなら深度は 10〜1000 程度のオーダーになるはず
        expect(Math.abs(result.depth)).toBeGreaterThan(1.0);
    });
});
