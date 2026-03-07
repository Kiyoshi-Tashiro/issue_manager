import { Issue } from '../../domain/models/Issue';

export interface IIssueRepository {
    findById(id: string): Promise<Issue | null>;
    findByFloor(floorId: string): Promise<Issue[]>;
    save(issue: Issue): Promise<void>;
    delete(id: string): Promise<void>;
}

export interface IBlobStorageService {
    uploadFile(file: Buffer, fileName: string, contentType: string): Promise<string>;
    deleteFile(fileName: string): Promise<void>;
}
