import { PrismaClient } from '@prisma/client';
import { IIssueRepository } from '../../application/interfaces';
import { Issue, IssueProps, IssueStatus } from '../../domain/models/Issue';
import { prisma } from './prisma';

export class PrismaIssueRepository implements IIssueRepository {
    private prisma: PrismaClient = prisma;

    async findById(id: string): Promise<Issue | null> {
        const data = await this.prisma.issue.findUnique({
            where: { id }
        });

        if (!data) return null;

        return this.mapToEntity(data);
    }

    async findByFloor(floor: string): Promise<Issue[]> {
        const dataList = await this.prisma.issue.findMany({
            where: { floor: floor },
            orderBy: { createdAt: 'desc' },
        });

        return dataList.map((data) => this.mapToEntity(data));
    }

    async save(issue: Issue): Promise<void> {
        const json = issue.toJSON();

        // 楽観的ロックのチェック
        const existing = await this.prisma.issue.findUnique({
            where: { id: json.id },
            select: { version: true }
        });

        if (existing) {
            // 更新の場合
            if (existing.version !== json.version - 1) {
                throw new Error('楽観的ロックにより更新に失敗しました。他のユーザーが既にこの指摘事項を更新しています。最新の情報を読み込んでから再度お試しください。');
            }

            await this.prisma.issue.update({
                where: { id: json.id },
                data: {
                    title: json.title,
                    description: json.description,
                    status: json.status,
                    category: json.category,
                    modelPosition: json.modelPosition as any,
                    dbId: json.dbId,
                    floor: json.floor,
                    updatedBy: json.updatedBy,
                    updatedAt: json.updatedAt,
                    version: json.version,
                    metadata: json.metadata || undefined,
                    photoUrls: json.photoUrls || [],
                }
            });
        } else {
            // 新規作成の場合
            await this.prisma.issue.create({
                data: {
                    id: json.id,
                    title: json.title,
                    description: json.description,
                    status: json.status,
                    category: json.category,
                    modelPosition: json.modelPosition as any,
                    dbId: json.dbId,
                    floor: json.floor,
                    createdBy: json.createdBy,
                    createdAt: json.createdAt,
                    updatedAt: json.updatedAt,
                    version: json.version,
                    metadata: json.metadata || undefined,
                    photoUrls: json.photoUrls || [],
                }
            });
        }
    }

    async delete(id: string): Promise<void> {
        await this.prisma.issue.delete({
            where: { id },
        });
    }

    private mapToEntity(data: any): Issue {
        const props: IssueProps = {
            id: data.id,
            issueNumber: data.issueNumber,
            title: data.title,
            description: data.description || undefined,
            status: data.status as IssueStatus,
            category: data.category || undefined,
            modelPosition: data.modelPosition ? (data.modelPosition as any) : undefined,
            dbId: data.dbId || undefined,
            floor: data.floor,
            photoUrls: data.photoUrls || [],
            createdBy: data.createdBy,
            updatedBy: data.updatedBy || undefined,
            version: data.version,
            metadata: data.metadata || undefined,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        };
        return new Issue(props);
    }
}
