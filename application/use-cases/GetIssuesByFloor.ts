import { IIssueRepository } from '../interfaces';
import { IssueProps } from '../../domain/models/Issue';

export class GetIssuesByFloorQuery {
    constructor(private issueRepository: IIssueRepository) { }

    async execute(floor: string): Promise<IssueProps[]> {
        const issues = await this.issueRepository.findByFloor(floor);

        // UI用にJSON形式に変換して返却
        return issues.map(issue => issue.toJSON());
    }
}
