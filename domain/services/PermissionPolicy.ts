import { IssueStatus } from '../models/Issue';

export type UserRole = 'Admin' | 'Editor' | 'Viewer';

export class PermissionPolicy {
    /**
     * 特定の操作が許可されているか判定するルール
     */
    public static canChangeStatus(role: UserRole, currentStatus: IssueStatus, nextStatus: IssueStatus): boolean {
        // ステータス変更は管理者 (Admin) のみ可能
        if (role !== 'Admin') return false;

        return true;
    }

    public static canCreate(role: UserRole): boolean {
        return role === 'Admin' || role === 'Editor';
    }

    public static canEdit(role: UserRole, creatorId: string, requestingUserId: string): boolean {
        if (role === 'Viewer') return false;

        // 管理者は誰の指摘でも編集可能
        if (role === 'Admin') return true;

        // 担当者は自分の作成した指摘のみ編集可能
        if (role === 'Editor') {
            return creatorId === requestingUserId;
        }

        return false;
    }

    public static canDelete(role: UserRole): boolean {
        return role === 'Admin';
    }

    /**
     * UI表示制御用のメタデータ取得
     */
    public static getAllowedActions(role: UserRole, currentStatus: IssueStatus, creatorId: string, requestingUserId: string) {
        return {
            canEdit: this.canEdit(role, creatorId, requestingUserId),
            canDelete: this.canDelete(role),
            canChangeStatus: this.canChangeStatus(role, currentStatus, 'In Progress'),
            isClosed: currentStatus === 'Done'
        };
    }
}
