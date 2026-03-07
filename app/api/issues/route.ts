import { NextRequest, NextResponse } from 'next/server';
import { GetIssuesByFloorQuery } from '@/application/use-cases/GetIssuesByFloor';
import { CreateIssueUseCase } from '@/application/use-cases/CreateIssue';
import { PrismaIssueRepository } from '@/infrastructure/persistence/PrismaIssueRepository';
import { MinioStorageService } from '@/infrastructure/storage/MinioStorageService';
import { prisma } from '@/infrastructure/persistence/prisma';

// DIのセットアップ（本来はDIコンテナ等で管理すべきだが簡略化）
const issueRepository = new PrismaIssueRepository();
const storageService = new MinioStorageService();
const getIssuesQuery = new GetIssuesByFloorQuery(issueRepository);
const createIssueUseCase = new CreateIssueUseCase(issueRepository, storageService);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const floorId = searchParams.get('floorId');

    try {
        let issues;
        if (floorId) {
            issues = await getIssuesQuery.execute(floorId);
        } else {
            // floorIdがない場合は全件取得（リポジトリのfindManyを使用）
            const allIssues = await prisma.issue.findMany({
                orderBy: { createdAt: 'desc' }
            });
            // エンティティ変換が必要だが、ここではユースケースと同様のtoJSON形式を模倣
            issues = allIssues.map((data: any) => ({
                ...data,
                photoUrls: data.photoUrls || []
            }));
        }
        return NextResponse.json(issues);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const requestUserId = request.headers.get('x-user-id');
        if (!requestUserId) {
            return NextResponse.json({ error: 'Unauthorized: Missing x-user-id header' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { id: requestUserId } });
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized: User not found' }, { status: 401 });
        }

        const formData = await request.formData();
        const title = formData.get('title') as string;
        const description = formData.get('description') as string | undefined;
        const category = formData.get('category') as string | undefined;
        const floor = formData.get('floor') as string;
        const createdBy = user.id;
        const modelPositionStr = formData.get('modelPosition') as string;
        const dbIdStr = formData.get('dbId') as string;

        const modelPosition = modelPositionStr ? JSON.parse(modelPositionStr) : undefined;
        const dbId = dbIdStr ? parseInt(dbIdStr, 10) : undefined;

        // 写真ファイルの抽出
        const photos: { buffer: Buffer; name: string; type: string }[] = [];
        const files = formData.getAll('photos') as File[];

        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            photos.push({
                buffer,
                name: file.name,
                type: file.type,
            });
        }

        const issueId = await createIssueUseCase.execute({
            title,
            description,
            category,
            floor,
            createdBy,
            modelPosition,
            dbId,
            userRole: user.role as any,
            photos,
        });

        // 作成されたissueの完全データをDBから取得してフロントに返す
        const createdIssue = await prisma.issue.findUnique({ where: { id: issueId } }) as any;
        return NextResponse.json({ ...createdIssue, photoUrls: createdIssue?.photoUrls || [] }, { status: 201 });
    } catch (error: any) {
        console.error('Create Issue Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
