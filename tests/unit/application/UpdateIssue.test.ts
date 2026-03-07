import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateIssueUseCase, UpdateIssueCommand } from '@/application/use-cases/UpdateIssue';
import { IIssueRepository, IBlobStorageService } from '@/application/interfaces';
import { Issue, IssueProps } from '@/domain/models/Issue';

describe('UpdateIssueUseCase', () => {
    let useCase: UpdateIssueUseCase;
    let mockRepo: IIssueRepository;
    let mockStorage: IBlobStorageService;

    const createMockIssue = (props: Partial<IssueProps> = {}): Issue => {
        return new Issue({
            id: 'issue-1',
            title: 'Old Title',
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
        mockStorage = {
            uploadFile: vi.fn(),
            deleteFile: vi.fn(),
        };
        useCase = new UpdateIssueUseCase(mockRepo, mockStorage);
    });

    it('should update an issue and save it to the repository', async () => {
        const issue = createMockIssue();
        vi.mocked(mockRepo.findById).mockResolvedValue(issue);

        const command: UpdateIssueCommand = {
            issueId: 'issue-1',
            title: 'New Title',
            description: 'New Description',
            category: '安全不備',
            status: 'In Progress',
            updatedBy: 'user-1',
            userRole: 'Editor'
        };

        await useCase.execute(command);

        expect(mockRepo.findById).toHaveBeenCalledWith('issue-1');
        expect(issue.toJSON().title).toBe('New Title');
        expect(issue.status).toBe('In Progress');

        const json = issue.toJSON();
        expect(json.description).toBe('New Description');
        expect(json.category).toBe('安全不備');

        expect(mockRepo.save).toHaveBeenCalledWith(issue);
    });

    it('should throw error if issue is not found', async () => {
        vi.mocked(mockRepo.findById).mockResolvedValue(null);

        const command: UpdateIssueCommand = {
            issueId: 'non-existent',
            updatedBy: 'user-2',
            userRole: 'Editor'
        };

        await expect(useCase.execute(command)).rejects.toThrow('指摘事項が見つかりません。');
    });

    it('should throw optimistic lock error if another user updated it concurrently', async () => {
        const issue = createMockIssue();
        vi.mocked(mockRepo.findById).mockResolvedValue(issue);
        vi.mocked(mockRepo.save).mockRejectedValue(new Error('楽観的ロックにより更新に失敗しました。'));

        const command: UpdateIssueCommand = {
            issueId: 'issue-1',
            title: 'Conflict Title',
            updatedBy: 'user-1',
            userRole: 'Editor'
        };

        await expect(useCase.execute(command)).rejects.toThrow('楽観的ロックにより更新に失敗しました。');
    });

    it('should upload photos if provided', async () => {
        const issue = createMockIssue();
        vi.mocked(mockRepo.findById).mockResolvedValue(issue);
        vi.mocked(mockStorage.uploadFile).mockResolvedValue('http://minio/photo.jpg');

        const command: UpdateIssueCommand = {
            issueId: 'issue-1',
            photos: [{
                buffer: Buffer.from('fake-image'),
                fileName: 'test.jpg',
                contentType: 'image/jpeg'
            }],
            updatedBy: 'user-1',
            userRole: 'Editor'
        };

        await useCase.execute(command);

        expect(mockStorage.uploadFile).toHaveBeenCalled();
        // Since we are using (issue as any).props.photoUrls.push(...) in the use case
        expect(issue.toJSON().photoUrls).toContain('http://minio/photo.jpg');
    });

    it('should throw error if Editor tries to update someone else\'s issue', async () => {
        const issue = createMockIssue({ createdBy: 'other-user' });
        vi.mocked(mockRepo.findById).mockResolvedValue(issue);

        const command: UpdateIssueCommand = {
            issueId: 'issue-1',
            title: 'Hacked Title',
            updatedBy: 'hacker-user',
            userRole: 'Editor'
        };

        await expect(useCase.execute(command)).rejects.toThrow('指摘事項を編集する権限がありません。');
        expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should propagate UserRole to the Domain entity', async () => {
        // Test business rule: regular user cannot reopen Done issue
        const issue = createMockIssue({ status: 'Done' });
        vi.mocked(mockRepo.findById).mockResolvedValue(issue);

        const command: UpdateIssueCommand = {
            issueId: 'issue-1',
            status: 'Open',
            updatedBy: 'user-1',
            userRole: 'Editor'
        };

        await expect(useCase.execute(command)).rejects.toThrow();
        expect(mockRepo.save).not.toHaveBeenCalled();
    });
});
