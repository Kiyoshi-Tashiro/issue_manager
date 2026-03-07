import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/infrastructure/persistence/prisma';
import { PrismaIssueRepository } from '@/infrastructure/persistence/PrismaIssueRepository';
import { MinioStorageService } from '@/infrastructure/storage/MinioStorageService';
import { CreateIssueUseCase } from '@/application/use-cases/CreateIssue';
import { ChangeIssueStatusUseCase } from '@/application/use-cases/ChangeIssueStatus';
import { GetIssueByIdUseCase } from '@/application/use-cases/GetIssueById';
import { IssueStatus } from '@/domain/models/Issue';

describe('IssueUseCase Integration Test', () => {
    const issueRepository = new PrismaIssueRepository();
    const storageService = new MinioStorageService();
    const testFloor = 'INTEGRATION-TEST-FLOOR';
    let createdIssueId: string;

    beforeAll(async () => {
        await prisma.$connect();
        // クリーンアップ: 以前のテストデータが残っていれば削除
        await prisma.issue.deleteMany({ where: { floor: testFloor } });
    });

    afterAll(async () => {
        // テストデータのクリーンアップ
        await prisma.issue.deleteMany({ where: { floor: testFloor } });
        await prisma.$disconnect();
    });

    it('should complete the lifecycle: Create -> Find -> Change Status -> Delete', async () => {
        const createUseCase = new CreateIssueUseCase(issueRepository, storageService);
        const getByIdUseCase = new GetIssueByIdUseCase(issueRepository);
        const statusUseCase = new ChangeIssueStatusUseCase(issueRepository);

        // 1. Create
        createdIssueId = await createUseCase.execute({
            title: 'Integration Test Issue',
            description: 'Testing full lifecycle',
            category: '品質不良',
            modelPosition: { x: 1, y: 1, z: 1 },
            floor: testFloor,
            createdBy: 'test-admin-id',
            userRole: 'Admin',
            photos: []
        });

        expect(createdIssueId).toBeDefined();

        // 2. Find
        const issue = await getByIdUseCase.execute(createdIssueId);
        expect(issue).not.toBeNull();
        expect(issue?.title).toBe('Integration Test Issue');
        expect(issue?.status).toBe('Open');
        expect(issue?.issueNumber).toBeGreaterThan(0); // 自動採番の確認

        // 3. Change Status (Open -> In Progress)
        await statusUseCase.execute({
            issueId: createdIssueId,
            newStatus: 'In Progress',
            userRole: 'Admin', // ステータス変更は管理者が行う
            requestingUserId: 'test-admin-id'
        });

        const updatedIssue = await getByIdUseCase.execute(createdIssueId);
        expect(updatedIssue?.status).toBe('In Progress');

        // 4. Delete
        await issueRepository.delete(createdIssueId);
        const deletedIssue = await getByIdUseCase.execute(createdIssueId);
        expect(deletedIssue).toBeNull();
    });

    it('should enforce RBAC: Viewer cannot change status', async () => {
        const createUseCase = new CreateIssueUseCase(issueRepository, storageService);
        const statusUseCase = new ChangeIssueStatusUseCase(issueRepository);

        const id = await createUseCase.execute({
            title: 'RBAC Test',
            floor: testFloor,
            createdBy: 'admin',
            userRole: 'Admin',
            photos: []
        });

        await expect(statusUseCase.execute({
            issueId: id,
            newStatus: 'In Progress',
            userRole: 'Viewer',
            requestingUserId: 'viewer'
        })).rejects.toThrow('ステータスを更新する権限がありません。');
    });

    it('should enforce RBAC: Only Admin can reopen Done issue', async () => {
        const statusUseCase = new ChangeIssueStatusUseCase(issueRepository);
        const createUseCase = new CreateIssueUseCase(issueRepository, storageService);

        const id = await createUseCase.execute({
            title: 'Reopen Test',
            floor: testFloor,
            createdBy: 'admin',
            userRole: 'Admin',
            photos: []
        });

        // Set to Done first (Admin can do anything)
        await statusUseCase.execute({
            issueId: id,
            newStatus: 'Done',
            userRole: 'Admin',
            requestingUserId: 'admin'
        });

        // Try to reopen as Editor (should fail by PermissionPolicy)
        await expect(statusUseCase.execute({
            issueId: id,
            newStatus: 'Open',
            userRole: 'Editor',
            requestingUserId: 'editor'
        })).rejects.toThrow('ステータスを更新する権限がありません。');

        // Reopen as Admin (should succeed)
        await statusUseCase.execute({
            issueId: id,
            newStatus: 'Open',
            userRole: 'Admin',
            requestingUserId: 'admin'
        });

        const reopened = await issueRepository.findById(id);
        expect(reopened?.status).toBe('Open');
    });

    it('should handle optimistic locking correctly', async () => {
        const createUseCase = new CreateIssueUseCase(issueRepository, storageService);
        const id = await createUseCase.execute({
            title: 'Lock Test',
            floor: testFloor,
            createdBy: 'admin',
            userRole: 'Admin',
            photos: []
        });

        // Fetch two instances of the same entity
        const instance1 = await issueRepository.findById(id);
        const instance2 = await issueRepository.findById(id);

        if (!instance1 || !instance2) throw new Error('Failed to fetch instances');

        // Update 1st instance
        instance1.changeStatus('In Progress', 'Admin', 'admin');
        await issueRepository.save(instance1);

        // Try to update 2nd instance (with stale version)
        instance2.changeStatus('Done', 'Admin', 'admin');
        await expect(issueRepository.save(instance2)).rejects.toThrow('楽観的ロックにより更新に失敗しました');
    });
});
