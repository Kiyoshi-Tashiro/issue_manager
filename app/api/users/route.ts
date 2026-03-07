import { NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/persistence/prisma';

export async function GET() {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, displayName: true, role: true },
            orderBy: { role: 'asc' }
        });
        return NextResponse.json(users);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
