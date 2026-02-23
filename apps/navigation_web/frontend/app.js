// app.js - PixiJS Convention Center Navigation with IoT Crowd Awareness

const API_BASE = 'http://localhost:5000/api';

class ConventionCenterApp {
    constructor() {
        this.app = null;
        this.navmeshData = null;
        this.currentPath = null;
        this.iotSummary = null;
        this.iotData = {};
        this.boothHallData = null;
        this._csvLoaded = false;
        
        // HEATMAP: Simple toggle for per-hall overlay visualization
        this.heatmapEnabled = false;
        this.heatmapOverlayContainer = null; // NEW: Container for heatmap overlay polygons
        
        this.crowdAvoidance = true;

        this.viewport = {
            zoom: 1,
            x: 0,
            y: 0
        };

        this._isDragging = false;
        this._roomHitTest = [];
        this._hoveredRoomId = null;
        this._robustHoverInitialized = false;
        this._navmeshRetryCount = 0;

        this.layers = {
            background: null,
            rooms: null,
            corridors: null,
            corridorOutlines: null,
            path: null,
            interactive: null
        };
        
        this.init();
    }

    async init() {
        this.setupPixi();
        await this.loadNavmesh();
        await this.loadTooltipCSVData();
        await this.loadIoTData();
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
	            backgroundColor: 0xffffff,
	            antialias: true,
	            resolution: window.devicePixelRatio || 1,
	        });
        
        try {
            this.app.renderer.resolution = 1;
        } catch (_) {}

        this.app.stage.sortableChildren = true;
        
        // HEATMAP CHANGE: Removed old layers.heatmap, using heatmapOverlayContainer instead
        this.layers.background = new PIXI.Container();
        this.layers.corridors = new PIXI.Container();
        this.layers.corridorOutlines = new PIXI.Container();
        this.layers.rooms = new PIXI.Container();
        
        // HEATMAP: New overlay container sits ABOVE rooms but BELOW path/interactive
        this.heatmapOverlayContainer = new PIXI.Container();
        this.heatmapOverlayContainer.zIndex = 50; // Above rooms (default 0), below path (100)
        
        this.layers.path = new PIXI.Container();
        this.layers.path.zIndex = 100;
        this.layers.interactive = new PIXI.Container();
        this.layers.interactive.zIndex = 200;

        // Layer order: background → corridors → rooms → heatmap overlay → path → interactive
        this.app.stage.addChild(this.layers.background);
        this.app.stage.addChild(this.layers.corridors);
        this.app.stage.addChild(this.layers.corridorOutlines);
        this.app.stage.addChild(this.layers.rooms);
        this.app.stage.addChild(this.heatmapOverlayContainer); // HEATMAP: Insert here
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
        let pointerId = null;
        let dragStartScreen = { x: 0, y: 0 };
        let startViewport = { x: 0, y: 0 };
        let movedPx = 0;

        const getLocalPoint = (e) => {
            const rect = this.app.view.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        };

        const onDown = (e) => {
            if (typeof e.button === 'number' && e.button !== 0) return;
            isDragging = true;
            this._isDragging = true;
            movedPx = 0;
            pointerId = e.pointerId;
            const p = getLocalPoint(e);
            dragStartScreen = { x: p.x, y: p.y };
            startViewport = { x: this.viewport.x, y: this.viewport.y };
            try {
                this.app.view.setPointerCapture(pointerId);
            } catch (_) {}
        };

        const onMove = (e) => {
            if (!isDragging) return;
            if (pointerId !== null && e.pointerId !== pointerId) return;
            const p = getLocalPoint(e);
            const dxScreen = p.x - dragStartScreen.x;
            const dyScreen = p.y - dragStartScreen.y;
            movedPx = Math.max(movedPx, Math.abs(dxScreen) + Math.abs(dyScreen));
            const dx = dxScreen / this.viewport.zoom;
            const dy = dyScreen / this.viewport.zoom;
            this.viewport.x = startViewport.x + dx;
            this.viewport.y = startViewport.y + dy;
            this._clampViewportToMap();
            this.updateViewport();
            if (movedPx > 2) this.hideEventTooltip();
        };

        const onUp = (e) => {
            if (pointerId !== null && e.pointerId !== pointerId) return;
            isDragging = false;
            this._isDragging = false;
            pointerId = null;
        };

        this.app.view.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);

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
            const response = await fetch(`${API_BASE}/navmesh`, { cache: 'no-store' });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                const msg = (data && data.error) ? data.error : `HTTP ${response.status}`;
                throw new Error(`Failed to load navmesh: ${msg}`);
            }

            if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.rooms)) {
                throw new Error('Navmesh payload missing required fields (nodes/edges/rooms)');
            }

            this.navmeshData = data;
            console.log('✓ Navmesh loaded:', this.navmeshData);

            document.getElementById('node-count').textContent = this.navmeshData.nodes.length;
            document.getElementById('edge-count').textContent = this.navmeshData.edges.length;
            document.getElementById('room-count').textContent = this.navmeshData.rooms.length;

            this.populateRoomDropdowns();
        } catch (error) {
            console.error('Error loading navmesh:', error);
            const msg = error?.message || String(error);
            this.updateStatus(`Error loading navmesh: ${msg}`, false);

            if (/system not initialized/i.test(msg) && this._navmeshRetryCount < 10) {
                this._navmeshRetryCount += 1;
                setTimeout(async () => {
                    await this.loadNavmesh();
                    if (this.navmeshData) {
                        this.populateRoomDropdowns();
                        this.renderMap();
                        this.updateStatus('Ready', false);
                    }
                }, 1000);
            }
        }
    }

    _parseHexWithAlpha(hex) {
        if (typeof hex !== 'string') return { color: 0xffffff, alpha: 1 };
        const h = hex.trim().replace('#', '');
        if (h.length === 6) {
            return { color: parseInt(h, 16), alpha: 1 };
        }
        if (h.length === 8) {
            const rgb = parseInt(h.slice(0, 6), 16);
            const a = parseInt(h.slice(6, 8), 16);
            return { color: rgb, alpha: Math.max(0, Math.min(1, a / 255)) };
        }
        return { color: 0xffffff, alpha: 1 };
    }

	_getHallStyleByName(hallName) {
		const safe = (hallName ?? '').toString().trim();
		const name = safe.toLowerCase();

		if (name.startsWith('north hall')) return { color: 0x9e2a2b, alpha: 0.4 };
		if (name.startsWith('east hall')) return { color: 0x1f3a5f, alpha: 0.4 };
		if (name.startsWith('south hall')) return { color: 0xe09f3e, alpha: 0.4 };

		if (name.startsWith('hall')) {
			const num = parseInt(name.replace('hall', '').trim(), 10);
			if (!Number.isNaN(num)) {
				if (num >= 1 && num <= 6) return { color: 0x2f8f9d, alpha: 0.4 };
				if (num >= 7 && num <= 10) return { color: 0x1f3a5f, alpha: 0.3 };
			}
		}

		return { color: 0xcccccc, alpha: 0.3 };
	}

    
    async loadTooltipCSVData() {
        try {
            if (!window.CsvDataService || typeof window.CsvDataService.loadAllCSVData !== 'function') {
                console.warn('CsvDataService not available; skipping tooltip CSV enrichment.');
                return;
            }

            const base = '/static/assets/data';
            const eventsUrl = `${base}/events.csv`;
            const exhibitorsUrl = `${base}/exhibitors.csv`;
            const assignmentsUrl = `${base}/event_exhibitor_booth_assignments.csv`;

            const { events, exhibitors, assignments } = await window.CsvDataService.loadAllCSVData(
                eventsUrl,
                exhibitorsUrl,
                assignmentsUrl
            );

            this.boothDataMap = window.CsvDataService.buildBoothDataMap(events, exhibitors, assignments);
            this._csvLoaded = true;

            console.log('✓ Tooltip CSV data loaded:', {
                events: events.length,
                exhibitors: exhibitors.length,
                assignments: assignments.length,
                booths: Object.keys(this.boothDataMap || {}).length
            });
        } catch (err) {
            console.warn('Tooltip CSV load failed:', err);
            this._csvLoaded = false;
        }
    }

    _buildTooltipExtraHTML(node) {
        try {
            if (!this.boothDataMap || typeof this.boothDataMap !== 'object') return '';

            const hallNameRaw = (node?.name ?? '').toString().trim();
            const hallNameKey = hallNameRaw.toLowerCase();
            if (!hallNameKey) return '';

            const boothEntries = Object.values(this.boothDataMap)
                .filter(b => (b?.hallName ?? '').toString().trim().toLowerCase() === hallNameKey);

            if (boothEntries.length === 0) return '';

            const exhibitorMap = new Map();
            const eventMap = new Map();
            let boothCodes = [];

            for (const b of boothEntries) {
                if (b?.boothCode) boothCodes.push(b.boothCode);
                (b?.exhibitors || []).forEach(ex => {
                    if (ex?.id && !exhibitorMap.has(ex.id)) exhibitorMap.set(ex.id, ex);
                });
                (b?.events || []).forEach(ev => {
                    if (ev?.id && !eventMap.has(ev.id)) eventMap.set(ev.id, ev);
                });
            }

            boothCodes = boothCodes.filter(Boolean);
            const exhibitors = Array.from(exhibitorMap.values());
            const events = Array.from(eventMap.values());

            const fmtDate = (d) => (window.CsvDataService?.formatDate ? window.CsvDataService.formatDate(d) : (d || 'N/A'));

            const maxList = 6;
            const exhibitorList = exhibitors.slice(0, maxList).map(ex => {
                const meta = [ex.industry, ex.country].filter(Boolean).join(' • ');
                return `<li><strong>${escapeHtml(ex.name || ex.id)}</strong>${meta ? ` <span style=\"opacity:.8\">(${escapeHtml(meta)})</span>` : ''}</li>`;
            }).join('');

            const eventList = events.slice(0, maxList).map(ev => {
                const when = ev.startDate ? fmtDate(ev.startDate) : '';
                const venue = ev.venue ? ` • ${escapeHtml(ev.venue)}` : '';
                return `<li><strong>${escapeHtml(ev.name || ev.id)}</strong>${when ? ` <span style=\"opacity:.85\">(${escapeHtml(when)}${venue})</span>` : venue ? ` <span style=\"opacity:.85\">(${venue.replace(' • ','')})</span>` : ''}</li>`;
            }).join('');

            const extra = [];
            extra.push('<hr style=\"border:none;border-top:1px solid rgba(255,255,255,0.15);margin:10px 0\">');
            extra.push(`<div style=\"font-size:12px; opacity:.95\"><strong>CSV Insights</strong></div>`);
            extra.push(`<div style=\"margin-top:6px; font-size:12px; opacity:.9\">` +
                `<strong>Booths in this hall:</strong> ${boothEntries.length}` +
                (boothCodes.length ? ` <span style=\"opacity:.75\">(e.g., ${escapeHtml(boothCodes.slice(0, 3).join(', '))}${boothCodes.length > 3 ? ', …' : ''})</span>` : '') +
                `</div>`);

            if (events.length) {
                extra.push(`<div style=\"margin-top:8px; font-size:12px\"><strong>Events</strong> <span style=\"opacity:.75\">(${events.length})</span></div>`);
                extra.push(`<ul style=\"margin:6px 0 0 18px; padding:0\">${eventList}</ul>`);
                if (events.length > maxList) extra.push(`<div style=\"font-size:11px; opacity:.7; margin-top:4px\">+${events.length - maxList} more</div>`);
            }

            if (exhibitors.length) {
                extra.push(`<div style=\"margin-top:8px; font-size:12px\"><strong>Exhibitors</strong> <span style=\"opacity:.75\">(${exhibitors.length})</span></div>`);
                extra.push(`<ul style=\"margin:6px 0 0 18px; padding:0\">${exhibitorList}</ul>`);
                if (exhibitors.length > maxList) extra.push(`<div style=\"font-size:11px; opacity:.7; margin-top:4px\">+${exhibitors.length - maxList} more</div>`);
            }

            return extra.join('');
        } catch (e) {
            console.warn('Tooltip enrichment failed:', e);
            return '';
        }
    }

