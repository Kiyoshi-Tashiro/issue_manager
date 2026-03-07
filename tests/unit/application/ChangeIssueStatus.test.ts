import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeIssueStatusUseCase, ChangeIssueStatusCommand } from '@/application/use-cases/ChangeIssueStatus';
import { IIssueRepository } from '@/application/interfaces';
import { Issue, IssueProps } from '@/domain/models/Issue';

describe('ChangeIssueStatusUseCase', () => {
    let useCase: ChangeIssueStatusUseCase;
    let mockRepo: IIssueRepository;

    const createMockIssue = (props: Partial<IssueProps> = {}): Issue => {
        return new Issue({
            id: 'issue-1',
            title: 'Test Title',
            status: 'Open',
            floorId: 'floor-1',
            photoUrls: [],
            createdBy: 'user-1',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...props
        } as IssueProps);
    };

    beforeEach(() => {
        mockRepo = {
            findById: vi.fn(),
            findByFloor: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        };
        useCase = new ChangeIssueStatusUseCase(mockRepo);
    });

    it('should allow Admin to change status', async () => {
        const issue = createMockIssue({ status: 'Open' });
        vi.mocked(mockRepo.findById).mockResolvedValue(issue);

        const command: ChangeIssueStatusCommand = {
            issueId: 'issue-1',
            newStatus: 'In Progress',
            userRole: 'Admin',
            requestingUserId: 'admin-1'
        };

        await useCase.execute(command);

        expect(issue.status).toBe('In Progress');
        expect(mockRepo.save).toHaveBeenCalledWith(issue);
    });

    it('should throw error if Editor tries to change status', async () => {
        const issue = createMockIssue({ status: 'Open' });
        vi.mocked(mockRepo.findById).mockResolvedValue(issue);

        const command: ChangeIssueStatusCommand = {
            issueId: 'issue-1',
            newStatus: 'In Progress',
            userRole: 'Editor',
            requestingUserId: 'user-1'
        };

        await expect(useCase.execute(command)).rejects.toThrow('ステータスを更新する権限がありません。');
        expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should throw error if Viewer tries to change status', async () => {
        const issue = createMockIssue({ status: 'Open' });
        vi.mocked(mockRepo.findById).mockResolvedValue(issue);

        const command: ChangeIssueStatusCommand = {
            issueId: 'issue-1',
            newStatus: 'In Progress',
            userRole: 'Viewer',
            requestingUserId: 'user-3'
        };

        await expect(useCase.execute(command)).rejects.toThrow('ステータスを更新する権限がありません。');
        expect(mockRepo.save).not.toHaveBeenCalled();
    });
});
