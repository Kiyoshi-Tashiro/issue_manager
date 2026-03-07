import { NextRequest, NextResponse } from 'next/server';
import { GetIssueByIdUseCase } from '@/application/use-cases/GetIssueById';
import { UpdateIssueUseCase } from '@/application/use-cases/UpdateIssue';
import { PrismaIssueRepository } from '@/infrastructure/persistence/PrismaIssueRepository';
import { MinioStorageService } from '@/infrastructure/storage/MinioStorageService';
import { prisma } from '@/infrastructure/persistence/prisma';

const issueRepository = new PrismaIssueRepository();
const storageService = new MinioStorageService();
const getIssueByIdUseCase = new GetIssueByIdUseCase(issueRepository);
const updateIssueUseCase = new UpdateIssueUseCase(issueRepository, storageService);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ issueId: string }> }
) {
    const { issueId } = await params;
    try {
        const issue = await getIssueByIdUseCase.execute(issueId);
        if (!issue) {
            return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        }
        return NextResponse.json(issue.toJSON());
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ issueId: string }> }
) {
    const { issueId } = await params;
    try {
        const formData = await request.formData();
        const requestUserId = request.headers.get('x-user-id');
        if (!requestUserId) {
            return NextResponse.json({ error: 'Unauthorized: Missing x-user-id header' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { id: requestUserId } });
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized: User not found' }, { status: 401 });
        }

        const title = formData.get('title') as string || undefined;
        const description = formData.get('description') as string || undefined;
        const status = formData.get('status') as any || undefined;
        const category = formData.get('category') as string || undefined;
        const metadataStr = formData.get('metadata') as string;
        const metadata = metadataStr ? JSON.parse(metadataStr) : undefined;
        const updatedBy = user.id;

        // 写真ファイルの抽出
        const photos: { buffer: Buffer; fileName: string; contentType: string }[] = [];
        const files = formData.getAll('photos') as File[];

        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            photos.push({
                buffer,
                fileName: file.name,
                contentType: file.type,
            });
        }

        await updateIssueUseCase.execute({
            issueId,
            title,
            description,
            status,
            category,
            metadata,
            photos,
            updatedBy,
            userRole: user.role as any,
        });

        const updated = await getIssueByIdUseCase.execute(issueId);
        return NextResponse.json(updated?.toJSON());
    } catch (error: any) {
        console.error('Update Issue Error:', error);

        if (error.message && error.message.includes('楽観的ロック')) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
