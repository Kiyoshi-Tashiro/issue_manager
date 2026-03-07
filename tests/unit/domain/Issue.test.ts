import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Issue, IssueProps } from '@/domain/models/Issue';

describe('Issue Domain Entity', () => {
    const createMockProps = (): IssueProps => ({
        id: 'test-id',
        issueNumber: 1,
        title: 'Original Title',
        description: 'Original Description',
        status: 'Open',
        category: 'Safety',
        floor: 'floor-1',
        photoUrls: [],
        createdBy: 'user-1',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    it('should create a new issue with version 1 and all given fields', () => {
        const issue = Issue.create({
            title: 'New Issue',
            description: 'New Description',
            category: '安全不備',
            modelPosition: { x: 10, y: 20, z: 30 },
            dbId: 100,
            floor: 'floor-1',
            createdBy: 'user-1'
        });

        expect(issue.version).toBe(1);
        expect(issue.status).toBe('Open');
        // Because fields are accessed via toJSON() or props privately for testing simple values, we can assume if it exists in JSON it's set.
        // Wait, domain entity properties aren't publicly exposed via getters except a few. 
        // We will assert on toJSON().
        const json = issue.toJSON();
        expect(json.description).toBe('New Description');
        expect(json.category).toBe('安全不備');
        expect(json.dbId).toBe(100);
        expect(json.modelPosition).toEqual({ x: 10, y: 20, z: 30 });
    });

    it('should increment version and update fields on update', () => {
        const issue = new Issue(createMockProps());
        const initialVersion = issue.version;

        issue.update({
            title: 'Updated Title',
            description: 'Updated Description',
            category: '品質不良',
            updatedBy: 'user-2'
        }, 'Editor');

        expect(issue.version).toBe(initialVersion + 1);
        expect(issue.toJSON().title).toBe('Updated Title');
        const json = issue.toJSON();
        expect(json.description).toBe('Updated Description');
        expect(json.category).toBe('品質不良');
        expect(json.updatedBy).toBe('user-2');
    });

    it('should allow Admin to reopen Done issues', () => {
        const props = createMockProps();
        props.status = 'Done';
        const issue = new Issue(props);

        expect(() => {
            issue.changeStatus('In Progress', 'Admin');
        }).not.toThrow();

        expect(issue.status).toBe('In Progress');
    });

    it('should prevent regular users from reopening Done issues', () => {
        const props = createMockProps();
        props.status = 'Done';
        const issue = new Issue(props);

        expect(() => {
            issue.changeStatus('Open', 'Editor');
        }).toThrow('完了済みの指摘を再オープンするには管理者権限が必要です。');
    });

    it('should merge metadata on update', () => {
        const props = createMockProps();
        props.metadata = { priority: 'High', tags: ['urgent'] };
        const issue = new Issue(props);

        issue.update({
            metadata: { priority: 'Critical', assignedTo: 'John' },
            updatedBy: 'user-1'
        }, 'Editor');

        const json = issue.toJSON();
        expect(json.metadata.priority).toBe('Critical');
        expect(json.metadata.tags).toContain('urgent');
        expect(json.metadata.assignedTo).toBe('John');
    });
});
