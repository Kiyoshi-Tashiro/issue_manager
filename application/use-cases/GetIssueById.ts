import { Issue } from '../../domain/models/Issue';
import { IIssueRepository } from '../interfaces';

export class GetIssueByIdUseCase {
    constructor(private issueRepository: IIssueRepository) { }

    async execute(issueId: string): Promise<Issue | null> {
        return await this.issueRepository.findById(issueId);
    }
}
