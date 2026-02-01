// app.js - PixiJS Convention Center Navigation with IoT Crowd Awareness

const API_BASE = 'http://localhost:5000/api';

class ConventionCenterApp {
    constructor() {
        this.app = null;
        this.navmeshData = null;
        this.currentPath = null;
        this.iotSummary = null;
        this.iotData = {};
        this.crowdAvoidance = true; // NEW: toggle for crowd avoidance
        
        this.viewport = {
            zoom: 1,
            x: 0,
            y: 0
        };
        this.layers = {
            background: null,
            rooms: null,
            corridors: null,
            heatmap: null,  // NEW: heat map layer for occupancy
            path: null,
            interactive: null
        };
        
        this.init();
    }

    async init() {
        this.setupPixi();
        await this.loadNavmesh();
        await this.loadIoTData();  // NEW: Load IoT telemetry
        this.setupUI();
        this.renderMap();
        this.updateStatus('Ready', false);
    }

    setupPixi() {
        const canvas = document.getElementById('pixiCanvas');
        const container = document.getElementById('canvas-container');
        
        this.app = new PIXI.Application({
            view: canvas,
            width: container.clientWidth,
            height: container.clientHeight,
            backgroundColor: 0x1a1a2e,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
        });
        
        try {
            this.app.renderer.resolution = 1;
        } catch (_) {}

        this.app.stage.sortableChildren = true;
        
        // Create layers (added heatmap)
        this.layers.background = new PIXI.Container();
        this.layers.heatmap = new PIXI.Container();
        this.layers.corridors = new PIXI.Container();
        this.layers.rooms = new PIXI.Container();
        this.layers.path = new PIXI.Container();
        this.layers.interactive = new PIXI.Container();

        this.app.stage.addChild(this.layers.background);
        this.app.stage.addChild(this.layers.heatmap);
        this.app.stage.addChild(this.layers.corridors);
        this.app.stage.addChild(this.layers.rooms);
        this.app.stage.addChild(this.layers.path);
        this.app.stage.addChild(this.layers.interactive);

        this.app.stage.interactive = true;
        this.app.stage.hitArea = this.app.screen;

        this.setupPanZoom();
        window.addEventListener('resize', () => this.handleResize());
    }

    setupPanZoom() {
        try {
            this.app.stage.eventMode = 'static';
        } catch (_) {
            this.app.stage.interactive = true;
        }
        this.app.stage.hitArea = this.app.screen;

        let isDragging = false;
        let dragStartScreen = { x: 0, y: 0 };
        let startViewport = { x: 0, y: 0 };

        const getGlobal = (event) => (event?.data?.global || event?.global || { x: event.clientX, y: event.clientY });

        const onPointerDown = (event) => {
            isDragging = true;
            const g = getGlobal(event);
            dragStartScreen = { x: g.x, y: g.y };
            startViewport = { x: this.viewport.x, y: this.viewport.y };
        };

        const onPointerMove = (event) => {
            if (!isDragging) return;
            const g = getGlobal(event);
            const dx = (g.x - dragStartScreen.x) / this.viewport.zoom;
            const dy = (g.y - dragStartScreen.y) / this.viewport.zoom;
            this.viewport.x = startViewport.x + dx;
            this.viewport.y = startViewport.y + dy;
            this._clampViewportToMap();
            this.updateViewport();
        };

        const onPointerUp = () => {
            isDragging = false;
        };

        this.app.stage.on('pointerdown', onPointerDown);
        this.app.stage.on('pointermove', onPointerMove);
        this.app.stage.on('pointerup', onPointerUp);
        this.app.stage.on('pointerupoutside', onPointerUp);

        this.app.view.addEventListener('wheel', (event) => {
            event.preventDefault();
            const rect = this.app.view.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const oldZoom = this.viewport.zoom;
            const zoomStep = 1.08;
            const factor = event.deltaY > 0 ? 1 / zoomStep : zoomStep;
            const newZoom = this._clamp(oldZoom * factor, 0.25, 6.0);
            const worldX = (mouseX / oldZoom) - this.viewport.x;
            const worldY = (mouseY / oldZoom) - this.viewport.y;
            this.viewport.zoom = newZoom;
            this.viewport.x = (mouseX / newZoom) - worldX;
            this.viewport.y = (mouseY / newZoom) - worldY;
            this._clampViewportToMap();
            this.updateViewport();
        }, { passive: false });
    }

