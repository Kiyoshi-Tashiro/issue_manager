import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    // 1. ユーザーの初期化
    const users = [
        { id: 'admin-user-id', displayName: '管理者', role: 'Admin' },
        { id: 'editor-a-user-id', displayName: '担当者A', role: 'Editor' },
        { id: 'editor-b-user-id', displayName: '担当者B', role: 'Editor' },
        { id: 'viewer-user-id', displayName: '閲覧者', role: 'Viewer' }
    ];

    for (const user of users) {
        await prisma.user.upsert({
            where: { id: user.id },
            update: { displayName: user.displayName, role: user.role },
            create: { id: user.id, displayName: user.displayName, role: user.role },
        });
    }
    console.log('Users initialized.');

    // 2. 既存の不整合データを削除 (リセット)
    await prisma.issue.deleteMany({});
    console.log('Old issues cleared.');

    // 3. サンプル指摘事項の投入 (各フロアに対応)
    // モデル上、floor は String 型。
    const issues = [
        {
            title: '1F エントランス壁の汚れ',
            description: '壁面に塗装の剥がれがあります。',
            status: 'Open',
            category: '品質不良',
            floor: '1F',
            modelPosition: { x: -5.0, y: 2.0, z: -10.0 },
            createdBy: 'admin-user-id'
        },
        {
            title: '2F 廊下の照明不点',
            description: '照明が切れています。交換が必要です。',
            status: 'In Progress',
            category: '品質不良',
            floor: '2F',
            modelPosition: { x: 10.0, y: 14.5, z: 5.0 },
            createdBy: 'editor-a-user-id'
        },
        {
            title: '4F 窓枠の隙間',
            description: 'サッシの建て付けが悪く、風切り音が発生しています。',
            status: 'Open',
            category: '品質不良',
            floor: '4F',
            modelPosition: { x: -2.0, y: 24.0, z: 15.0 },
            createdBy: 'admin-user-id'
        }
    ];

    for (const issue of issues) {
        await prisma.issue.create({
            data: {
                ...issue,
                projectId: 'default-project',
                version: 1
            }
        });
    }
    console.log('Sample issues with correct floors initialized.');

    console.log('Seeding finished.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
