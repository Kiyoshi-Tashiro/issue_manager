import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIssueExtensionClass } from '@/components/viewer/extensions/IssueExtension';

// --- Mocks ---

const mockVector3 = function (this: any, x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
    this.copy = vi.fn().mockImplementation((v) => { this.x = v.x; this.y = v.y; this.z = v.z; return this; });
    this.set = vi.fn().mockImplementation((nx, ny, nz) => { this.x = nx; this.y = ny; this.z = nz; return this; });
    this.distanceTo = vi.fn().mockReturnValue(0);
    this.applyMatrix4 = vi.fn().mockReturnValue(this);
    this.add = vi.fn().mockReturnValue(this);
    this.multiplyScalar = vi.fn().mockReturnValue(this);
    this.clone = vi.fn().mockImplementation(() => new (mockVector3 as any)(this.x, this.y, this.z));
};

const mockBox3 = function (this: any) {
    this.union = vi.fn();
    this.getCenter = vi.fn().mockImplementation((v) => {
        v.set(50, 60, 70); // Mock center for dbId
        return v;
    });
};

const mockMatrix4 = function (this: any) {
    this.makeRotationX = vi.fn().mockReturnValue(this);
    this.makeRotationZ = vi.fn().mockReturnValue(this);
    this.makeTranslation = vi.fn().mockReturnValue(this);
    this.multiply = vi.fn().mockReturnValue(this);
};

const mockGeometry = class {
    applyMatrix4 = vi.fn().mockReturnValue(this);
    applyMatrix = vi.fn().mockReturnValue(this);
};

const THREE = {
    Vector3: mockVector3,
    Box3: mockBox3,
    Matrix4: mockMatrix4,
    CylinderGeometry: class extends mockGeometry { },
    SphereGeometry: class extends mockGeometry { },
    MeshBasicMaterial: class { opacity = 0.5 },
    Mesh: class {
        position = new (mockVector3 as any)();
        scale = new (mockVector3 as any)(1, 1, 1);
        material = { opacity: 0.5 };
        quaternion = { set: vi.fn(), setFromRotationMatrix: vi.fn() };
        userData = {};
        children = [];
        add = vi.fn();
        updateMatrixWorld = vi.fn();
    }
};

(global as any).THREE = THREE;

const Autodesk = {
    Viewing: {
        Extension: class {
            viewer: any;
            options: any;
            constructor(viewer: any, options: any) {
                this.viewer = viewer;
                this.options = options;
            }
            load() { return true; }
            unload() { return true; }
        },
        CAMERA_CHANGE_EVENT: 'CAMERA_CHANGE_EVENT'
    }
};

