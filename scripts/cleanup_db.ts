import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching issues to cleanup...');
    const allIssues = await prisma.issue.findMany({
        select: { id: true, title: true }
    });

    const toDelete = allIssues.filter(issue =>
        issue.title.includes('Multi-Issue Test') ||
        issue.title.includes('Marker Visibility Test') ||
        issue.title.includes('Test Issue') ||
        issue.title === 'Stress Test' ||
        issue.title.includes('テスト指摘')
    );

    console.log(`Found ${toDelete.length} issues to delete.`);

    for (const issue of toDelete) {
        console.log(`Deleting: ${issue.title} (${issue.id})`);
        await prisma.issue.delete({
            where: { id: issue.id }
        });
    }

    console.log('Cleanup completed.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
