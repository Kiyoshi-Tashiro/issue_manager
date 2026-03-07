import { IssueStatus } from '../../domain/models/Issue';
import { IIssueRepository } from '../interfaces';
import { PermissionPolicy, UserRole } from '../../domain/services/PermissionPolicy';

export interface ChangeIssueStatusCommand {
    issueId: string;
    newStatus: IssueStatus;
    userRole: UserRole;
    requestingUserId: string;
}

export class ChangeIssueStatusUseCase {
    constructor(private issueRepository: IIssueRepository) { }

    async execute(command: ChangeIssueStatusCommand): Promise<void> {
        const issue = await this.issueRepository.findById(command.issueId);
        if (!issue) {
            throw new Error('指摘事項が見つかりません。');
        }

        // 1. 権限チェック (Domain Service)
        if (!PermissionPolicy.canChangeStatus(command.userRole, issue.status, command.newStatus)) {
            throw new Error('ステータスを更新する権限がありません。');
        }

        // 2. 状態変更 (Entity Logic - 仕様防御)
        // 内部でドメインエラーが出る可能性がある
        issue.changeStatus(command.newStatus, command.userRole, command.requestingUserId);

        // 3. 保存
        await this.issueRepository.save(issue);
    }
}
