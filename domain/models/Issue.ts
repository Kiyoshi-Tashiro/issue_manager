export type IssueStatus = 'Open' | 'In Progress' | 'Done';

export interface IssueLocation {
    x: number;
    y: number;
    z: number;
}

export interface IssueProps {
    id: string;
    issueNumber: number;
    title: string;
    description?: string;
    status: IssueStatus;
    category?: string;
    modelPosition?: IssueLocation;
    dbId?: number;
    floor: string;
    photoUrls: string[];
    createdBy: string;
    updatedBy?: string;
    version: number;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
}

export class Issue {
    private props: IssueProps;

    constructor(props: IssueProps) {
        this.props = props;
    }

    public static create(params: {
        title: string;
        description?: string;
        category?: string;
        modelPosition?: IssueLocation;
        dbId?: number;
        floor: string;
        photoUrls?: string[];
        createdBy: string;
        metadata?: any;
    }): Issue {
        const now = new Date();
        return new Issue({
            id: crypto.randomUUID(),
            issueNumber: 0, // Assigned by database upon creation
            title: params.title,
            description: params.description,
            status: 'Open',
            category: params.category,
            modelPosition: params.modelPosition,
            dbId: params.dbId,
            floor: params.floor,
            photoUrls: params.photoUrls || [],
            createdBy: params.createdBy,
            version: 1,
            metadata: params.metadata,
            createdAt: now,
            updatedAt: now,
        });
    }

    // Getters
    // Getters
    get id() { return this.props.id; }
    get status() { return this.props.status; }
    get version() { return this.props.version; }
    get createdBy() { return this.props.createdBy; }

    // 属性の一括更新 (楽観的ロックの対象)
    public update(params: {
        title?: string;
        description?: string;
        status?: IssueStatus;
        category?: string;
        metadata?: any;
        updatedBy: string;
    }, userRole: string): void {
        const isStatusChanging = params.status && params.status !== this.props.status;

        if (isStatusChanging) {
            // changeStatus 内部でも version が上がるので、ここでは副作用のみ利用する
            this.changeStatus(params.status!, userRole);
            // changeStatus が version を +1 する
        }

        if (params.title !== undefined) this.props.title = params.title;
        if (params.description !== undefined) this.props.description = params.description;
        if (params.category !== undefined) this.props.category = params.category;
        if (params.metadata !== undefined) this.props.metadata = { ...this.props.metadata, ...params.metadata };

        this.props.updatedBy = params.updatedBy;
        this.props.updatedAt = new Date();

        // ステータス変更がなかった場合のみ、ここで version をインクリメントする
        // (ステータス変更があった場合は changeStatus 内で既にインクリメントされている)
        if (!isStatusChanging) {
            this.props.version += 1;
        }
    }

    // ビジネスルール: ステータス変更
    public changeStatus(newStatus: IssueStatus, userRole: string, updatedBy?: string): void {
        if (this.props.status === 'Done' && newStatus !== 'Done' && userRole !== 'Admin') {
            throw new Error('完了済みの指摘を再オープンするには管理者権限が必要です。');
        }

        this.props.status = newStatus;
        if (updatedBy) this.props.updatedBy = updatedBy;
        this.props.updatedAt = new Date();
        this.props.version += 1; // バージョンを更新
    }

    public toJSON() {
        return { ...this.props };
    }
}
