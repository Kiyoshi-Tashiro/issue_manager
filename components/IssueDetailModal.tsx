'use client';

import { useState, useEffect } from 'react';
import { IssueProps, IssueStatus } from '@/domain/models/Issue';
import { useUser } from '@/app/contexts/UserContext';

interface IssueDetailModalProps {
    issueId: string;
    onClose: () => void;
    onUpdate: (updatedIssue: IssueProps) => void;
}

export default function IssueDetailModal({ issueId, onClose, onUpdate }: IssueDetailModalProps) {
    const [issue, setIssue] = useState<IssueProps | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit states
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<IssueStatus>('Open');
    const [category, setCategory] = useState('');
    const [newPhotos, setNewPhotos] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    const { selectedUser } = useUser();

    // 権限チェック (UX防御)
    const canEdit = selectedUser && (
        selectedUser.role === 'Admin' ||
        (selectedUser.role === 'Editor' && issue?.createdBy === selectedUser.id)
    );
    const canChangeStatus = selectedUser?.role === 'Admin';

    useEffect(() => {
        fetchIssue();
    }, [issueId]);

    useEffect(() => {
        // Generate preview URLs for new photos
        const urls = newPhotos.map(file => URL.createObjectURL(file));
        setPreviewUrls(urls);

        // Cleanup function to revoke URLs
        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [newPhotos]);

    const fetchIssue = async () => {
        setIsLoading(true);
        console.log('[DEBUG] IssueDetailModal fetchIssue start for issueId:', issueId);
        try {
            const res = await fetch(`/api/issues/${issueId}`);
            console.log('[DEBUG] IssueDetailModal fetchIssue res.ok:', res.ok, res.status);
            if (res.ok) {
                const data = await res.json();
                console.log('[DEBUG] IssueDetailModal fetchIssue data:', JSON.stringify(data));
                setIssue(data);
                setTitle(data.title);
                setDescription(data.description ?? '');
                setStatus(data.status);
                setCategory(data.category ?? '品質不良');
            } else {
                setError('指摘事項の取得に失敗しました。');
            }
        } catch (err) {
            console.error('[DEBUG] IssueDetailModal fetchIssue error:', err);
            setError('ネットワークエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!issue) return;
        setIsSaving(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('status', status);
            formData.append('category', category);
            formData.append('version', issue.version.toString()); // 楽観的ロック用 (実際にはPATCHで検証)

            newPhotos.forEach(file => {
                formData.append('photos', file);
            });

            const res = await fetch(`/api/issues/${issueId}`, {
                method: 'PATCH',
                headers: {
                    'x-user-id': selectedUser ? selectedUser.id : ''
                },
                body: formData,
            });

            if (res.ok) {
                const updated = await res.json();
                onUpdate(updated);
                onClose(); // Close modal after successful save
            } else {
                const data = await res.json();
                setError(data.error || '更新に失敗しました。');
            }
        } catch (err) {
            setError('保存中にエラーが発生しました。');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white p-8 rounded-xl shadow-xl flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>読み込み中...</span>
                </div>
            </div>
        );
    }

    if (!issue) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" data-testid="issue-detail-modal">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">指摘事項詳細</h2>
                        <p className="text-xs text-gray-400 mt-1">ID: {issue.id} | Ver: {issue.version}</p>
                    </div>
                    <button
                        onClick={onClose}
                        data-testid="issue-detail-close-btn"
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Title & Description */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">タイトル</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-blue-600 whitespace-nowrap">#{issue.issueNumber}</span>
                                    <input
                                        type="text"
                                        value={title}
                                        data-testid="issue-detail-title-input"
                                        onChange={e => setTitle(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">説明</label>
                                <textarea
                                    rows={4}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                            </div>
                        </div>

                        {/* Status & Category */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">ステータス</label>
                                <select
                                    value={status}
                                    data-testid="issue-detail-status-select"
                                    onChange={e => setStatus(e.target.value as IssueStatus)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                                    disabled={!canChangeStatus || !canEdit}
                                >
                                    <option value="Open">Open</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Done">Done</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">カテゴリ</label>
                                <select
                                    value={category}
                                    data-testid="issue-detail-category-select"
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    <option value="品質不良">品質不良</option>
                                    <option value="安全不備">安全不備</option>
                                    <option value="施工不備">施工不備</option>
                                    <option value="設計変更">設計変更</option>
                                    <option value="その他">その他</option>
                                </select>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span className="font-semibold">フロア:</span>
                                    <span className="font-medium text-blue-600">{issue.floor}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span className="font-semibold">作成者:</span>
                                    <span>{issue.createdBy}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span className="font-semibold">位置情報:</span>
                                    <span className="font-mono text-[10px] break-all max-w-[150px] text-right">
                                        {issue.dbId !== null && issue.dbId !== undefined ? `dbId: ${issue.dbId}` :
                                            issue.modelPosition ? `x:${issue.modelPosition.x.toFixed(2)} y:${issue.modelPosition.y.toFixed(2)} z:${issue.modelPosition.z.toFixed(2)}` : 'N/A'}
                                    </span>
                                </div>
                                <div className="pt-2 border-t border-gray-200">
                                    <p className="text-[10px] text-gray-500">作成日: {new Date(issue.createdAt).toLocaleString()}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">最終更新: {new Date(issue.updatedAt).toLocaleString()} ({issue.updatedBy || 'システム'})</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Photos Section */}
                    <div className="space-y-3">
                        <label className="block text-sm font-semibold text-gray-700">写真ギャラリー</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {issue.photoUrls.map((url, idx) => (
                                <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 group">
                                    <img src={url} alt={`Photo ${idx}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                </div>
                            ))}
                            {newPhotos.map((file, idx) => (
                                <div key={`new-${idx}`} className="relative aspect-video rounded-lg overflow-hidden border-2 border-blue-400 group shadow-md" data-testid="new-photo-preview">
                                    <img src={previewUrls[idx]} alt={`New Photo ${idx}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setNewPhotos(prev => prev.filter((_, i) => i !== idx));
                                            }}
                                            className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg transform scale-90 group-hover:scale-100 transition-transform"
                                            title="削除"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-600 text-white text-[8px] font-bold rounded uppercase tracking-wider">
                                        新規
                                    </div>
                                </div>
                            ))}
                            <label className="aspect-video flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-[10px] text-gray-400 mt-1">追加</span>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    disabled={!canEdit}
                                    onChange={e => {
                                        if (e.target.files) {
                                            setNewPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        data-testid="issue-detail-cancel-btn"
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        キャンセル
                    </button>
                    {canEdit && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            data-testid="issue-detail-save-btn"
                            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    保存中...
                                </>
                            ) : '更新内容を保存'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