describe('IssueExtension Unit Test', () => {
    let viewerMock: any;
    let IssueExtension: any;
    let extension: any;

    beforeEach(() => {
        vi.clearAllMocks();

        viewerMock = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            getCamera: vi.fn().mockReturnValue({
                isOrthographicCamera: false,
                position: new (mockVector3 as any)(0, 0, 1000),
                project: vi.fn().mockReturnValue({ z: 0.5 })
            }),
            navigation: {
                isOrthographic: vi.fn().mockReturnValue(false),
                getZoom: vi.fn().mockReturnValue(1.0),
                fitToView: vi.fn(),
                setView: vi.fn()
            },
            overlays: {
                hasScene: vi.fn().mockReturnValue(true),
                addMesh: vi.fn(),
                removeMesh: vi.fn(),
                addScene: vi.fn()
            },
            impl: {
                invalidate: vi.fn()
            },
            model: {
                getInstanceTree: vi.fn().mockReturnValue({
                    enumNodeFragments: vi.fn((dbId, cb) => cb(123, null))
                }),
                getFragmentList: vi.fn().mockReturnValue({
                    getWorldBounds: vi.fn()
                })
            },
            canvas: {
                getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0 }),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                style: {}
            },
            container: {
                clientWidth: 1000,
                clientHeight: 1000,
                appendChild: vi.fn()
            },
            toolController: {
                getTool: vi.fn(),
                registerTool: vi.fn(),
                activateTool: vi.fn(),
                deactivateTool: vi.fn(),
                deregisterTool: vi.fn()
            }
        };

        const ExtensionClass = createIssueExtensionClass(Autodesk);
        extension = new ExtensionClass(viewerMock, {});
    });

    it('dbId が指定されている場合、オブジェクトの重心位置を取得すること', () => {
        const issues = [{
            id: 'issue-1',
            dbId: 20001,
            modelPosition: { x: 1, y: 1, z: 1 } // 背景として存在
        }];

        extension.setIssues(issues);

        const marker = extension.markers.get('issue-1');
        expect(marker).toBeDefined();
        // getComponentCenter でモックされた値 (50, 60, 70) になっているはず
        expect(marker.position.x).toBe(50);
        expect(marker.position.y).toBe(60);
        expect(marker.position.z).toBe(70);
    });

    it('dbId がなく modelPosition がある場合、modelPosition を使用すること', () => {
        const issues = [{
            id: 'issue-2',
            modelPosition: { x: 10, y: 20, z: 30 }
        }];

        extension.setIssues(issues);

        const marker = extension.markers.get('issue-2');
        expect(marker).toBeDefined();
        expect(marker.position.x).toBe(10);
        expect(marker.position.y).toBe(20);
        expect(marker.position.z).toBe(30);
    });

    it('何の位置情報もない場合はマーカーを作成しないこと', () => {
        const issues = [{ id: 'issue-3' }];
        extension.setIssues(issues);
        expect(extension.markers.size).toBe(0);
    });

    describe('Marker management and updates', () => {
        it('既存のマーカーを削除し、新しいマーカーを追加できること', () => {
            // 最初に追加
            extension.setIssues([{ id: 'issue-1', modelPosition: { x: 1, y: 1, z: 1 } }]);
            expect(extension.markers.size).toBe(1);
            expect(extension.markers.has('issue-1')).toBe(true);

            // 更新 (issue-1を消して issue-2を追加)
            extension.setIssues([{ id: 'issue-2', modelPosition: { x: 2, y: 2, z: 2 } }]);
            expect(extension.markers.size).toBe(1);
            expect(extension.markers.has('issue-1')).toBe(false);
            expect(extension.markers.has('issue-2')).toBe(true);
        });

        it('clearMarkers で全てのマーカーが削除されること', () => {
            extension.setIssues([
                { id: 'issue-1', modelPosition: { x: 1, y: 1, z: 1 } },
                { id: 'issue-2', modelPosition: { x: 2, y: 2, z: 2 } }
            ]);
            expect(extension.markers.size).toBe(2);

            extension.clearMarkers();
            expect(extension.markers.size).toBe(0);
            expect(viewerMock.overlays.removeMesh).toHaveBeenCalled();
        });

        it('同一IDのIssueが重複して追加されないこと', () => {
            const issue = { id: 'dup-issue', modelPosition: { x: 0, y: 0, z: 0 } };
            extension.setIssues([issue, issue]); // 同じID
            expect(extension.markers.size).toBe(1);
        });
    });

    describe('View integration', () => {
        it('zoomToIssue が正しい座標へのズーム（setView）を試みること', () => {
            extension.setIssues([{ id: 'target-issue', modelPosition: { x: 100, y: 200, z: 300 } }]);

            extension.zoomToIssue('target-issue');
            expect(viewerMock.navigation.setView).toHaveBeenCalled();

            const call = viewerMock.navigation.setView.mock.calls[0];
            // call[0] は cameraPos, call[1] は target (marker.position)
            expect(call[1].x).toBe(100);
            expect(call[1].y).toBe(200);
            expect(call[1].z).toBe(300);
        });
    });

    describe('Coordinate calculation for new issues', () => {
        it('部材を直接クリックしたときに、その位置とdbIdを返すこと', () => {
            const onSelect = vi.fn();
            extension.activateInteractionTool(onSelect, vi.fn());
            const tool = extension.tool;

            const intersectPoint = new (THREE.Vector3 as any)(10, 20, 30);
            viewerMock.impl.hitTest = vi.fn().mockReturnValue({
                model: {},
                dbId: 12345,
                intersectPoint: intersectPoint
            });

            // Simulate mouse click
            const event = { clientX: 100, clientY: 100, button: 0 };
            viewerMock.impl.clientToViewport = vi.fn().mockReturnValue({ x: 0.5, y: 0.5 });

            tool.activate();
            tool.handleSingleClick(event, 0);

            expect(onSelect).toHaveBeenCalledWith(intersectPoint, 12345);
        });

        it('空間をクリックしたとき、近傍に部材がなければより広い範囲から最も近い部材を探すこと', () => {
            const onSelect = vi.fn();
            extension.activateInteractionTool(onSelect, vi.fn());
            const tool = extension.tool;

            const globalHitPoint = new (THREE.Vector3 as any)(0, 0, 500);
            viewerMock.impl.hitTest = vi.fn()
                .mockReturnValueOnce(null) // 1. 直接クリック判定 (line 484)
                .mockReturnValueOnce(null) // 2. 半径 50px ヒットなし (line 499)
                .mockReturnValueOnce({     // 3. 全画面ヒット (line 505)
                    model: {},
                    dbId: 54321,
                    intersectPoint: globalHitPoint
                });

            const cameraPos = new (THREE.Vector3 as any)(0, 0, 1000);
            viewerMock.getCamera = vi.fn().mockReturnValue({
                position: cameraPos
            });
            globalHitPoint.distanceTo = vi.fn().mockReturnValue(500);

            const ray = {
                origin: new (THREE.Vector3 as any)(0, 0, 1000),
                direction: new (THREE.Vector3 as any)(0, 0, -1)
            };
            ray.direction.multiplyScalar = vi.fn().mockReturnValue({ x: 0, y: 0, z: -500 });
            viewerMock.impl.viewportToRay = vi.fn().mockReturnValue(ray);

            const event = { clientX: 100, clientY: 100, button: 0 };
            viewerMock.impl.clientToViewport = vi.fn().mockReturnValue({ x: 0.5, y: 0.5 });
            viewerMock.navigation.getTarget = vi.fn().mockReturnValue(new (THREE.Vector3 as any)(0, 0, 0));

            tool.activate();
            tool.handleSingleClick(event, 0);

            // hitTest が 3回呼ばれていることを確認
            expect(viewerMock.impl.hitTest).toHaveBeenCalledTimes(3);
            expect(viewerMock.impl.hitTest.mock.calls[1][4]).toBe(50);   // radius 50
            expect(viewerMock.impl.hitTest.mock.calls[2][4]).toBe(1000); // radius maxDimension

            expect(onSelect).toHaveBeenCalled();
            expect(onSelect.mock.calls[0][1]).toBeNull(); // 空間クリック扱い
        });
    });
});
