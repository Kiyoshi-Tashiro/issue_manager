'use client';

import { useEffect, useRef, useState } from 'react';
import { createIssueExtensionClass } from './extensions/IssueExtension';

interface ViewerProps {
    urn: string;
    token: string;
    selectedFloor?: any;
    onViewerReady?: (viewer: any) => void;
}

declare global {
    interface Window {
        Autodesk: any;
    }
}

export default function ApsViewer({ urn, token, selectedFloor, onViewerReady }: ViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    const levelsExtRef = useRef<any>(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);

    useEffect(() => {
        const Autodesk = window.Autodesk;
        if (!Autodesk || !containerRef.current) return;

        // Register extension synchronously before Initializer to avoid race condition.
        // createIssueExtensionClass() returns a class that properly extends Autodesk.Viewing.Extension.
        const IssueExtension = createIssueExtensionClass(Autodesk);
        const extManager = Autodesk.Viewing.theExtensionManager;
        if (extManager && typeof extManager.registerExtension === 'function') {
            extManager.registerExtension(IssueExtension.ExtensionId, IssueExtension);
        }

        const options = {
            env: 'AutodeskProduction',
            getAccessToken: (callback: any) => callback(token, 3600),
        };

        Autodesk.Viewing.Initializer(options, () => {
            const viewer = new Autodesk.Viewing.GuiViewer3D(containerRef.current!);
            viewerRef.current = viewer;
            viewer.start();

            const documentId = 'urn:' + urn;
            Autodesk.Viewing.Document.load(documentId, (doc: any) => {
                const viewables = doc.getRoot().getDefaultGeometry();
                viewer.loadDocumentNode(doc, viewables).then(() => {
                    const extensionPromises = [
                        viewer.loadExtension(IssueExtension.ExtensionId),
                        viewer.loadExtension('Autodesk.AEC.LevelsExtension')
                    ];

                    Promise.all(extensionPromises).then((extensions) => {
                        const levelsExt = extensions[1];
                        if (levelsExt) {
                            console.log('LevelsExtension loaded');
                            levelsExtRef.current = levelsExt;
                        }
                        setIsModelLoaded(true);
                        if (onViewerReady) onViewerReady(viewer);
                    });
                });
            });
        });

        return () => {
            if (viewerRef.current) {
                viewerRef.current.finish();
                viewerRef.current = null;
                levelsExtRef.current = null;
                setIsModelLoaded(false);
            }
        };
    }, [urn, token]);

    // Handle floor selection change
    useEffect(() => {
        if (!isModelLoaded || !viewerRef.current || !selectedFloor || !viewerRef.current.model) return;

        const viewer = viewerRef.current;
        const levelsExt = levelsExtRef.current;
        const floorName = selectedFloor.name;

        // If 'All Floors' is selected
        if (selectedFloor.id === 'all-floors' || floorName === '全フロア表示' || !floorName) {
            console.log('[DEBUG] Showing all floors');
            viewer.setGhosting(true); // Reset to default when showing all
            viewer.showAll();
            viewer.fitToView();
            return;
        }

        // Disable ghosting so unselected floors are completely hidden
        viewer.setGhosting(false);

        // 1. Try standard LevelsExtension sync first
        if (levelsExt && levelsExt.floorData) {
            const level = levelsExt.floorData.find((l: any) => l.name === floorName);
            if (level) {
                console.log('[DEBUG] Selecting level via extension:', floorName);
                levelsExt.selectLevelById(level.index || level.id);
                return;
            }
        }

        // 2. Fallback: Manual isolation based on 'Reference Level' / 'Level' properties
        console.log('[DEBUG] Manual isolation for floor:', floorName, 'ID:', selectedFloor.id);

        // Search for the floor name in all properties (this is broad)
        viewer.search(floorName, (dbIds: number[]) => {
            if (dbIds && dbIds.length > 0) {
                // To be precise, we filter properties for the found objects
                // We check 'Reference Level' or 'Level'
                const attrNames = ['Reference Level', 'Level', '参照レベル', '基準レベル', 'レベル'];
                viewer.model.getBulkProperties(dbIds, attrNames, (results: any[]) => {
                    const filteredIds = results.filter(r => {
                        return r.properties.some((p: any) => {
                            // Check if property value matches floor name (e.g. "1F") 
                            // OR matches floor object's dbId (e.g. "4") if the property is "Level"
                            const val = String(p.displayValue);
                            return val === floorName || val === selectedFloor.id;
                        });
                    }).map(r => r.dbId);

                    if (filteredIds.length > 0) {
                        console.log(`[DEBUG] Isolated ${filteredIds.length} precise elements for ${floorName}`);
                        viewer.isolate(filteredIds);
                        viewer.fitToView(filteredIds);
                    } else {
                        // Fallback: if precise filter failed, use raw search results
                        console.log(`[DEBUG] Precise filter failed, isolating all ${dbIds.length} matches`);
                        viewer.isolate(dbIds);
                        viewer.fitToView(dbIds);
                    }
                });
            } else {
                console.warn('[DEBUG] No elements found for floor:', floorName);
                viewer.showAll();
            }
        }, (err: any) => {
            console.error('Floor search error:', err);
            viewer.showAll();
        }, ['Reference Level', 'Level', '参照レベル', '基準レベル', 'レベル', 'Name']);

    }, [selectedFloor]);

    return (
        <div className="relative w-full h-full overflow-hidden">
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
}
