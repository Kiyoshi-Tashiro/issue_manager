'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ApsViewer from '@/components/viewer/ApsViewer';
import IssueList from '@/components/IssueList';
import IssueDetailModal from '@/components/IssueDetailModal';
import { IssueProps } from '@/domain/models/Issue';
import { useUser } from '@/app/contexts/UserContext';
import UserSelector from '@/components/UserSelector';

// State shape for the creation dialog
interface CreationDialogState {
    pos: { x: number; y: number; z: number } | null;
    dbId: number | null;
}

interface NotificationState {
    message: string;
    type: 'info' | 'warning' | 'error';
}
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

export default function ProjectDashboardWithBoundary() {
    return (
        <PageErrorBoundary>
            <ProjectDashboard />
        </PageErrorBoundary>
    );
}

function ProjectDashboard() {
    const [token, setToken] = useState<string | null>(null);
    const [projectUrn, setProjectUrn] = useState<string | null>(null);
    const [selectedFloor, setSelectedFloor] = useState<any>(null);
    const [floors, setFloors] = useState<any[]>([]);

    const { selectedUser } = useUser();

    useEffect(() => {
        fetch('/api/aps/token')
            .then(res => res.json())
            .then(data => {
                setToken(data.access_token);
                setProjectUrn(data.urn);
            })
            .catch(err => console.error('Failed to fetch APS token:', err));
    }, []);

    // Issue data
    const [allIssues, setAllIssues] = useState<IssueProps[]>([]);
    const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>(undefined);
    const [showDetailId, setShowDetailId] = useState<string | null>(null);

    // Issue creation dialog state (replaces window.prompt)
    const [creationDialog, setCreationDialog] = useState<CreationDialogState | null>(null);
    const [newIssueTitle, setNewIssueTitle] = useState('');
    const [newIssueDescription, setNewIssueDescription] = useState('');
    const [newIssueCategory, setNewIssueCategory] = useState('品質不良');
    const [newIssuePhotos, setNewIssuePhotos] = useState<File[]>([]);
    const [newIssuePreviewUrls, setNewIssuePreviewUrls] = useState<string[]>([]);
    const [creationError, setCreationError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Notification state
    const [notification, setNotification] = useState<NotificationState | null>(null);
    const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Generate preview URLs for new issue photos
        const urls = newIssuePhotos.map(file => URL.createObjectURL(file));
        setNewIssuePreviewUrls(urls);

        // Cleanup function to revoke URLs
        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [newIssuePhotos]);

    const showNotification = useCallback((message: string, type: 'info' | 'warning' | 'error' = 'info') => {
        if (notificationTimerRef.current) {
            clearTimeout(notificationTimerRef.current);
        }
        setNotification({ message, type });
        notificationTimerRef.current = setTimeout(() => {
            setNotification(null);
        }, 10000); // 10 seconds for readability
    }, []);

    // Viewer state
    const [viewer, setViewer] = useState<any>(null);
    const viewerInitializedRef = useRef<boolean>(false);
    // Keep selectedFloor accessible in callbacks without stale closure
    const selectedFloorRef = useRef<any>(null);
    selectedFloorRef.current = selectedFloor;


    // Common filtering logic for both List and Pins
    const filteredIssues = useMemo(() => {
        if (!selectedFloor || selectedFloor.id === 'all-floors') {
            return allIssues;
        }
        // 指摘事項の floor フィールド（文字列 "1F", "2F" 等）と
        // 選択されたフロアの name（"1F", "2F" 等）を比較するように修正
        return allIssues.filter(issue => issue.floor === selectedFloor.name);
    }, [allIssues, selectedFloor]);

    // Fetch ALL issues on mount and when user changes
    useEffect(() => {
        fetch('/api/issues', {
            headers: {
                'x-user-id': selectedUser ? selectedUser.id : ''
            }
        })
            .then(res => res.json())
            .then(data => {
                console.log('[DEBUG] Fetched all issues:', data.length);
                setAllIssues(Array.isArray(data) ? data : []);
            })
            .catch(err => {
                console.error('Failed to fetch issues:', err);
                setAllIssues([]);
            });
    }, [selectedUser]);

    // Update Viewer markers when filtered issues change or viewer becomes ready
    useEffect(() => {
        if (viewer) {
            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension') as any;
            if (ext && typeof ext.setIssues === 'function') {
                console.log('[DEBUG] Syncing filtered issues to viewer extension. Count:', filteredIssues.length);
                ext.setIssues(filteredIssues);
            }
        }
    }, [filteredIssues, viewer]);

    const handleViewerReady = useCallback((newViewer: any) => {
        if (viewerInitializedRef.current && viewer === newViewer) return;

        console.log('[DEBUG] handleViewerReady initialized');
        setViewer(newViewer);
        viewerInitializedRef.current = true;

        const processFloors = (floorData: any[]) => {
            const modelFloors = floorData.map((f: any) => ({
                id: f.id || f.index.toString(),
                name: f.name,
                urn: projectUrn,
                elevation: f.z // Store elevation for debugging
            }));

            const allFloorsOption = { id: 'all-floors', name: '全フロア表示', urn: projectUrn };

            setFloors(prev => {
                if (prev.length > 0) return prev;
                console.log('[DEBUG] Floors set from Viewer data:', modelFloors.length);
                modelFloors.forEach(f => console.log(`[DEBUG] Floor: ${f.name}, Elevation: ${f.elevation}`));
                return [allFloorsOption, ...modelFloors];
            });
            setSelectedFloor((prev: any) => prev || allFloorsOption);
        };

        const checkLevels = () => {
            const levelsExt = newViewer.getExtension('Autodesk.AEC.LevelsExtension');
            // APS AEC LevelsExtension usually stores floors in `.floorSelector.floorData` or `.floorData`
            let activeFloorData = null;
            if (levelsExt) {
                if (levelsExt.floorSelector && levelsExt.floorSelector.floorData) {
                    activeFloorData = levelsExt.floorSelector.floorData;
                } else if (levelsExt.floorData) {
                    activeFloorData = levelsExt.floorData;
                }
            }

            if (activeFloorData && activeFloorData.length > 0) {
                processFloors(activeFloorData);
                return true;
            }
            return false;
        };

        if (!checkLevels()) {
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (attempts > 15) { // Timeout check
                    clearInterval(interval);
                    if (attempts > 15) fallbackToDbFloors();
                    return;
                }

                if (checkLevels()) {
                    clearInterval(interval);
                }
            }, 1000);
        }

        function fallbackToDbFloors() {
            fetch('/api/floors')
                .then(res => res.json())
                .then(dbFloors => {
                    const allFloorsOption = { id: 'all-floors', name: '全フロア表示', urn: projectUrn };
                    if (dbFloors && dbFloors.length > 0) {
                        setFloors(prev => prev.length > 0 ? prev : [allFloorsOption, ...dbFloors]);
                        setSelectedFloor((prev: any) => prev || allFloorsOption);
                    } else {
                        setFloors(prev => prev.length > 0 ? prev : [allFloorsOption]);
                        setSelectedFloor((prev: any) => prev || allFloorsOption);
                    }
                });
        }

        const ext = newViewer.getExtension('Autodesk.Aps.IssueExtension') as any;
        if (ext) {
            ext.activateInteractionTool((pos: any, _dbId: any) => {
                if (selectedFloorRef.current?.id === 'all-floors') {
                    showNotification('特定フロアを表示してから、再度クリックしてください', 'warning');
                    return;
                }
                setNewIssueTitle('');
                setNewIssueDescription('');
                setNewIssueCategory('品質不良');
                setCreationDialog({
                    pos: pos ? { x: pos.x, y: pos.y, z: pos.z } : null,
                    dbId: _dbId ?? null,
                });
            }, (markerIssueId: string) => {
                setShowDetailId(markerIssueId);
                setSelectedIssueId(markerIssueId);
            });

            // Expose a global testing helper to bypass canvas event interception
            if (typeof window !== 'undefined') {
                (window as any).__E2E_TRIGGER_ISSUE_CREATE__ = (pos?: any, dbId?: any) => {
                    if (selectedFloorRef.current?.id === 'all-floors') {
                        showNotification('特定フロアを表示してから、再度クリックしてください', 'warning');
                        return;
                    }
                    setNewIssueTitle('');
                    setNewIssueDescription('');
                    setNewIssueCategory('品質不良');
                    setCreationDialog({
                        pos: pos || { x: 10, y: 20, z: 30 },
                        dbId: dbId ?? null,
                    });
                };
            }
        }
    }, [projectUrn]);

    const handleCreateIssue = async () => {
        console.log('[DEBUG-TRACE] handleCreateIssue started. Title:', newIssueTitle, 'Floor:', selectedFloor?.id);
        if (!newIssueTitle.trim() || !selectedFloor) {
            console.log('[DEBUG-TRACE] Validation failed. Title or floor missing.');
            return;
        }

        setIsSubmitting(true);
        setCreationError(null); // Clear previous error
        console.log('[DEBUG-TRACE] State set to submitting, previous error cleared');

        try {
            const formData = new FormData();
            formData.append('title', newIssueTitle);
            formData.append('description', newIssueDescription);
            formData.append('category', newIssueCategory);
            formData.append('floor', selectedFloor.name);
            if (creationDialog?.pos) {
                formData.append('modelPosition', JSON.stringify(creationDialog.pos));
            }
            if (creationDialog?.dbId !== null && creationDialog?.dbId !== undefined) {
                formData.append('dbId', creationDialog.dbId.toString());
            }

            // Append photos
            newIssuePhotos.forEach(file => {
                formData.append('photos', file);
            });

            console.log('[DEBUG-TRACE] Sending POST request to /api/issues');
            const res = await fetch('/api/issues', {
                method: 'POST',
                headers: {
                    'x-user-id': selectedUser ? selectedUser.id : ''
                },
                body: formData,
            });
            console.log('[DEBUG-TRACE] Received response. res.ok:', res.ok, 'status:', res.status);

            if (res.ok) {
                console.log('[DEBUG-TRACE] Response is OK, parsing JSON...');
                const newIssue = await res.json();
                console.log('[DEBUG-TRACE] Parsed new issue:', newIssue);
                setAllIssues(prev => [...prev, newIssue]);
                setCreationDialog(null);
                setNewIssueTitle('');
                setNewIssueDescription('');
                setNewIssueCategory('品質不良');
                setNewIssuePhotos([]);
                setCreationError(null);
                console.log('[DEBUG-TRACE] States reset successfully.');
            } else {
                console.log('[DEBUG-TRACE] Response is NOT OK. Attempting to parse error data...');
                let errorMessage = '指摘事項の作成に失敗しました。';
                try {
                    const errorData = await res.json();
                    console.log('[DEBUG-TRACE] Parsed errorData:', errorData);
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    console.error('[DEBUG-TRACE] Failed to parse error response as JSON:', parseError);
                    errorMessage = `サーバーエラーが発生しました (Status: ${res.status})`;
                }
                console.error('[DEBUG-TRACE] Calling setCreationError with:', errorMessage);
                setCreationError(errorMessage);
            }
        } catch (error: any) {
            console.error('[DEBUG-TRACE] Exception in handleCreateIssue catch block:', error);
            setCreationError('ネットワークエラーまたはサーバー停止が発生しました。');
        } finally {
            console.log('[DEBUG-TRACE] Finally block reached. Resetting isSubmitting.');
            setIsSubmitting(false);
        }
    };

    const handleIssueClick = (issue: IssueProps) => {
        console.log('[DEBUG] Issue clicked:', issue.id);
        setSelectedIssueId(issue.id);
        setShowDetailId(issue.id); // Open detail view on first click for better UX
        if (viewer) {
            const ext = viewer.getExtension('Autodesk.Aps.IssueExtension') as any;
            if (ext && typeof ext.zoomToIssue === 'function') {
                ext.zoomToIssue(issue.id);
            }
        }
    };

    const handleIssueUpdate = (updated: IssueProps) => {
        setAllIssues(prev => prev.map(issue => issue.id === updated.id ? updated : issue));
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        APS Issue Manager
                    </h1>
                    <select
                        data-testid="floor-select"
                        className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg border border-gray-200 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 min-w-[120px]"
                        value={selectedFloor?.id || ''}
                        onChange={(e) => {
                            const floor = floors.find(f => f.id === e.target.value);
                            setSelectedFloor(floor);
                        }}
                    >
                        {floors.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                    <UserSelector />
                </div>
                <div className="flex items-center gap-4 text-sm font-medium text-gray-500">
                    <span>Project: Test Building</span>
                    <div className="h-4 w-px bg-gray-300" />
                    <span>User: Administrator</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex flex-1 overflow-hidden">
                {/* 3D Viewer Side */}
                <div className="flex-1 relative bg-slate-900 shadow-inner">
                    {token && projectUrn ? (
                        <ApsViewer
                            token={token}
                            urn={projectUrn}
                            selectedFloor={selectedFloor}
                            onViewerReady={handleViewerReady}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-blue-200 gap-4">
                            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            <p className="animate-pulse">Loading WebGL Viewer...</p>
                        </div>
                    )}
                </div>

                {/* Issue List Side */}
                <aside className="w-96 bg-white border-l border-gray-200 shadow-2xl z-10 shadow-gray-200">
                    <IssueList
                        issues={filteredIssues}
                        selectedIssueId={selectedIssueId}
                        onIssueClick={handleIssueClick}
                    />
                </aside>
            </main>

            {/* Issue Creation Modal (replaces window.prompt) */}
            {creationDialog && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setCreationDialog(null); }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">新しい指摘事項を作成</h2>
                            {creationDialog.pos && (
                                <p className="text-xs text-gray-400 mt-1">
                                </p>
                            )}
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    フロア
                                </label>
                                <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600 font-medium">
                                    {selectedFloor?.name}
                                </div>
                            </div>
                            {creationError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {creationError}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    タイトル <span className="text-red-500">*</span>
                                </label>
                                <input
                                    autoFocus
                                    type="text"
                                    data-testid="create-issue-title"
                                    value={newIssueTitle}
                                    onChange={e => setNewIssueTitle(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Escape') setCreationDialog(null); }}
                                    placeholder="例: 配管の干渉あり"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    説明
                                </label>
                                <textarea
                                    data-testid="create-issue-description"
                                    value={newIssueDescription}
                                    onChange={e => setNewIssueDescription(e.target.value)}
                                    rows={3}
                                    placeholder="指摘事項の具体的な内容を記述してください"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    カテゴリ
                                </label>
                                <select
                                    data-testid="create-issue-category"
                                    value={newIssueCategory}
                                    onChange={e => setNewIssueCategory(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                >
                                    <option value="品質不良">品質不良</option>
                                    <option value="安全不備">安全不備</option>
                                    <option value="施工不備">施工不備</option>
                                    <option value="設計変更">設計変更</option>
                                    <option value="その他">その他</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    写真 <span className="text-gray-400 font-normal">(複数選択可)</span>
                                </label>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {newIssuePreviewUrls.map((url, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group" data-testid="new-photo-preview">
                                                <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => setNewIssuePhotos(prev => prev.filter((_, i) => i !== idx))}
                                                    className="absolute top-1 right-1 p-1 bg-red-600/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                        <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={e => {
                                                    if (e.target.files) {
                                                        setNewIssuePhotos(prev => [...prev, ...Array.from(e.target.files!)]);
                                                    }
                                                }}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                    {newIssuePhotos.length > 0 && (
                                        <p className="text-[10px] text-gray-500">
                                            {newIssuePhotos.length} 枚選択中
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button
                                data-testid="create-issue-cancel"
                                onClick={() => setCreationDialog(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                data-testid="create-issue-submit"
                                onClick={handleCreateIssue}
                                disabled={isSubmitting || !newIssueTitle.trim() || !selectedFloor}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSubmitting ? '作成中...' : '作成'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Issue Detail Modal */}
            {showDetailId && (
                <IssueDetailModal
                    issueId={showDetailId}
                    onClose={() => setShowDetailId(null)}
                    onUpdate={handleIssueUpdate}
                />
            )}

            {/* Global Notification Toast */}
            {notification && (
                <div
                    data-testid="notification-toast"
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
                >
                    <div className={`
                        flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md
                        ${notification.type === 'warning' ? 'bg-amber-50/90 border-amber-200 text-amber-800' :
                            notification.type === 'error' ? 'bg-red-50/90 border-red-200 text-red-800' :
                                'bg-blue-50/90 border-blue-200 text-blue-800'}
                    `}>
                        {notification.type === 'warning' && (
                            <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        )}
                        <span className="font-semibold text-sm">{notification.message}</span>
                        <button
                            onClick={() => setNotification(null)}
                            className="ml-4 p-1 rounded-full hover:bg-black/5 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