async loadIoTData() {
        this.updateStatus('Loading IoT telemetry...', true);
        try {
            const summaryResp = await fetch(`${API_BASE}/iot/summary`, { cache: 'no-store' });
            this.iotSummary = await summaryResp.json().catch(() => null);
            
            const dataResp = await fetch(`${API_BASE}/iot/data`, { cache: 'no-store' });
            this.iotData = await dataResp.json().catch(() => ({}));
            
            if (this.iotSummary.telemetry_enabled) {
                console.log('✓ IoT Telemetry loaded:', this.iotSummary);
                this.updateIoTDisplay();
            } else {
                console.log('⚠ IoT Telemetry not available');
                const el = document.getElementById('iot-status');
                if (el) el.textContent = 'Offline';
                document.getElementById('iot-panel').style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading IoT data:', error);
            const el = document.getElementById('iot-status');
            if (el) el.textContent = 'Offline';
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
        if (this.layers.corridorOutlines) this.layers.corridorOutlines.removeChildren();
        
        this.renderCorridors();
        this.renderRooms();

        if (!this._robustHoverInitialized) {
            this._setupRobustHoverTooltips();
            this._robustHoverInitialized = true;
        }
        
        // HEATMAP: Render overlay after halls are drawn
        this._updateHeatmapOverlay();
        
        this.centerMap();
        this.updateStatus('Map rendered', false);
    }

    // HEATMAP: Main heatmap overlay rendering method
    // Called after renderMap completes and when telemetry/toggle changes
    _updateHeatmapOverlay() {
        // Clear existing overlay
        if (this.heatmapOverlayContainer) {
            this.heatmapOverlayContainer.removeChildren();
        }
        
        // Exit early if disabled or no data
        if (!this.heatmapEnabled) return;
        if (!this.navmeshData || !this.iotData) return;
        
        const roomNodes = this.navmeshData.nodes.filter(n => n.type === 'room');
        if (roomNodes.length === 0) return;
        
        // Find max occupancy for normalization
        let maxOccupancy = 0;
        roomNodes.forEach(node => {
            const occ = this.iotData[node.id] || 0;
            if (occ > maxOccupancy) maxOccupancy = occ;
        });
        
        // Avoid division by zero
        if (maxOccupancy === 0) maxOccupancy = 1;
        
        // Render overlay polygon for each hall
        roomNodes.forEach(node => {
            const rawOccupancy = this.iotData[node.id] || 0;
            
            // Skip if zero occupancy (transparent)
            if (rawOccupancy === 0) return;
            
            // Normalize intensity 0..1
            const intensity = rawOccupancy / maxOccupancy;
            
            // Map intensity to color: blue → cyan → yellow → orange → red
            const colorData = this._getHeatmapColor(intensity);
            
            const graphics = new PIXI.Graphics();
            graphics.beginFill(colorData.color, colorData.alpha);
            graphics.lineStyle(0); // No border
            
            const polygon = node.polygon;
            if (!polygon || polygon.length < 3) return;
            
            graphics.moveTo(polygon[0][0], polygon[0][1]);
            for (let i = 1; i < polygon.length; i++) {
                graphics.lineTo(polygon[i][0], polygon[i][1]);
            }
            graphics.closePath();
            graphics.endFill();
            
            this.heatmapOverlayContainer.addChild(graphics);
        });
    }
    
    // HEATMAP: Color mapping function
    // Maps normalized intensity [0..1] to color stops: blue → cyan → yellow → orange → red
    // Returns { color: 0xRRGGBB, alpha: number }
    _getHeatmapColor(intensity) {
        // Clamp intensity
        intensity = Math.max(0, Math.min(1, intensity));
        
        // Color stops with linear interpolation
        // Stop 0.0: Blue (0x0066ff)
        // Stop 0.25: Cyan (0x00ffff)
        // Stop 0.5: Yellow (0xffff00)
        // Stop 0.75: Orange (0xff9900)
        // Stop 1.0: Red (0xff0000)
        
        let color;
        if (intensity <= 0.25) {
            // Interpolate blue → cyan
            const t = intensity / 0.25;
            color = this._lerpColor(0x0066ff, 0x00ffff, t);
        } else if (intensity <= 0.5) {
            // Interpolate cyan → yellow
            const t = (intensity - 0.25) / 0.25;
            color = this._lerpColor(0x00ffff, 0xffff00, t);
        } else if (intensity <= 0.75) {
            // Interpolate yellow → orange
            const t = (intensity - 0.5) / 0.25;
            color = this._lerpColor(0xffff00, 0xff9900, t);
        } else {
            // Interpolate orange → red
            const t = (intensity - 0.75) / 0.25;
            color = this._lerpColor(0xff9900, 0xff0000, t);
        }
        
        // Modest opacity so halls remain visible: 0.35 at low intensity, 0.65 at high
        const alpha = 0.35 + (intensity * 0.3);
        
        return { color, alpha };
    }
    
    // HEATMAP: Linear interpolation between two hex colors
    _lerpColor(color1, color2, t) {
        const r1 = (color1 >> 16) & 0xff;
        const g1 = (color1 >> 8) & 0xff;
        const b1 = color1 & 0xff;
        
        const r2 = (color2 >> 16) & 0xff;
        const g2 = (color2 >> 8) & 0xff;
        const b2 = color2 & 0xff;
        
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        
        return (r << 16) | (g << 8) | b;
    }

    renderCorridors() {
        if (!this.navmeshData.corridor_polygons) return;

        if (this.layers.corridorOutlines) this.layers.corridorOutlines.removeChildren();

        this.navmeshData.corridor_polygons.forEach(corridor => {
            const polygon = corridor?.polygon;
            if (!polygon || polygon.length < 3) return;

            const fillG = new PIXI.Graphics();
            fillG.zIndex = 10;
            fillG.beginFill(0x9e2a2b, 0.30);
            fillG.moveTo(polygon[0][0], polygon[0][1]);
            for (let i = 1; i < polygon.length; i++) fillG.lineTo(polygon[i][0], polygon[i][1]);
            fillG.closePath();
            fillG.endFill();
            this.layers.corridors.addChild(fillG);

            const outG = new PIXI.Graphics();
            outG.zIndex = 11;

            outG.lineStyle(12, 0x111111, 0.95);
            outG.moveTo(polygon[0][0], polygon[0][1]);
            for (let i = 1; i < polygon.length; i++) outG.lineTo(polygon[i][0], polygon[i][1]);
            outG.closePath();

            outG.lineStyle(6, 0xffffff, 0.95);
            outG.moveTo(polygon[0][0], polygon[0][1]);
            for (let i = 1; i < polygon.length; i++) outG.lineTo(polygon[i][0], polygon[i][1]);
            outG.closePath();

            if (this.layers.corridorOutlines) this.layers.corridorOutlines.addChild(outG);
        });
    }


    renderRooms() {
        const roomNodes = this.navmeshData.nodes.filter(n => n.type === 'room');
        this._roomHitTest = [];

        roomNodes.forEach((node, index) => {
            const graphics = new PIXI.Graphics();
            const style = this._getHallStyleByName(node.name || `Hall ${index + 1}`);
            graphics.beginFill(style.color, style.alpha);
            graphics.lineStyle(4, 0x000000, 1);
            
            const polygon = node.polygon;
            let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
            for (const pt of polygon) {
                if (pt[0] < minX) minX = pt[0];
                if (pt[0] > maxX) maxX = pt[0];
                if (pt[1] < minY) minY = pt[1];
                if (pt[1] > maxY) maxY = pt[1];
            }
            this._roomHitTest.push({ node, index, polygon, bbox: { minX, minY, maxX, maxY } });
            graphics.moveTo(polygon[0][0], polygon[0][1]);
            for (let i = 1; i < polygon.length; i++) {
                graphics.lineTo(polygon[i][0], polygon[i][1]);
            }
            graphics.closePath();
            graphics.endFill();

            try {
                graphics.eventMode = 'none';
            } catch (_) {
                graphics.interactive = false;
            }

            this.layers.rooms.addChild(graphics);
            
            const text = new PIXI.Text(node.name || `Hall ${index + 1}`, {
                fontFamily: 'Arial',
                fontSize: 48,
                fontWeight: '',
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

    _pointInPolygon(x, y, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i][0], yi = poly[i][1];
            const xj = poly[j][0], yj = poly[j][1];
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    _screenToWorld(clientX, clientY) {
        const rect = this.app.view.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const global = new PIXI.Point(x, y);
        const local = this.app.stage.toLocal(global);
        return { x: local.x, y: local.y };
    }

    _setupRobustHoverTooltips() {
        this.app.view.addEventListener('pointermove', (e) => {
            if (this._isDragging) return;

            const world = this._screenToWorld(e.clientX, e.clientY);
            let hit = null;

            for (const item of this._roomHitTest) {
                const b = item.bbox;
                if (world.x < b.minX || world.x > b.maxX || world.y < b.minY || world.y > b.maxY) continue;
                if (this._pointInPolygon(world.x, world.y, item.polygon)) {
                    hit = item;
                    break;
                }
            }

            if (!hit) {
                if (this._hoveredRoomId !== null) {
                    this._hoveredRoomId = null;
                    this.hideEventTooltip();
                }
                return;
            }

            this._hoveredRoomId = hit.node.id;
            this.showEventTooltip(hit.node, hit.index, e.clientX, e.clientY, true);
        });

        this.app.view.addEventListener('pointerleave', () => {
            this._hoveredRoomId = null;
            this.hideEventTooltip();
        });
    }

    showEventTooltip(node, index, screenX, screenY, isClientCoords = false) {
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
            ${this._buildTooltipExtraHTML(node) || ''}
        `;

        const container = document.getElementById('canvas-container');
        const rect = container.getBoundingClientRect();
        let x = (typeof screenX === 'number' ? screenX : rect.width / 2);
        let y = (typeof screenY === 'number' ? screenY : rect.height / 2);
        if (isClientCoords) {
            x = x - rect.left;
            y = y - rect.top;
        }

        const pad = 14;
        let left = x + pad;
        let top = y + pad;

        tooltip.classList.add('visible');

        const tipRect = tooltip.getBoundingClientRect();
        const maxLeft = rect.left + rect.width - tipRect.width - 8;
        const maxTop = rect.top + rect.height - tipRect.height - 8;

        if (left > maxLeft) left = x - tipRect.width - pad;
        if (top > maxTop) top = y - tipRect.height - pad;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    hideEventTooltip() {
        const tooltip = document.getElementById('event-tooltip');
        tooltip.classList.remove('visible');
    }

    centerMap() {
        if (!this.navmeshData?.scale_info?.svg_dimensions) return;
        const mapW = this.navmeshData.scale_info.svg_dimensions.width;
        const mapH = this.navmeshData.scale_info.svg_dimensions.height;
        const screenW = this.app.screen.width;
        const screenH = this.app.screen.height;
        const scaleX = screenW / mapW;
        const scaleY = screenH / mapH;
        this.viewport.zoom = Math.min(scaleX, scaleY) * 0.9;
        this.viewport.x = (screenW / this.viewport.zoom - mapW) / 2;
        this.viewport.y = (screenH / this.viewport.zoom - mapH) / 2;
        this._clampViewportToMap();
        this.updateViewport();
    }

    async findPath() {
        const startId = document.getElementById('startRoom').value;
        const endId = document.getElementById('endRoom').value;
        
        if (!startId || !endId) {
            this.updateStatus('Please select both start and end locations', false);
            return;
        }

        this.updateStatus('Finding optimal path...', true);
        
        try {
            const response = await fetch(
                `${API_BASE}/path?start=${startId}&end=${endId}&avoid_crowds=${this.crowdAvoidance}`,
                { cache: 'no-store' }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.currentPath = data;
            
            this.renderPath(data);
            this.displayPathInfo(data);
            
            const dist = data.distance.toFixed(1);
            const time = data.estimated_time.toFixed(1);
            this.updateStatus(`Path found: ${dist}m, ~${time} min`, false);
            
        } catch (error) {
            console.error('Error finding path:', error);
            this.updateStatus('Error finding path', false);
        }
    }

    renderPath(pathData) {
        this.layers.path.removeChildren();
        
        const line = new PIXI.Graphics();
        line.lineStyle(8, 0x4CAF50, 0.8);
        
        const waypoints = pathData.waypoints;
        if (waypoints && waypoints.length > 0) {
            line.moveTo(waypoints[0][0], waypoints[0][1]);
            for (let i = 1; i < waypoints.length; i++) {
                line.lineTo(waypoints[i][0], waypoints[i][1]);
            }
        }
        
        this.layers.path.addChild(line);
        
        if (waypoints && waypoints.length > 0) {
            const startMarker = new PIXI.Graphics();
            startMarker.beginFill(0x4CAF50);
            startMarker.drawCircle(0, 0, 20);
            startMarker.endFill();
            startMarker.position.set(waypoints[0][0], waypoints[0][1]);
            this.layers.path.addChild(startMarker);
            
            const endMarker = new PIXI.Graphics();
            endMarker.beginFill(0xFF5252);
            endMarker.drawCircle(0, 0, 20);
            endMarker.endFill();
            const last = waypoints[waypoints.length - 1];
            endMarker.position.set(last[0], last[1]);
            this.layers.path.addChild(endMarker);
        }
    }

    displayPathInfo(pathData) {
        const pathInfo = document.getElementById('path-info');
        const pathSteps = document.getElementById('path-steps');
        
        pathSteps.innerHTML = `
            <div><strong>Distance:</strong> ${pathData.distance.toFixed(1)}m</div>
            <div><strong>Estimated Time:</strong> ${pathData.estimated_time.toFixed(1)} minutes</div>
            <div><strong>Path Type:</strong> ${this.crowdAvoidance ? 'Crowd-Aware' : 'Shortest'}</div>
        `;
        
        if (pathData.path_crowding && pathData.path_crowding.length > 0) {
            const crowdInfo = document.createElement('div');
            crowdInfo.style.marginTop = '10px';
            crowdInfo.innerHTML = '<strong>Hall Occupancy:</strong>';
            
            pathData.path_crowding.forEach(item => {
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
        
        document.getElementById('crowdToggle').addEventListener('change', () => this.toggleCrowdAvoidance());

        // HEATMAP: Inject simple toggle UI
        this._injectHeatmapToggleUI();
        
        document.addEventListener('mousemove', (event) => {
            const tooltip = document.getElementById('event-tooltip');
            tooltip.style.left = (event.clientX + 20) + 'px';
            tooltip.style.top = (event.clientY + 20) + 'px';
        });
    }

	// HEATMAP: Simple UI toggle (checkbox in top-right corner)
	// Creates a small floating panel with checkbox and legend
	_injectHeatmapToggleUI() {
		if (document.getElementById('heatmap-toggle-panel')) return;

		const panel = document.createElement('div');
		panel.id = 'heatmap-toggle-panel';
		panel.style.position = 'absolute';
		panel.style.top = '12px';
		panel.style.right = '12px';
		panel.style.zIndex = '9999';
		panel.style.background = 'rgba(255, 255, 255, 0.95)';
		panel.style.border = '2px solid #333';
		panel.style.borderRadius = '8px';
		panel.style.padding = '12px 16px';
		panel.style.fontFamily = 'system-ui, -apple-system, Arial';
		panel.style.fontSize = '13px';
		panel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
		panel.style.userSelect = 'none';
		panel.style.minWidth = '200px';

		panel.innerHTML = `
			<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
				<input type="checkbox" id="heatmap-checkbox" ${this.heatmapEnabled ? 'checked' : ''} 
					   style="width:18px;height:18px;cursor:pointer">
				<label for="heatmap-checkbox" style="cursor:pointer;font-weight:600;font-size:14px">
					Show Heatmap
				</label>
			</div>
			<div style="font-size:11px;opacity:0.75;line-height:1.4">
				Visualizes hall occupancy:<br>
				<span style="color:#0066ff">●</span> Low →
				<span style="color:#00ffff">●</span> →
				<span style="color:#ffff00">●</span> →
				<span style="color:#ff9900">●</span> →
				<span style="color:#ff0000">●</span> High
			</div>
		`;

		document.body.appendChild(panel);

		const checkbox = document.getElementById('heatmap-checkbox');
		checkbox.addEventListener('change', (e) => {
			this.heatmapEnabled = e.target.checked;
			console.log('Heatmap overlay:', this.heatmapEnabled ? 'enabled' : 'disabled');
			// Re-render heatmap overlay
			this._updateHeatmapOverlay();
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

// Utility function for escaping HTML in tooltips
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    new ConventionCenterApp();
});
