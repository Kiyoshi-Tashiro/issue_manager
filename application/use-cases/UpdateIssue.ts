import { IssueStatus } from '../../domain/models/Issue';
import { IIssueRepository, IBlobStorageService } from '../interfaces';
import { PermissionPolicy, UserRole } from '../../domain/services/PermissionPolicy';

export interface UpdateIssueCommand {
    issueId: string;
    title?: string;
    description?: string;
    status?: IssueStatus;
    category?: string;
    metadata?: any;
    photos?: { buffer: Buffer; fileName: string; contentType: string }[];
    updatedBy: string;
    userRole: UserRole;
}

export class UpdateIssueUseCase {
    constructor(
        private issueRepository: IIssueRepository,
        private blobStorageService: IBlobStorageService
    ) { }

    async execute(command: UpdateIssueCommand): Promise<void> {
        const issue = await this.issueRepository.findById(command.issueId);
        if (!issue) {
            throw new Error('指摘事項が見つかりません。');
        }

        // 1. 権限チェック (Domain Service)
        if (!PermissionPolicy.canEdit(command.userRole, issue.createdBy, command.updatedBy)) {
            throw new Error('指摘事項を編集する権限がありません。');
        }

        // 2. 写真のアップロード (あれば)
        const photoUrls: string[] = [];
        if (command.photos && command.photos.length > 0) {
            for (const p of command.photos) {
                const url = await this.blobStorageService.uploadFile(p.buffer, p.fileName, p.contentType);
                photoUrls.push(url);
            }
        }

        // 2. ドメインエンティティの更新 (ビジネスルールとバージョン管理)
        // 内部で .photoUrls は直接管理していないため、Repository 側で upsert するか
        // Entity に addPhoto メソッドを持たせるほうがよいが、今回は Repository.save で photoUrls を処理している。
        // entity.toJSON() を Repository で使っているので、Entity の props に追加する必要がある。

        // Entity に photoUrls の getter がなかったので、一時的に update で反映するか、
        // Entity にメソッドを追加する。

        issue.update({
            title: command.title,
            description: command.description,
            status: command.status,
            category: command.category,
            metadata: command.metadata,
            updatedBy: command.updatedBy
        }, command.userRole);

        // 写真URLを追加 (簡易的な反映)
        if (photoUrls.length > 0) {
            (issue as any).props.photoUrls.push(...photoUrls);
        }

        // 3. 保存 (Repository 側で楽観的ロックをチェック)
        await this.issueRepository.save(issue);
    }
}
