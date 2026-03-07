import { minioClient, BUCKET_NAME } from '../infrastructure/storage/minio';

async function initMinio() {
    console.log(`Checking bucket: ${BUCKET_NAME}`);
    try {
        const exists = await minioClient.bucketExists(BUCKET_NAME);
        if (exists) {
            console.log(`Bucket ${BUCKET_NAME} already exists.`);
        } else {
            await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
            console.log(`Bucket ${BUCKET_NAME} created successfully.`);
        }

        // Set bucket policy to allow public read (optional, but useful for displaying images)
        const policy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: { AWS: ['*'] },
                    Action: ['s3:GetBucketLocation', 's3:ListBucket'],
                    Resource: [`arn:aws:s3:::${BUCKET_NAME}`],
                },
                {
                    Effect: 'Allow',
                    Principal: { AWS: ['*'] },
                    Action: ['s3:GetObject'],
                    Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
                },
            ],
        };
        await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
        console.log(`Bucket policy set to public read.`);
    } catch (error) {
        console.error('Error initializing MinIO:', error);
        process.exit(1);
    }
}

initMinio();
