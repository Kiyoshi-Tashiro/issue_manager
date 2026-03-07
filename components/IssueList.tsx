'use client';

import { IssueProps } from '@/domain/models/Issue';

interface IssueListProps {
    issues: IssueProps[];
    selectedIssueId?: string;
    onIssueClick: (issue: IssueProps) => void;
}

export default function IssueList({ issues, selectedIssueId, onIssueClick }: IssueListProps) {
    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h2 className="font-bold text-gray-700" data-testid="issue-list-count">指摘事項 ({issues.length})</h2>
                {/* フィルタボタンなど将来的な拡張用 */}
            </div>
            <div className="flex-1 overflow-y-auto">
                {issues.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        表示する指摘事項がありません。
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {issues.map((issue) => (
                            <li
                                key={issue.id}
                                data-testid={`issue-list-item-${issue.id}`}
                                className={`p-4 hover:bg-blue-50 cursor-pointer transition-colors ${selectedIssueId === issue.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                    }`}
                                onClick={() => onIssueClick(issue)}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${issue.status === 'Open' ? 'bg-red-100 text-red-700' :
                                        issue.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                        {issue.status}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {new Date(issue.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="text-sm font-medium text-gray-900 truncate">
                                    #{issue.issueNumber} {issue.title}
                                </h3>
                                {issue.category && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        カテゴリ: {issue.category}
                                    </p>
                                )}
                                {issue.floor && (
                                    <p className="text-[10px] text-blue-600 font-semibold mt-1">
                                        フロア: {issue.floor}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
