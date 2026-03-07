/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IssueDetailModal from '@/components/IssueDetailModal';

// Mock fetch
global.fetch = vi.fn();

// UserContextモック
vi.mock('@/app/contexts/UserContext', () => ({
    UserProvider: ({ children }: any) => children,
    useUser: () => ({
        selectedUser: { id: 'admin-1', displayName: '管理者', role: 'Admin' },
        setSelectedUser: vi.fn(),
        users: [{ id: 'admin-1', displayName: '管理者', role: 'Admin' }],
        loading: false,
    }),
}));


describe('IssueDetailModal Component', () => {
    const mockIssue = {
        id: 'issue-1',
        title: 'Test Issue',
        description: 'Test Description',
        status: 'Open',
        category: '安全不備',
        dbId: 1024,
        createdBy: 'test-user',
        version: 1,
        photoUrls: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch and display issue details', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => mockIssue,
        } as Response);

        render(<IssueDetailModal issueId="issue-1" onClose={() => { }} onUpdate={() => { }} />);

        expect(screen.getByText('読み込み中...')).toBeDefined();

        await waitFor(() => {
            expect(screen.getByDisplayValue('Test Issue')).toBeDefined();
            expect(screen.getByDisplayValue('Open')).toBeDefined();

            // Assert new fields are rendered
            expect(screen.getByText('test-user')).toBeDefined();
            expect(screen.getByText('dbId: 1024')).toBeDefined();
            expect(screen.getByDisplayValue('安全不備')).toBeDefined();
            expect(screen.getByDisplayValue('Test Description')).toBeDefined();
        });
    });

    it('should call onClose when close button is clicked', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => mockIssue,
        } as Response);

        const handleClose = vi.fn();
        render(<IssueDetailModal issueId="issue-1" onClose={handleClose} onUpdate={() => { }} />);

        await waitFor(() => screen.getByTestId('issue-detail-close-btn'));

        fireEvent.click(screen.getByTestId('issue-detail-close-btn'));
        expect(handleClose).toHaveBeenCalled();
    });

    it('should trigger save when update button is clicked', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => mockIssue,
        } as Response).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ...mockIssue, status: 'In Progress', category: '品質不良', version: 2 }),
        } as Response);

        const handleUpdate = vi.fn();
        render(<IssueDetailModal issueId="issue-1" onClose={() => { }} onUpdate={handleUpdate} />);

        await waitFor(() => screen.getByTestId('issue-detail-save-btn'));

        fireEvent.change(screen.getByTestId('issue-detail-status-select'), { target: { value: 'In Progress' } });
        fireEvent.change(screen.getByTestId('issue-detail-category-select'), { target: { value: '品質不良' } });
        fireEvent.click(screen.getByTestId('issue-detail-save-btn'));

        await waitFor(() => {
            expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({
                status: 'In Progress',
                category: '品質不良',
                version: 2
            }));
        });
    });
});
