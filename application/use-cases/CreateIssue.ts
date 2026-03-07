import { Issue, IssueLocation } from '../../domain/models/Issue';
import { IIssueRepository, IBlobStorageService } from '../interfaces';
import { PermissionPolicy, UserRole } from '../../domain/services/PermissionPolicy';

export interface CreateIssueCommand {
    title: string;
    description?: string;
    category?: string;
    modelPosition?: IssueLocation;
    dbId?: number;
    floor: string;
    createdBy: string;
    userRole: UserRole;
    photos: { buffer: Buffer; name: string; type: string }[];
}

export class CreateIssueUseCase {
    constructor(
        private issueRepository: IIssueRepository,
        private storageService: IBlobStorageService
    ) { }

    async execute(command: CreateIssueCommand): Promise<string> {
        // 1. 権限チェック
        if (!PermissionPolicy.canCreate(command.userRole)) {
            throw new Error('指摘事項を作成する権限がありません。');
        }

        // 2. 写真のアップロード
        const photoUrls: string[] = [];
        for (const photo of command.photos) {
            const fileName = `${crypto.randomUUID()}-${photo.name}`;
            const url = await this.storageService.uploadFile(photo.buffer, fileName, photo.type);
            photoUrls.push(url);
        }

        // 3. エンティティの生成
        const issue = Issue.create({
            title: command.title,
            description: command.description,
            category: command.category,
            modelPosition: command.modelPosition,
            dbId: command.dbId,
            floor: command.floor,
            photoUrls: photoUrls,
            createdBy: command.createdBy,
        });

        // 4. 保存
        await this.issueRepository.save(issue);

        return issue.id;
    }
}
