import { IBlobStorageService } from '../../application/interfaces';
import { minioClient, BUCKET_NAME } from './minio';

export class MinioStorageService implements IBlobStorageService {
    async uploadFile(file: Buffer, fileName: string, contentType: string): Promise<string> {
        const metaData = {
            'Content-Type': contentType,
        };

        await minioClient.putObject(BUCKET_NAME, fileName, file, file.length, metaData);

        // 署名付きURLまたは直接URLを返却（ここでは簡易的な構成とする）
        // ローカル環境なので、localhost:9000/bucket/filename 形式
        return `http://localhost:9000/${BUCKET_NAME}/${fileName}`;
    }

    async deleteFile(fileName: string): Promise<void> {
        await minioClient.removeObject(BUCKET_NAME, fileName);
    }
}
