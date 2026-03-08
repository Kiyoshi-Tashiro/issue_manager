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
            title: '養生不足',
            description: '床面を養生してください。',
            status: 'Open',
            category: '品質不良',
            floor: '7F',
            modelPosition: { x: 48.94, y: 16.76, z: 22.92 },
            createdBy: 'admin-user-id'
        },
        {
            title: '塗装不良',
            description: '防錆塗装の塗り残しがあります。',
            status: 'In Progress',
            category: '品質不良',
            floor: '2F',
            dbId: 20865,
            createdBy: 'editor-a-user-id'
        },
        {
            title: '他設備と干渉',
            description: '電気ラックと干渉しています。',
            status: 'Open',
            category: '施工不備',
            floor: '4F',
            dbId: 26488,
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
