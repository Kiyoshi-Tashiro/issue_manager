import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateIssueUseCase, CreateIssueCommand } from '@/application/use-cases/CreateIssue';
import { IIssueRepository, IBlobStorageService } from '@/application/interfaces';

describe('CreateIssueUseCase', () => {
    let useCase: CreateIssueUseCase;
    let mockRepo: IIssueRepository;
    let mockStorage: IBlobStorageService;

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
        useCase = new CreateIssueUseCase(mockRepo, mockStorage);
    });

    it('should create an issue, upload photos, and save it to the repository', async () => {
        vi.mocked(mockStorage.uploadFile).mockResolvedValue('http://minio/photo.jpg');

        const command: CreateIssueCommand = {
            title: 'Test Create',
            description: 'Test Describe',
            category: '品質不良',
            modelPosition: { x: 1, y: 2, z: 3 },
            dbId: 999,
            floorId: 'floor-1',
            createdBy: 'user-creator',
            userRole: 'Admin',
            photos: [{
                buffer: Buffer.from('fake-image'),
                name: 'test.jpg',
                type: 'image/jpeg'
            }]
        };

        const issueId = await useCase.execute(command);

        expect(issueId).toBeDefined();
        expect(mockStorage.uploadFile).toHaveBeenCalled();
        expect(mockRepo.save).toHaveBeenCalled();

        // Assert that save is called with an Entity that contains the expected properties
        const savedArg = vi.mocked(mockRepo.save).mock.calls[0][0];
        const json = savedArg.toJSON();
        expect(json.title).toBe('Test Create');
        expect(json.description).toBe('Test Describe');
        expect(json.category).toBe('品質不良');
        expect(json.dbId).toBe(999);
        expect(json.modelPosition).toEqual({ x: 1, y: 2, z: 3 });
        expect(json.createdBy).toBe('user-creator');
        expect(json.photoUrls).toContain('http://minio/photo.jpg');
        expect(json.status).toBe('Open');
    });

    it('should throw an error if user lacks permission', async () => {
        const command: CreateIssueCommand = {
            title: 'No Perms',
            floorId: 'floor-1',
            createdBy: 'viewer-user',
            userRole: 'Viewer' as any, // Only Admins and Editors can create issues
            photos: []
        };

        await expect(useCase.execute(command)).rejects.toThrow('指摘事項を作成する権限がありません。');
        expect(mockRepo.save).not.toHaveBeenCalled();
    });
});