    _clampViewportToMap() {
        if (!this.navmeshData?.scale_info?.svg_dimensions) return;
        const mapW = this.navmeshData.scale_info.svg_dimensions.width;
        const mapH = this.navmeshData.scale_info.svg_dimensions.height;
        const screenW = this.app.screen.width / this.viewport.zoom;
        const screenH = this.app.screen.height / this.viewport.zoom;
        const marginX = mapW * 0.1;
        const marginY = mapH * 0.1;
        const minX = Math.min(-mapW - marginX + screenW, marginX);
        const maxX = Math.max(marginX, -mapW - marginX + screenW);
        const minY = Math.min(-mapH - marginY + screenH, marginY);
        const maxY = Math.max(marginY, -mapH - marginY + screenH);
        this.viewport.x = this._clamp(this.viewport.x, minX, maxX);
        this.viewport.y = this._clamp(this.viewport.y, minY, maxY);
    }

    resetView() {
        if (this.navmeshData && this.navmeshData.scale_info) {
            this.centerMap();
            return;
        }
        this.viewport = { zoom: 1, x: 0, y: 0 };
        this.updateViewport();
    }

    updateViewport() {
        const maxSane = 1000000;
        if (Math.abs(this.viewport.x) > maxSane || Math.abs(this.viewport.y) > maxSane) {
            console.warn('[VIEWPORT] Detected escaped coordinates, resetting:', this.viewport);
            this.viewport = { zoom: 1, x: 0, y: 0 };
        }
        this.app.stage.scale.set(this.viewport.zoom);
        this.app.stage.position.set(
            this.viewport.x * this.viewport.zoom,
            this.viewport.y * this.viewport.zoom
        );
    }

    handleResize() {
        const container = document.getElementById('canvas-container');
        this.app.renderer.resize(container.clientWidth, container.clientHeight);
        this.app.stage.hitArea = this.app.screen;
        this.centerMap();
    }

    _clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    async loadNavmesh() {
        this.updateStatus('Loading navigation mesh...', true);
        try {
            const response = await fetch(`${API_BASE}/navmesh`);
            this.navmeshData = await response.json();
            console.log('✓ Navmesh loaded:', this.navmeshData);
            
            document.getElementById('node-count').textContent = this.navmeshData.nodes.length;
            document.getElementById('edge-count').textContent = this.navmeshData.edges.length;
            document.getElementById('room-count').textContent = this.navmeshData.rooms.length;
            
            this.populateRoomDropdowns();
        } catch (error) {
            console.error('Error loading navmesh:', error);
            this.updateStatus('Error loading data', false);
        }
    }

