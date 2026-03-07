declare const THREE: any;
declare namespace THREE {
    type Mesh = any;
    type Vector3 = any;
    type Camera = any;
    type Sprite = any;
    type CanvasTexture = any;
    type SpriteMaterial = any;
}

// Declare THREE as it is injected globally by Autodesk Viewer
/**
 * Creates and returns the IssueExtension class.
 * Must be called after Autodesk Viewer is loaded (Autodesk is global at that point).
 */
export function createIssueExtensionClass(Autodesk: any) {
    class IssueExtension extends Autodesk.Viewing.Extension {
        public static readonly ExtensionId = 'Autodesk.Aps.IssueExtension';
        private tool: any = null;
        private markers: Map<string, any> = new Map();
        private labels: Map<string, HTMLElement> = new Map();

        constructor(viewer: any, options: any) {
            super(viewer, options);
        }

        public load() {
            console.log('IssueExtension loaded');
            this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.updateAllLabels);
            return true;
        }

        public unload() {
            this.clearMarkers();
            if (this.tool) {
                this.viewer.toolController.deregisterTool(this.tool);
                this.tool = null;
            }
            this.viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.updateAllLabels);
            return true;
        }

        private updateAllLabels = () => {
            if (!this.viewer) return;
            this.markers.forEach((mesh, id) => {
                this.updateMarkerAppearance(mesh); // Update mesh scale and rotation dynamically

                const label = this.labels.get(id);
                if (label && mesh.userData.labelPosition) {
                    const screenPoint = this.viewer.worldToClient(mesh.userData.labelPosition);
                    const camera = this.viewer.getCamera();
                    if (!camera) return;

                    const projected = mesh.userData.labelPosition.clone().project(camera);

                    if (projected.z > 1 || projected.z < -1) {
                        label.style.display = 'none';
                    } else {
                        label.style.display = 'block';
                        label.style.left = `${Math.round(screenPoint.x)}px`;
                        label.style.top = `${Math.round(screenPoint.y)}px`;
                    }
                }
            });
        };

        /**
         * Updates markers based on current issues data.
         */
        public setIssues(issues: any[]) {
            console.log('[DEBUG] IssueExtension.setIssues called with:', issues.length, 'issues');
            this.clearMarkers();

            // 1. Clustering logic for unfolding
            const clusters: Map<string, any[]> = new Map();
            const threshold = 15.0; // Increased distance threshold for clustering

            issues.forEach(issue => {
                if (!issue.modelPosition) return;

                let foundClusterKey: string | null = null;
                for (const key of clusters.keys()) {
                    const [kx, ky, kz] = key.split(',').map(Number);
                    const dist = Math.sqrt(
                        (issue.modelPosition.x - kx) ** 2 +
                        (issue.modelPosition.y - ky) ** 2 +
                        (issue.modelPosition.z - kz) ** 2
                    );
                    if (dist < threshold) {
                        foundClusterKey = key;
                        break;
                    }
                }

                if (foundClusterKey) {
                    clusters.get(foundClusterKey)!.push(issue);
                } else {
                    const key = `${issue.modelPosition.x},${issue.modelPosition.y},${issue.modelPosition.z}`;
                    clusters.set(key, [issue]);
                }
            });

            // 2. Create markers with offsets
            clusters.forEach((clusterIssues, key) => {
                const count = clusterIssues.length;

                clusterIssues.forEach((issue, index) => {
                    this.createMarker(issue, index, count);
                });
            });

            console.log('[DEBUG] Markers count now:', this.markers.size);
            this.updateAllLabels();
            this.viewer.impl.invalidate(true, true, true);
        }


        private createMarker(issue: any, clusterIndex: number = 0, clusterCount: number = 1) {
            const radius = 3;
            const height = 9;
            const headRadius = radius * 1.2;
            const pointerRadius = radius / 5; // 1/5 of current size
            const pointerHeight = height - headRadius; // Ends exactly on the sphere surface

            // Create Pointer Geometry (Cone-like, tip at origin, pointing along Z)
            const pointerGeo = new THREE.CylinderGeometry(pointerRadius, 0, pointerHeight, 16);

            // Compatibility Guard: use applyMatrix4 if available, fallback to applyMatrix
            const rotateX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
            if (pointerGeo.applyMatrix4) pointerGeo.applyMatrix4(rotateX);
            else pointerGeo.applyMatrix(rotateX);

            const translateZ = new THREE.Matrix4().makeTranslation(0, 0, pointerHeight / 2);
            if (pointerGeo.applyMatrix4) pointerGeo.applyMatrix4(translateZ);
            else pointerGeo.applyMatrix(translateZ);

            // Create Head Geometry (Sphere at top)
            const headGeo = new THREE.SphereGeometry(headRadius, 16, 16);
            const translateHead = new THREE.Matrix4().makeTranslation(0, 0, height);
            if (headGeo.applyMatrix4) headGeo.applyMatrix4(translateHead);
            else headGeo.applyMatrix(translateHead);

            // Setup Materials
            const color = issue.status === 'Open' ? 0xff3b30 :
                issue.status === 'In Progress' ? 0xffcc00 : 0x34c759;

            const fillMaterial = new THREE.MeshBasicMaterial({
                color, depthTest: false, transparent: true, opacity: 0.95
            });

            const mesh = new THREE.Mesh(pointerGeo, fillMaterial);
            const headMesh = new THREE.Mesh(headGeo, fillMaterial);
            mesh.add(headMesh);

            mesh.position.set(issue.modelPosition.x, issue.modelPosition.y, issue.modelPosition.z);

            // Store metadata for dynamic updates
            mesh.userData = {
                issueId: issue.id,
                originalPosition: new THREE.Vector3().copy(mesh.position),
                clusterIndex,
                clusterCount,
                height: height,
                originalFillOpacity: 0.95,
                labelPosition: new THREE.Vector3()
            };

            if (!this.viewer.overlays.hasScene('issue-markers')) {
                console.log('[DEBUG] Creating issue-markers overlay scene');
                this.viewer.overlays.addScene('issue-markers');
            }
            this.viewer.overlays.addMesh(mesh, 'issue-markers');

            (mesh as any).issueId = issue.id;
            this.markers.set(issue.id, mesh);

            // Expose diagnostics globally for testing
            (window as any).__ISSUE_DIAGNOSTICS__ = {
                markers: this.markers,
                labels: this.labels,
                viewer: this.viewer,
                extension: this
            };

            // Trigger immediate appearance update
            this.updateMarkerAppearance(mesh);

            // --- HTML Label Overlay ---
            if (issue.issueNumber) {
                const label = document.createElement('div');
                label.className = 'issue-marker-label';
                label.style.position = 'absolute';
                label.style.pointerEvents = 'none';
                label.style.color = '#ffffff';
                label.style.fontWeight = 'bold';
                label.style.fontSize = '12px';
                label.style.textShadow = '0px 0px 4px rgba(0,0,0,0.8), 1px 1px 2px rgba(0,0,0,0.8)';
                label.style.transform = 'translate(-50%, -50%)';
                label.style.zIndex = '50';
                label.style.whiteSpace = 'nowrap';
                label.innerText = `#${issue.issueNumber}`;

                this.viewer.container.appendChild(label);
                this.labels.set(issue.id, label);
            }
        }

        /**
         * Dynamic update of marker scale and unfolding factor based on camera distance.
         */
        private updateMarkerAppearance(mesh: THREE.Mesh, isHoveredOverride?: boolean) {
            if (!this.viewer) return;
            const camera = this.viewer.getCamera();
            if (!camera) return;

            const distance = mesh.position.distanceTo(camera.position);

            // 1. Constant Size on Screen
            const baseScale = 0.002; // Standard visible size
            let scale = 1.0;

            if ((camera as any).isOrthographicCamera || (this.viewer.navigation.isOrthographic && this.viewer.navigation.isOrthographic())) {
                const zoom = (camera as any).zoom || 1.0;
                scale = (1.0 / zoom) * 1.5;
            } else {
                scale = distance * baseScale;
            }

            // Clamp scale: Increased minimum to 0.1 to guarantee visibility
            scale = Math.max(0.1, Math.min(100.0, scale));

            const isHovered = isHoveredOverride !== undefined ? isHoveredOverride : (this.tool && this.tool.hoveredMarkerId === mesh.userData.issueId);

            const label = this.labels.get(mesh.userData.issueId);
            if (isHovered) {
                mesh.renderOrder = 100;
                if ((mesh.material as any).opacity !== undefined) (mesh.material as any).opacity = 1.0;
                if (label) {
                    label.style.opacity = '1.0';
                    label.style.zIndex = '100';
                }
                mesh.children.forEach((child: any) => {
                    if (child.isMesh) {
                        child.renderOrder = 100;
                        if (child.material && child.material.opacity !== undefined) child.material.opacity = 1.0;
                    }
                });
            } else {
                mesh.renderOrder = 0;
                if ((mesh.material as any).opacity !== undefined) (mesh.material as any).opacity = 0.5;
                if (label) {
                    label.style.opacity = '0.5';
                    label.style.zIndex = '50';
                }
                mesh.children.forEach((child: any) => {
                    if (child.isMesh) {
                        child.renderOrder = 0;
                        if (child.material && child.material.opacity !== undefined) child.material.opacity = 0.5;
                    }
                });
            }
            mesh.scale.set(scale, scale, scale);

            // 2. Proportional Horizontal Unfolding
            const { clusterIndex, clusterCount, height } = mesh.userData;
            if (clusterCount > 1) {
                const rotationZ = (clusterIndex / clusterCount) * Math.PI * 2;
                const worldSpread = 10.0;
                const theta = Math.atan(worldSpread / (height * scale));

                const matrix = new THREE.Matrix4();
                matrix.makeRotationZ(rotationZ);
                const tiltMatrix = new THREE.Matrix4().makeRotationX(theta);
                matrix.multiply(tiltMatrix);

                mesh.quaternion.setFromRotationMatrix(matrix);
            } else {
                mesh.quaternion.set(0, 0, 0, 1);
            }

            mesh.updateMatrixWorld(true);

            // Update label position tracking
            const headCenterLocal = new THREE.Vector3(0, 0, height);
            mesh.userData.labelPosition = headCenterLocal.applyMatrix4(mesh.matrixWorld);
        }

        public clearMarkers() {
            if (this.viewer.overlays.hasScene('issue-markers')) {
                this.markers.forEach(mesh => {
                    this.viewer.overlays.removeMesh(mesh, 'issue-markers');
                });
            }
            this.markers.clear();

            this.labels.forEach(label => label.remove());
            this.labels.clear();
        }

        public zoomToIssue(issueId: string) {
            const marker = this.markers.get(issueId);
            if (marker) {
                const headPos = marker.userData.labelPosition;
                const target = new THREE.Vector3().copy(marker.position);
                const cameraPos = new THREE.Vector3(headPos.x + 15, headPos.y + 15, headPos.z + 15);
                this.viewer.navigation.setView(cameraPos, target);
            }
        }

        public setMarkerHoverState(mesh: THREE.Mesh, isHovered: boolean) {
            this.updateMarkerAppearance(mesh, isHovered);
        }

        public activateInteractionTool(onSelect: (pos: any, dbId: any) => void, onMarkerClick: (issueId: string) => void) {
            const toolName = 'issueInteractionTool';

            if (this.viewer.toolController.getTool(toolName)) {
                this.viewer.toolController.deactivateTool(toolName);
                this.viewer.toolController.deregisterTool(this.viewer.toolController.getTool(toolName));
            }

            const self = this;
            const ExtensionTool = function (this: any) {
                this.getNames = function () { return [toolName]; };
                this.isActive = false;
                this.hoveredMarkerId = null;
                this.onMouseLeave = () => {
                    if (this.hoveredMarkerId && self.markers.has(this.hoveredMarkerId)) {
                        const oldId = this.hoveredMarkerId;
                        this.hoveredMarkerId = null;
                        self.setMarkerHoverState(self.markers.get(oldId)!, false);
                        self.viewer.canvas.style.cursor = '';
                        self.viewer.impl.invalidate(true, true, true);
                    }
                };

                this.register = function () { };
                this.deregister = function () { };
                this.activate = function () {
                    this.isActive = true;
                    self.viewer.canvas.addEventListener('mouseleave', this.onMouseLeave);
                };
                this.deactivate = function () {
                    this.isActive = false;
                    self.viewer.canvas.removeEventListener('mouseleave', this.onMouseLeave);
                    const oldId = this.hoveredMarkerId;
                    this.hoveredMarkerId = null;
                    if (oldId && self.markers.has(oldId)) {
                        self.setMarkerHoverState(self.markers.get(oldId)!, false);
                        self.viewer.impl.invalidate(true, true, true);
                    }
                };

                const getClosestMarkerId = (pointer: THREE.Vector3, camera: THREE.Camera) => {
                    let closestHit: { id: string, t: number } | null = null;
                    let minDistSq = 0.0025;

                    for (const [id, m] of self.markers.entries()) {
                        m.updateMatrixWorld(true);
                        const tipPos = new THREE.Vector3().copy(m.position);
                        tipPos.project(camera);
                        const headPos = new THREE.Vector3().copy(m.userData.labelPosition);
                        headPos.project(camera);
                        if (tipPos.z < -1 || tipPos.z > 1) continue;

                        const l2 = (headPos.x - tipPos.x) ** 2 + (headPos.y - tipPos.y) ** 2;
                        let t = 0;
                        if (l2 > 0) {
                            t = ((pointer.x - tipPos.x) * (headPos.x - tipPos.x) + (pointer.y - tipPos.y) * (headPos.y - tipPos.y)) / l2;
                            t = Math.max(0, Math.min(1, t));
                        }

                        const projX = tipPos.x + t * (headPos.x - tipPos.x);
                        const projY = tipPos.y + t * (headPos.y - tipPos.y);
                        const distSq = (pointer.x - projX) ** 2 + (pointer.y - projY) ** 2;

                        if (distSq < minDistSq) {
                            closestHit = { id, t };
                            minDistSq = distSq;
                        }
                    }
                    return closestHit;
                };

                this.handleMouseMove = function (event: any) {
                    const canvas = self.viewer.canvas;
                    const rect = canvas.getBoundingClientRect();
                    const clientX = event.clientX - rect.left;
                    const clientY = event.clientY - rect.top;

                    const pointer = self.viewer.impl.clientToViewport(clientX, clientY);
                    const camera = self.viewer.getCamera();

                    if (pointer && camera) {
                        const hit = getClosestMarkerId(pointer, camera);
                        const hitId = hit ? hit.id : null;

                        if (this.hoveredMarkerId !== hitId) {
                            const oldId = this.hoveredMarkerId;
                            this.hoveredMarkerId = hitId;

                            if (oldId && self.markers.has(oldId)) {
                                self.setMarkerHoverState(self.markers.get(oldId)!, false);
                            }

                            if (this.hoveredMarkerId && self.markers.has(this.hoveredMarkerId)) {
                                self.setMarkerHoverState(self.markers.get(this.hoveredMarkerId)!, true);
                                self.viewer.canvas.style.cursor = 'pointer';
                            } else {
                                self.viewer.canvas.style.cursor = '';
                            }
                            self.viewer.impl.invalidate(true, true, true);
                        }
                    }
                    return false;
                };

                this.handleSingleClick = function (event: any, button: number) {
                    if (button !== 0) return false;

                    const canvas = self.viewer.canvas;
                    const rect = canvas.getBoundingClientRect();
                    const clientX = event.clientX - rect.left;
                    const clientY = event.clientY - rect.top;

                    const pointer = self.viewer.impl.clientToViewport(clientX, clientY);
                    const camera = self.viewer.getCamera();

                    if (camera && pointer) {
                        const hit = getClosestMarkerId(pointer, camera);
                        if (hit && hit.t > 0.8) {
                            onMarkerClick(hit.id);
                            return true;
                        }
                        const result = self.viewer.impl.hitTest(clientX, clientY, false);
                        if (result && result.model) {
                            onSelect(result.intersectPoint, result.dbId);
                            return true;
                        }
                        if (hit) {
                            onMarkerClick(hit.id);
                            return true;
                        }
                    }

                    if (camera && pointer) {
                        const distance = self.viewer.navigation.getTarget().distanceTo(camera.position);
                        const ray = self.viewer.impl.viewportToRay(pointer);
                        const intersectPoint = new THREE.Vector3();
                        intersectPoint.copy(ray.origin).add(ray.direction.multiplyScalar(distance));
                        onSelect(intersectPoint, null);
                        return true;
                    }

                    return false;
                };
            };

            const tool = new (ExtensionTool as any)();
            this.tool = tool;
            this.viewer.toolController.registerTool(tool);
            this.viewer.toolController.activateTool(toolName);
        }
    }

    return IssueExtension;
}
