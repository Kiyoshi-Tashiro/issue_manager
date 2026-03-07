import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIssueExtensionClass } from '@/components/viewer/extensions/IssueExtension';

const mockAutodesk = {
    Viewing: {
        Extension: class {
            constructor(public viewer: any, public options: any) { }
            load() { return true; }
            unload() { return true; }
        },
        CAMERA_CHANGE_EVENT: 'cameraChange'
    }
};

const mockThree = {
    Vector3: class {
        constructor(public x = 0, public y = 0, public z = 0) { }
        set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
        copy(v: any) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
        project() { return this; }
        add() { return this; }
        sub() { return this; }
        multiplyScalar() { return this; }
        distanceTo() { return 0; } // default to "hit"
        clone() { return new mockThree.Vector3(this.x, this.y, this.z); }
    },
    Matrix4: class {
        makeRotationX() { return this; }
        makeTranslation() { return this; }
    },
    CylinderGeometry: class { },
    SphereGeometry: class { },
    MeshBasicMaterial: class { },
    Mesh: class {
        scale = { set: vi.fn() };
        position = new (mockThree.Vector3 as any)();
        add = vi.fn();
        updateMatrixWorld = vi.fn();
        userData = {};
    }
};

(global as any).THREE = mockThree;

describe('IssueExtension Detailed Logic (REQ-26, REQ-27)', () => {
    let viewer: any;
    let extension: any;
    let onSelect: any;
    let onMarkerClick: any;

    beforeEach(() => {
        viewer = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            overlays: {
                hasScene: vi.fn().mockReturnValue(true),
                addScene: vi.fn(),
                addMesh: vi.fn(),
                removeMesh: vi.fn()
            },
            impl: {
                invalidate: vi.fn(),
                clientToViewport: vi.fn().mockReturnValue({ x: 0, y: 0 }),
                hitTest: vi.fn(),
                viewportToRay: vi.fn().mockReturnValue({ origin: new mockThree.Vector3(), direction: new mockThree.Vector3() })
            },
            toolController: {
                registerTool: vi.fn(),
                deregisterTool: vi.fn(),
                activateTool: vi.fn(),
                deactivateTool: vi.fn(),
                getTool: vi.fn().mockReturnValue(null)
            },
            getCamera: vi.fn().mockReturnValue({}),
            navigation: {
                getTarget: vi.fn().mockReturnValue(new mockThree.Vector3())
            },
            canvas: {
                getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 1000, height: 1000 }),
                style: {}
            },
            container: {
                appendChild: vi.fn(),
                removeChild: vi.fn()
            }
        };

        const ExtensionClass = createIssueExtensionClass(mockAutodesk);
        extension = new ExtensionClass(viewer, {});
        onSelect = vi.fn();
        onMarkerClick = vi.fn();
    });

    it('should identify a marker hit based on proximity (REQ-26)', () => {
        extension.activateInteractionTool(onSelect, onMarkerClick);
        const tool = vi.mocked(viewer.toolController.registerTool).mock.calls[0][0];

        const mockMesh = new mockThree.Mesh() as any;
        mockMesh.userData = { labelPosition: new mockThree.Vector3(0, 0, 0) };
        mockMesh.position = new mockThree.Vector3(0, 0, 0);
        extension.markers.set('issue-123', mockMesh);

        const event = { clientX: 0, clientY: 0 };
        tool.handleSingleClick(event, 0);

        expect(onMarkerClick).toHaveBeenCalledWith('issue-123');
    });

    it('should fall back to model hitTest if no marker is hit (REQ-27)', () => {
        extension.activateInteractionTool(onSelect, onMarkerClick);
        const tool = vi.mocked(viewer.toolController.registerTool).mock.calls[0][0];

        // No markers
        vi.mocked(viewer.impl.hitTest).mockReturnValue({
            model: {},
            dbId: 999,
            intersectPoint: { x: 1, y: 2, z: 3 }
        });

        const event = { clientX: 500, clientY: 500 };
        tool.handleSingleClick(event, 0);

        expect(onSelect).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 }, 999);
    });
});