    async loadIoTData() {
        this.updateStatus('Loading IoT telemetry...', true);
        try {
            // Load summary
            const summaryResp = await fetch(`${API_BASE}/iot/summary`);
            this.iotSummary = await summaryResp.json();
            
            // Load sensor data
            const dataResp = await fetch(`${API_BASE}/iot/data`);
            this.iotData = await dataResp.json();
            
            if (this.iotSummary.telemetry_enabled) {
                console.log('✓ IoT Telemetry loaded:', this.iotSummary);
                this.updateIoTDisplay();
            } else {
                console.log('⚠ IoT Telemetry not available');
                document.getElementById('iot-panel').style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading IoT data:', error);
            document.getElementById('iot-panel').style.display = 'none';
        }
    }

    updateIoTDisplay() {
        if (!this.iotSummary || !this.iotSummary.telemetry_enabled) return;
        
        document.getElementById('iot-status').textContent = 
            this.iotSummary.telemetry_enabled ? 'Active' : 'Offline';
        
        document.getElementById('avg-occupancy').textContent = 
            `${(this.iotSummary.avg_occupancy * 100).toFixed(1)}%`;
        
        document.getElementById('max-occupancy').textContent = 
            `${(this.iotSummary.max_occupancy * 100).toFixed(1)}%`;
        
        // Show crowded halls
        const crowdedList = document.getElementById('crowded-halls');
        crowdedList.innerHTML = '';
        
        if (this.iotSummary.crowded_halls && this.iotSummary.crowded_halls.length > 0) {
            this.iotSummary.crowded_halls.slice(0, 5).forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.hallId}: ${(item.occupancy * 100).toFixed(0)}%`;
                li.style.color = item.occupancy > 0.75 ? '#ff6b6b' : '#ffa500';
                crowdedList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No crowded halls';
            li.style.color = '#4caf50';
            crowdedList.appendChild(li);
        }
    }

    populateRoomDropdowns() {
        const startSelect = document.getElementById('startRoom');
        const endSelect = document.getElementById('endRoom');
        
        startSelect.innerHTML = '<option value="">Select starting hall...</option>';
        endSelect.innerHTML = '<option value="">Select destination...</option>';
        
        this.navmeshData.rooms.forEach(room => {
            const option1 = document.createElement('option');
            option1.value = room.id;
            option1.textContent = room.name;
            const option2 = option1.cloneNode(true);
            startSelect.appendChild(option1);
            endSelect.appendChild(option2);
        });
    }

    renderMap() {
        if (!this.navmeshData) return;
        this.updateStatus('Rendering map...', true);
        this.layers.rooms.removeChildren();
        this.layers.corridors.removeChildren();
        this.layers.heatmap.removeChildren();
        
        this.renderCorridors();
        this.renderRooms();
        
        // NEW: Render crowd heat map if IoT data available
        if (this.iotData && Object.keys(this.iotData).length > 0) {
            this.renderCrowdHeatmap();
        }
        
        this.centerMap();
        this.updateStatus('Map rendered', false);
    }

    renderCrowdHeatmap() {
        // Overlay heat map on rooms based on occupancy
        const roomNodes = this.navmeshData.nodes.filter(n => n.type === 'room');
        
        roomNodes.forEach(node => {
            const occupancy = this.iotData[node.id] || 0;
            if (occupancy === 0) return;
            
            const graphics = new PIXI.Graphics();
            
            // Color based on occupancy: green -> yellow -> red
            let color;
            let alpha = 0.3;
            
            if (occupancy < 0.3) {
                color = 0x4caf50; // Green
            } else if (occupancy < 0.5) {
                color = 0xffa500; // Orange
            } else if (occupancy < 0.7) {
                color = 0xff6b6b; // Light red
            } else {
                color = 0xff0000; // Red
                alpha = 0.4;
            }
            
            graphics.beginFill(color, alpha);
            graphics.lineStyle(0);
            
            const polygon = node.polygon;
            graphics.moveTo(polygon[0][0], polygon[0][1]);
            for (let i = 1; i < polygon.length; i++) {
                graphics.lineTo(polygon[i][0], polygon[i][1]);
            }
            graphics.closePath();
            graphics.endFill();
            
            this.layers.heatmap.addChild(graphics);
        });
    }

    renderCorridors() {
        if (this.navmeshData.corridor_polygons) {
            this.navmeshData.corridor_polygons.forEach(corridor => {
                if (corridor.polygon && corridor.polygon.length >= 3) {
                    const graphics = new PIXI.Graphics();
                    graphics.beginFill(0xff00ff, 0.2);
                    graphics.lineStyle(2, 0xcc00cc, 0.4);
                    const polygon = corridor.polygon;
                    graphics.moveTo(polygon[0][0], polygon[0][1]);
                    for (let i = 1; i < polygon.length; i++) {
                        graphics.lineTo(polygon[i][0], polygon[i][1]);
                    }
                    graphics.closePath();
                    graphics.endFill();
                    this.layers.corridors.addChild(graphics);
                }
            });
        }
    }

    renderRooms() {
        const roomNodes = this.navmeshData.nodes.filter(n => n.type === 'room');
        
        roomNodes.forEach((node, index) => {
            const graphics = new PIXI.Graphics();
            graphics.beginFill(0xefefef, 0.6);
            graphics.lineStyle(2, 0xcccccc, 0.8);
            
            const polygon = node.polygon;
            graphics.moveTo(polygon[0][0], polygon[0][1]);
            for (let i = 1; i < polygon.length; i++) {
                graphics.lineTo(polygon[i][0], polygon[i][1]);
            }
            graphics.closePath();
            graphics.endFill();
            graphics.interactive = true;
            graphics.buttonMode = true;
            
            graphics.on('pointerover', () => {
                graphics.tint = 0xaaffff;
                this.showEventTooltip(node, index);
            });
            
            graphics.on('pointerout', () => {
                graphics.tint = 0xffffff;
                this.hideEventTooltip();
            });
            
            this.layers.rooms.addChild(graphics);
            
            const text = new PIXI.Text(node.name || `Hall ${index + 1}`, {
                fontFamily: 'Arial',
                fontSize: 48,
                fontWeight: 'bold',
                fill: 0x000000,
                align: 'center',
                stroke: 0xffffff,
                strokeThickness: 4
            });
            text.anchor.set(0.5);
            text.position.set(node.position.x, node.position.y);
            this.layers.rooms.addChild(text);
        });
    }

    showEventTooltip(node, index) {
        const tooltip = document.getElementById('event-tooltip');
        const title = document.getElementById('tooltip-title');
        const content = document.getElementById('tooltip-content');
        
        const occupancy = this.iotData[node.id] || 0;
        const occupancyText = occupancy > 0 
            ? `<strong>Occupancy:</strong> ${(occupancy * 100).toFixed(0)}%<br>` 
            : '';
        
        let crowdStatus = 'Normal';
        if (occupancy > 0.7) crowdStatus = 'Very Crowded';
        else if (occupancy > 0.5) crowdStatus = 'Crowded';
        else if (occupancy > 0.3) crowdStatus = 'Moderate';
        
        title.textContent = node.name || `Hall ${index + 1}`;
        content.innerHTML = `
            ${occupancyText}
            ${occupancy > 0 ? `<strong>Status:</strong> ${crowdStatus}<br>` : ''}
            <strong>Type:</strong> Exhibition Hall
        `;
        
        tooltip.classList.add('visible');
    }

    hideEventTooltip() {
        document.getElementById('event-tooltip').classList.remove('visible');
    }

    centerMap() {
        if (!this.navmeshData || !this.navmeshData.scale_info) return;
        const mapWidth = this.navmeshData.scale_info.svg_dimensions.width;
        const mapHeight = this.navmeshData.scale_info.svg_dimensions.height;
        const canvasWidth = this.app.screen.width;
        const canvasHeight = this.app.screen.height;
        const zoomX = canvasWidth / mapWidth;
        const zoomY = canvasHeight / mapHeight;
        this.viewport.zoom = Math.min(zoomX, zoomY) * 0.9;
        this.viewport.x = (canvasWidth / this.viewport.zoom - mapWidth) / 2;
        this.viewport.y = (canvasHeight / this.viewport.zoom - mapHeight) / 2;
        this.updateViewport();
    }

    async findPath() {
        const startId = document.getElementById('startRoom').value;
        const endId = document.getElementById('endRoom').value;
        
        if (!startId || !endId) {
            alert('Please select both start and destination');
            return;
        }
        
        if (startId === endId) {
            alert('Start and destination cannot be the same');
            return;
        }
        
        this.updateStatus('Calculating route...', true);
        
        try {
            const response = await fetch(`${API_BASE}/pathfind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    start: startId, 
                    end: endId,
                    avoid_crowds: this.crowdAvoidance  // NEW: pass preference
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentPath = result;
                this.renderPath();
                this.showPathInfo();
                
                const crowdNote = result.crowd_avoidance_enabled ? ' (avoiding crowds)' : '';
                this.updateStatus(`Route found: ${result.distance.meters.toFixed(1)}m${crowdNote}`, false);
            } else {
                this.updateStatus('No path found', false);
            }
        } catch (error) {
            console.error('Error finding path:', error);
            this.updateStatus('Error calculating route', false);
        }
    }

    renderPath() {
        if (!this.currentPath) return;
        this.layers.path.removeChildren();
        
        const graphics = new PIXI.Graphics();
        const coords = this.currentPath.path_coordinates;
        
        graphics.lineStyle(8, 0x00d4ff, 1);
        graphics.moveTo(coords[0].x, coords[0].y);
        for (let i = 1; i < coords.length; i++) {
            graphics.lineTo(coords[i].x, coords[i].y);
        }
        this.layers.path.addChild(graphics);
        
        const startPoint = new PIXI.Graphics();
        startPoint.beginFill(0x4caf50);
        startPoint.drawCircle(coords[0].x, coords[0].y, 15);
        startPoint.endFill();
        this.layers.path.addChild(startPoint);
        
        const endPoint = new PIXI.Graphics();
        endPoint.beginFill(0xf44336);
        endPoint.drawCircle(coords[coords.length - 1].x, coords[coords.length - 1].y, 15);
        endPoint.endFill();
        this.layers.path.addChild(endPoint);
        
        for (let i = 1; i < coords.length - 1; i++) {
            const point = new PIXI.Graphics();
            point.beginFill(0x00d4ff, 0.8);
            point.drawCircle(coords[i].x, coords[i].y, 6);
            point.endFill();
            this.layers.path.addChild(point);
        }
    }

    showPathInfo() {
        if (!this.currentPath) return;
        
        const pathInfo = document.getElementById('path-info');
        const distanceMeters = document.getElementById('distance-meters');
        const distancePixels = document.getElementById('distance-pixels');
        const pathSteps = document.getElementById('pathSteps');
        
        distanceMeters.textContent = this.currentPath.distance.meters.toFixed(1);
        distancePixels.textContent = this.currentPath.distance.pixels.toFixed(0);
        
        pathSteps.innerHTML = '';
        this.currentPath.path.forEach((nodeId, index) => {
            const step = document.createElement('div');
            step.className = 'path-step';
            const node = this.navmeshData.nodes.find(n => n.id === nodeId);
            let nodeName = nodeId;
            if (node && node.type === 'room') {
                const roomIndex = this.navmeshData.nodes.filter(n => n.type === 'room').indexOf(node);
                nodeName = node.name || `Hall ${roomIndex + 1}`;
            }
            step.textContent = `${index + 1}. ${nodeName}`;
            pathSteps.appendChild(step);
        });
        
        // NEW: Show crowd info if available
        if (this.currentPath.path_crowding && this.currentPath.path_crowding.length > 0) {
            const crowdInfo = document.createElement('div');
            crowdInfo.style.marginTop = '10px';
            crowdInfo.innerHTML = '<strong>Hall Occupancy:</strong>';
            
            this.currentPath.path_crowding.forEach(item => {
                const crowdItem = document.createElement('div');
                crowdItem.style.fontSize = '12px';
                crowdItem.style.padding = '2px 5px';
                const occ = (item.occupancy * 100).toFixed(0);
                crowdItem.textContent = `${item.name}: ${occ}%`;
                
                if (item.occupancy > 0.7) crowdItem.style.color = '#ff6b6b';
                else if (item.occupancy > 0.5) crowdItem.style.color = '#ffa500';
                else crowdItem.style.color = '#4caf50';
                
                crowdInfo.appendChild(crowdItem);
            });
            
            pathSteps.appendChild(crowdInfo);
        }
        
        pathInfo.classList.add('visible');
    }

    clearPath() {
        this.currentPath = null;
        this.layers.path.removeChildren();
        document.getElementById('path-info').classList.remove('visible');
        document.getElementById('startRoom').value = '';
        document.getElementById('endRoom').value = '';
        this.updateStatus('Path cleared', false);
    }

    toggleCrowdAvoidance() {
        this.crowdAvoidance = document.getElementById('crowdToggle').checked;
        console.log('Crowd avoidance:', this.crowdAvoidance ? 'enabled' : 'disabled');
    }

    setupUI() {
        document.getElementById('findPath').addEventListener('click', () => this.findPath());
        document.getElementById('clearPath').addEventListener('click', () => this.clearPath());
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('resetView').addEventListener('click', () => this.resetView());
        
        // NEW: Crowd avoidance toggle
        document.getElementById('crowdToggle').addEventListener('change', () => this.toggleCrowdAvoidance());
        
        document.addEventListener('mousemove', (event) => {
            const tooltip = document.getElementById('event-tooltip');
            tooltip.style.left = (event.clientX + 20) + 'px';
            tooltip.style.top = (event.clientY + 20) + 'px';
        });
    }

    zoom(factor) {
        this.viewport.zoom = this._clamp(this.viewport.zoom * factor, 0.25, 6);
        this.updateViewport();
    }

    updateStatus(message, loading) {
        const statusText = document.getElementById('status-text');
        const loadingSpinner = document.querySelector('.loading');
        statusText.textContent = message;
        loadingSpinner.style.display = loading ? 'inline-block' : 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ConventionCenterApp();
});
