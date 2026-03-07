import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/infrastructure/persistence/prisma';
import { PrismaIssueRepository } from '@/infrastructure/persistence/PrismaIssueRepository';
import { GetIssuesByFloorQuery } from '@/application/use-cases/GetIssuesByFloor';
import { Issue } from '@/domain/models/Issue';

describe('GetIssuesByFloor Integration Test', () => {
    const issueRepository = new PrismaIssueRepository();
    const floorA = 'FLOOR-A-GET-TEST';
    const floorB = 'FLOOR-B-GET-TEST';

    beforeAll(async () => {
        await prisma.$connect();
        await prisma.issue.deleteMany({ where: { floor: { in: [floorA, floorB] } } });

        // テストデータの作成
        // Floor A: 2件
        await prisma.issue.create({
            data: {
                id: crypto.randomUUID(),
                title: 'Issue A1',
                floor: floorA,
                createdBy: 'user-1',
                status: 'Open'
            }
        });
        await prisma.issue.create({
            data: {
                id: crypto.randomUUID(),
                title: 'Issue A2',
                floor: floorA,
                createdBy: 'user-1',
                status: 'Done'
            }
        });

        // Floor B: 1件
        await prisma.issue.create({
            data: {
                id: crypto.randomUUID(),
                title: 'Issue B1',
                floor: floorB,
                createdBy: 'user-1',
                status: 'Open'
            }
        });
    });

    afterAll(async () => {
        await prisma.issue.deleteMany({ where: { floor: { in: [floorA, floorB] } } });
        await prisma.$disconnect();
    });

    it('should return only issues for the specified floor', async () => {
        const query = new GetIssuesByFloorQuery(issueRepository);

        const resultsA = await query.execute(floorA);
        expect(resultsA).toHaveLength(2);
        expect(resultsA.every(i => i.floor === floorA)).toBe(true);

        const resultsB = await query.execute(floorB);
        expect(resultsB).toHaveLength(1);
        expect(resultsB[0].floor === floorB).toBe(true);
    });

    it('should return an empty array if floor has no issues', async () => {
        const query = new GetIssuesByFloorQuery(issueRepository);
        const results = await query.execute('NON-EXISTENT-FLOOR');
        expect(results).toHaveLength(0);
    });
});
