import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/persistence/prisma';

export async function GET(request: NextRequest) {
    try {
        // Issueテーブルからユニークなfloor(文字列)を抽出して仮想的なフロアリストを作成する
        const uniqueFloors = await prisma.issue.findMany({
            select: { floor: true },
            distinct: ['floor'],
            orderBy: { floor: 'asc' }
        });

        // 以前のFloorオブジェクト({...})の形式にある程度合わせる（UI側の互換性）
        const floors = uniqueFloors.map(f => ({
            id: f.floor,
            name: f.floor,
            urn: 'default-urn'
        }));

        return NextResponse.json(floors);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
