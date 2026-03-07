import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// 依存クラスをモック化
vi.mock('@/application/use-cases/UpdateIssue', () => {
    return {
        UpdateIssueUseCase: class {
            execute = vi.fn().mockRejectedValue(new Error('楽観的ロックにより更新に失敗しました。他のユーザーが既にこの指摘事項を更新しています。'));
        }
    };
});
vi.mock('@/infrastructure/persistence/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn().mockResolvedValue({ id: 'user-1', role: 'Admin' })
        }
    }
}));
vi.mock('@/application/use-cases/GetIssueById', () => {
    return {
        GetIssueByIdUseCase: class {
            execute = vi.fn();
        }
    };
});
vi.mock('@/infrastructure/persistence/PrismaIssueRepository', () => {
    return {
        PrismaIssueRepository: class { }
    };
});
vi.mock('@/infrastructure/storage/MinioStorageService', () => {
    return {
        MinioStorageService: class { }
    };
});

import { PATCH } from '@/app/api/issues/[issueId]/route';

describe('PATCH /api/issues/[issueId]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 409 Conflict when optimistic lock error occurs', async () => {
        const formData = new FormData();
        formData.append('title', 'New Title');

        // Mock request object
        const request = new NextRequest('http://localhost:3000/api/issues/issue-1', {
            method: 'PATCH',
            body: formData,
            headers: new Headers({ 'x-user-id': 'user-1' })
        });

        // Call the API route
        const response = await PATCH(request, { params: Promise.resolve({ issueId: 'issue-1' }) });

        // Output should be 409 Conflict
        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.error).toContain('楽観的ロック');
    });
});
