const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const floor = await prisma.floor.findFirst();
    if (!floor) {
        console.log('No floors found. Please check your database.');
        return;
    }

    const count = await prisma.issue.count();
    console.log(`Current issue count: ${count}`);

    if (count === 0) {
        const newIssue = await prisma.issue.create({
            data: {
                title: 'テスト用の指摘事項',
                description: '初期表示確認用',
                status: 'Open',
                createdBy: 'Administrator',
                floorId: floor.id,
                modelPosition: { x: 0, y: 0, z: 0 },
                version: 1,
            }
        });
        console.log('Created test issue:', newIssue.id);
    } else {
        const issues = await prisma.issue.findMany({ take: 5 });
        console.log('Sample issues:', JSON.stringify(issues, null, 2));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
