import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProjectsPage from '@/app/projects/page';
import React from 'react';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/app/contexts/UserContext', () => ({
    UserProvider: ({ children }: any) => children,
    useUser: () => ({
        selectedUser: { id: 'admin-1', displayName: '管理者', role: 'Admin' },
        setSelectedUser: vi.fn(),
        users: [{ id: 'admin-1', displayName: '管理者', role: 'Admin' }],
        loading: false,
    }),
}));

const mockActivate = vi.fn();

vi.mock('@/components/viewer/ApsViewer', () => ({
    default: function MockApsViewer(props: any) {
        React.useEffect(() => {
            if (props.urn && props.onViewerReady) {
                props.onViewerReady({
                    getExtension: (name: string) => {
                        if (name === 'Autodesk.Aps.IssueExtension') {
                            return { activateInteractionTool: mockActivate };
                        }
                        return { floorSelector: { floorData: [] } };
                    }
                });
            }
        }, [props.urn, props.onViewerReady]);
        return <div data-testid="aps-viewer-mock">Viewer Mock</div>;
    }
}));

describe('ProjectsPage Interaction Fix Verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('/api/aps/token')) return Promise.resolve({ ok: true, json: async () => ({ access_token: 't' }) });
            if (url.includes('/api/aps/urn')) return Promise.resolve({ ok: true, json: async () => ({ urn: 'u' }) });
            return Promise.resolve({ ok: true, json: async () => [] });
        });
    });

    it('should call activateInteractionTool after the fix (REQ-26, REQ-27 verification)', async () => {
        render(<ProjectsPage />);

        // Wait for viewer mock to appear
        await waitFor(() => {
            expect(screen.queryByTestId('aps-viewer-mock')).toBeDefined();
        }, { timeout: 3000 });

        // Wait for handleViewerReady to execute
        await waitFor(() => {
            expect(mockActivate).toHaveBeenCalled();
        }, { timeout: 3000 });

        console.log('Interaction Tool Registration Verified!');
    });
});
