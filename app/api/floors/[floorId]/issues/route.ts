import { IIssueRepository } from '@/application/interfaces';
import { PrismaIssueRepository } from '@/infrastructure/persistence/PrismaIssueRepository';
import { GetIssuesByFloorQuery } from '@/application/use-cases/GetIssuesByFloor';
import { NextResponse } from 'next/server';

const issueRepo: IIssueRepository = new PrismaIssueRepository();
const getIssuesQuery = new GetIssuesByFloorQuery(issueRepo);

export async function GET(req: Request, { params }: { params: Promise<{ floorId: string }> }) {
    try {
        const floorId = (await params).floorId;
        const issues = await getIssuesQuery.execute(floorId);
        return NextResponse.json(issues);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
    }
}
