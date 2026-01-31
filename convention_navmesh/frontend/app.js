// app.js - PixiJS Convention Center Navigation

const API_BASE = 'http://localhost:5000/api';

class ConventionCenterApp {
    constructor() {
        this.app = null;
        this.navmeshData = null;
        this.currentPath = null;
        this.viewport = {
            zoom: 1,
            x: 0,
            y: 0
        };
        this.layers = {
            background: null,
            rooms: null,
            corridors: null,
            path: null,
            interactive: null
        };
        
        this.init();
    }

    async loadMapBackground(svgWidth, svgHeight) {
  const imageUrl = '/static/assets/convention_map.png';
  console.log('[BG] Loading (safe):', imageUrl);

  // Remove old background if any
  if (this.bgSprite) {
    this.bgSprite.destroy(true);
    this.bgSprite = null;
  }

  const gl = this.app?.renderer?.gl;
  const maxTex = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096;
  console.log('[BG] MAX_TEXTURE_SIZE =', maxTex);

  // 1) Fetch as Blob (does NOT touch WebGL)
  let blob;
  try {
    const res = await fetch(imageUrl, { cache: 'no-store' });
    if (!res.ok) {
      console.error('[BG] HTTP error loading PNG:', res.status, res.statusText);
      return;
    }
    blob = await res.blob();
  } catch (e) {
    console.error('[BG] Fetch failed:', e);
    return;
  }

  // 2) Decode to ImageBitmap (still no WebGL)
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (e) {
    console.error('[BG] createImageBitmap failed:', e);
    return;
  }

  console.log('[BG] Source image size:', bitmap.width, 'x', bitmap.height);

  // 3) If too large, downscale in a canvas BEFORE creating texture
  let sourceForTexture = bitmap;

  const tooLarge = bitmap.width > maxTex || bitmap.height > maxTex;
  if (tooLarge) {
    const scale = Math.min(maxTex / bitmap.width, maxTex / bitmap.height);
    const targetW = Math.max(1, Math.floor(bitmap.width * scale));
    const targetH = Math.max(1, Math.floor(bitmap.height * scale));

    console.warn(
      `[BG] Image exceeds MAX_TEXTURE_SIZE. Downscaling to ${targetW}x${targetH} before uploading to GPU.`
    );

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    sourceForTexture = canvas;
  }

  // 4) Create texture safely from bitmap/canvas (now touches WebGL)
  let texture;
  try {
    texture = PIXI.Texture.from(sourceForTexture);
  } catch (e) {
    console.error('[BG] Texture.from failed (likely WebGL context issue):', e);
    return;
  }

  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0, 0);
  sprite.x = 0;
  sprite.y = 0;

  // IMPORTANT: Keep alignment with SVG coordinate space
  sprite.width = svgWidth;
  sprite.height = svgHeight;

  // Do not block pointer events
  try { sprite.eventMode = 'none'; } catch (_) { sprite.interactive = false; }

  sprite.zIndex = -9999;

  this.app.stage.addChild(sprite);
  if (this.app.stage.sortableChildren) this.app.stage.sortChildren();

  this.bgSprite = sprite;

  console.log('[BG] Background added OK.');
}



    async init() {
        // Initialize PixiJS
        this.setupPixi();
        
        // Load navmesh data
        await this.loadNavmesh();
        
        // Setup UI
        this.setupUI();
        
        // Render map
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
        // Keep GPU load low without touching read-only props
try {
  // Pixi v7: use canvas options rather than autoDensity
  this.app.renderer.resolution = 1;
} catch (_) {}

        this.app.stage.sortableChildren = true;
        // Create layers
        this.layers.background = new PIXI.Container();
        this.layers.rooms = new PIXI.Container();
        this.layers.corridors = new PIXI.Container();
        this.layers.path = new PIXI.Container();
        this.layers.interactive = new PIXI.Container();

        this.app.stage.addChild(this.layers.background);
        this.app.stage.addChild(this.layers.corridors);
        this.app.stage.addChild(this.layers.rooms);
        this.app.stage.addChild(this.layers.path);
        this.app.stage.addChild(this.layers.interactive);

        // Enable interactivity
        this.app.stage.interactive = true;
        this.app.stage.hitArea = this.app.screen;

        // Pan and zoom controls
        this.setupPanZoom();

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    // setupPanZoom, zoom, resetView, updateViewport, handleResize

    setupPanZoom() {
        // Robust pan/zoom with viewport as single source of truth.
        // viewport.zoom in [0.25..6]
        // viewport.x / viewport.y represent stage.position / zoom (world-space translation)

        // Ensure the stage receives pointer events anywhere
        try {
            this.app.stage.eventMode = 'static';
        } catch (_) {
            this.app.stage.interactive = true;
        }
        this.app.stage.hitArea = this.app.screen;

        // PANNING: do it at the DOM level so dragging works anywhere on the canvas,
        // even when Pixi hit-testing misses (empty background areas / tiny gaps).
        let isDragging = false;
        let dragStartScreen = { x: 0, y: 0 };
        let startViewport = { x: 0, y: 0 };
        let activePointerId = null;

        const onDomPointerDown = (e) => {
            // Only primary button / primary touch
            if (typeof e.button === 'number' && e.button !== 0) return;
            isDragging = true;
            activePointerId = e.pointerId;
            dragStartScreen = { x: e.clientX, y: e.clientY };
            startViewport = { x: this.viewport.x, y: this.viewport.y };
            // Capture so we keep getting move events even if pointer leaves the canvas
            try { this.app.view.setPointerCapture(e.pointerId); } catch (_) {}
        };

        const onDomPointerMove = (e) => {
            if (!isDragging) return;
            if (activePointerId !== null && e.pointerId !== activePointerId) return;

            const dx = (e.clientX - dragStartScreen.x) / this.viewport.zoom;
            const dy = (e.clientY - dragStartScreen.y) / this.viewport.zoom;

            this.viewport.x = startViewport.x + dx;
            this.viewport.y = startViewport.y + dy;

            this._clampViewportToMap();
            this.updateViewport();
        };

        const onDomPointerUp = (e) => {
            if (activePointerId !== null && e.pointerId !== activePointerId) return;
            isDragging = false;
            activePointerId = null;
            try { this.app.view.releasePointerCapture(e.pointerId); } catch (_) {}
        };

        // Attach DOM listeners on the canvas so panning works literally anywhere on the map/screen.
        this.app.view.addEventListener('pointerdown', onDomPointerDown);
        window.addEventListener('pointermove', onDomPointerMove);
        window.addEventListener('pointerup', onDomPointerUp);
        window.addEventListener('pointercancel', onDomPointerUp);

        // Zoom-to-cursor
        this.app.view.addEventListener('wheel', (event) => {
            event.preventDefault();

            const rect = this.app.view.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            const oldZoom = this.viewport.zoom;
            const zoomStep = 1.08;
            const factor = event.deltaY > 0 ? 1 / zoomStep : zoomStep;
            const newZoom = this._clamp(oldZoom * factor, 0.25, 6.0);

            // World coords under cursor before zoom:
            // stageX = (viewport.x * oldZoom), so worldX = (mouseX - stageX)/oldZoom = mouseX/oldZoom - viewport.x
            const worldX = (mouseX / oldZoom) - this.viewport.x;
            const worldY = (mouseY / oldZoom) - this.viewport.y;

            // Update zoom
            this.viewport.zoom = newZoom;

            // Keep cursor pointing at same world coordinate:
            // mouseX/newZoom - viewport.x' = worldX  => viewport.x' = mouseX/newZoom - worldX
            this.viewport.x = (mouseX / newZoom) - worldX;
            this.viewport.y = (mouseY / newZoom) - worldY;

            this._clampViewportToMap();
            this.updateViewport();
        }, { passive: false });
    }

    _clampViewportToMap() {
        // Keep viewport translation within reasonable bounds so it can't explode to huge values.
        // If we have map dimensions, constrain so some portion remains on screen.
        if (!this.navmeshData?.scale_info?.svg_dimensions) return;

        const mapW = this.navmeshData.scale_info.svg_dimensions.width;
        const mapH = this.navmeshData.scale_info.svg_dimensions.height;

        const screenW = this.app.screen.width / this.viewport.zoom;
        const screenH = this.app.screen.height / this.viewport.zoom;

        // Allow panning a bit beyond edges (10% margin)
        const marginX = mapW * 0.1;
        const marginY = mapH * 0.1;

        // FIXED: Ensure min <= max by using Math.min/max correctly
        // Left edge: map left can be at most marginX from right screen edge
        // Right edge: map right can be at least -marginX from left screen edge
        const minX = Math.min(-mapW - marginX + screenW, marginX);
        const maxX = Math.max(marginX, -mapW - marginX + screenW);
        const minY = Math.min(-mapH - marginY + screenH, marginY);
        const maxY = Math.max(marginY, -mapH - marginY + screenH);

        this.viewport.x = this._clamp(this.viewport.x, minX, maxX);
        this.viewport.y = this._clamp(this.viewport.y, minY, maxY);
    }




    resetView() {
        // Reset to a fit view (preferred) if scale_info exists; else default
        if (this.navmeshData && this.navmeshData.scale_info) {
            this.centerMap();
            return;
        }
        this.viewport = { zoom: 1, x: 0, y: 0 };
        this.updateViewport();
    }

    updateViewport() {
        // Safety check: if viewport has escaped to absurd values, reset it
        const maxSane = 1000000; // 1 million pixels is already insane
        if (Math.abs(this.viewport.x) > maxSane || Math.abs(this.viewport.y) > maxSane) {
            console.warn('[VIEWPORT] Detected escaped coordinates, resetting:', this.viewport);
            this.viewport = { zoom: 1, x: 0, y: 0 };
        }
        
        // Single source of truth: viewport -> stage
        this.app.stage.scale.set(this.viewport.zoom);
        this.app.stage.position.set(
            this.viewport.x * this.viewport.zoom,
            this.viewport.y * this.viewport.zoom
        );
    }

    handleResize() {
        const container = document.getElementById('canvas-container');
        this.app.renderer.resize(container.clientWidth, container.clientHeight);

        // Keep drag-anywhere hit area correct
        this.app.stage.hitArea = this.app.screen;

        // You requested refit on resize
        this.centerMap();
    }

    _clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }


    async loadNavmesh() {
        this.updateStatus('Loading navigation mesh...', true);
        
        try {
            const response = await fetch(`http://localhost:5000/api/navmesh`);
            this.navmeshData = await response.json();
            // Load real floorplan as background
            const svgW = this.navmeshData.scale_info.svg_dimensions.width;
            const svgH = this.navmeshData.scale_info.svg_dimensions.height;

            await this.loadMapBackground('assets/convention_map.png', // or .svg
                svgW,
                svgH
            );

            console.log('âœ“ Navmesh loaded:', this.navmeshData);            
            // Update UI stats
            document.getElementById('node-count').textContent = this.navmeshData.nodes.length;
            document.getElementById('edge-count').textContent = this.navmeshData.edges.length;
            document.getElementById('room-count').textContent = this.navmeshData.rooms.length;
            
            // Populate room dropdowns
            this.populateRoomDropdowns();
            
        } catch (error) {
            console.error('Error loading navmesh:', error);
            this.updateStatus('Error loading data', false);
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
        
        // Clear existing graphics
        this.layers.rooms.removeChildren();
        this.layers.corridors.removeChildren();
        
        // Render corridors (walkable areas)
        this.renderCorridors();
        
        // Render rooms
        this.renderRooms();
        
        // Center the map
        this.centerMap();
        
        this.updateStatus('Map rendered', false);
    }

    renderCorridors() {
        // First, render the actual corridor polygons from the SVG (visual representation)
        if (this.navmeshData.corridor_polygons) {
            this.navmeshData.corridor_polygons.forEach(corridor => {
                if (corridor.polygon && corridor.polygon.length >= 3) {
                    const graphics = new PIXI.Graphics();
                    
                    // Render corridor with a clearly visible outline
                    // Fill stays subtle; outline is what the user needs to see.
                    graphics.beginFill(0xff00ff, 0.12);
                    graphics.lineStyle(3, 0xff00ff, 0.85);
                    
                    const polygon = corridor.polygon;
                    graphics.moveTo(polygon[0][0], polygon[0][1]);
                    for (let i = 1; i < polygon.length; i++) {
                        graphics.lineTo(polygon[i][0], polygon[i][1]);
                    }
                    graphics.closePath();
                    graphics.endFill();

                    // Keep corridors behind halls but above background
                    graphics.zIndex = 10;
                    
                    this.layers.corridors.addChild(graphics);
                }
            });
        }
        
        // Optional: Also render corridor navigation nodes as small points for debugging
        // (Comment this out if you only want the corridor polygons)
        /*
        const corridorNodes = this.navmeshData.nodes.filter(n => n.type === 'corridor');
        corridorNodes.forEach(node => {
            const pos = node.position;
            if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;

            const graphics = new PIXI.Graphics();
            graphics.beginFill(0x999999, 0.3);
            graphics.drawCircle(pos.x, pos.y, 4);
            graphics.endFill();

            this.layers.corridors.addChild(graphics);
        });
        */
    }


    renderRooms() {
        const roomNodes = this.navmeshData.nodes.filter(n => n.type === 'room');
        
        roomNodes.forEach((node, index) => {
            const graphics = new PIXI.Graphics();
            
            // Draw room polygon
            graphics.beginFill(0xefefef, 0.6);
            graphics.lineStyle(2, 0xcccccc, 0.8);
            
            const polygon = node.polygon;
            graphics.moveTo(polygon[0][0], polygon[0][1]);
            for (let i = 1; i < polygon.length; i++) {
                graphics.lineTo(polygon[i][0], polygon[i][1]);
            }
            graphics.closePath();
            graphics.endFill();

            // Make hover hit-testing reliable by providing an explicit polygon hitArea.
            // Pixi's default Graphics hit-test can be finicky for complex/self-intersecting paths.
            try {
                const flat = [];
                for (let i = 0; i < polygon.length; i++) {
                    flat.push(polygon[i][0], polygon[i][1]);
                }
                graphics.hitArea = new PIXI.Polygon(flat);
            } catch (_) {
                // If a polygon is malformed, fall back to default hit testing.
            }
            
            // Make interactive for event hover
            try {
                graphics.eventMode = 'static';
                graphics.cursor = 'pointer';
            } catch (_) {
                graphics.interactive = true;
                graphics.buttonMode = true;
            }
            
            graphics.on('pointerover', () => {
                graphics.tint = 0xaaffff;
                this.showEventTooltip(node, index);
            });
            
            graphics.on('pointerout', () => {
                graphics.tint = 0xffffff;
                this.hideEventTooltip();
            });
            
            this.layers.rooms.addChild(graphics);
            
            // Add room label
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

            // Ensure text never steals hover events from the hall polygon.
            try { text.eventMode = 'none'; } catch (_) { text.interactive = false; }
            
            this.layers.rooms.addChild(text);
        });
    }

    showEventTooltip(node, index) {
        // Mock event data - in production, fetch from API
        const tooltip = document.getElementById('event-tooltip');
        const title = document.getElementById('tooltip-title');
        const content = document.getElementById('tooltip-content');
        
        title.textContent = `Hall ${index + 1}`;
        content.innerHTML = `
            <strong>Event:</strong> Tech Conference<br>
            <strong>Time:</strong> 10:00 AM - 2:00 PM<br>
            <strong>Capacity:</strong> 250 people
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
        
        // Calculate zoom to fit
        const zoomX = canvasWidth / mapWidth;
        const zoomY = canvasHeight / mapHeight;
        this.viewport.zoom = Math.min(zoomX, zoomY) * 0.9;
        
        // Center
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
            const response = await fetch(`http://localhost:5000/api/pathfind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start: startId, end: endId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentPath = result;
                this.renderPath();
                this.showPathInfo();
                this.updateStatus(`Route found: ${result.distance.meters.toFixed(1)}m`, false);
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
        
        // Clear previous path
        this.layers.path.removeChildren();
        
        const graphics = new PIXI.Graphics();
        const coords = this.currentPath.path_coordinates;
        
        // Draw path line
        graphics.lineStyle(8, 0x00d4ff, 1);
        graphics.moveTo(coords[0].x, coords[0].y);
        
        for (let i = 1; i < coords.length; i++) {
            graphics.lineTo(coords[i].x, coords[i].y);
        }
        
        this.layers.path.addChild(graphics);
        
        // Draw start point
        const startPoint = new PIXI.Graphics();
        startPoint.beginFill(0x4caf50);
        startPoint.drawCircle(coords[0].x, coords[0].y, 15);
        startPoint.endFill();
        this.layers.path.addChild(startPoint);
        
        // Draw end point
        const endPoint = new PIXI.Graphics();
        endPoint.beginFill(0xf44336);
        endPoint.drawCircle(coords[coords.length - 1].x, coords[coords.length - 1].y, 15);
        endPoint.endFill();
        this.layers.path.addChild(endPoint);
        
        // Draw intermediate points
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
        
        // Build path steps
        pathSteps.innerHTML = '';
        this.currentPath.path.forEach((nodeId, index) => {
            const step = document.createElement('div');
            step.className = 'path-step';
            
            const node = this.navmeshData.nodes.find(n => n.id === nodeId);
            let nodeName = nodeId;
            
            if (node && node.type === 'room') {
                const roomIndex = this.navmeshData.nodes.filter(n => n.type === 'room').indexOf(node);
                nodeName = `Hall ${roomIndex + 1}`;
            }
            
            step.textContent = `${index + 1}. ${nodeName}`;
            pathSteps.appendChild(step);
        });
        
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

    setupUI() {
        document.getElementById('findPath').addEventListener('click', () => this.findPath());
        document.getElementById('clearPath').addEventListener('click', () => this.clearPath());
        
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('resetView').addEventListener('click', () => this.resetView());
        
        // Tooltip follow mouse
        document.addEventListener('mousemove', (event) => {
            const tooltip = document.getElementById('event-tooltip');
            tooltip.style.left = (event.clientX + 20) + 'px';
            tooltip.style.top = (event.clientY + 20) + 'px';
        });
    }

    updateStatus(message, loading) {
        const statusText = document.getElementById('status-text');
        const loadingSpinner = document.querySelector('.loading');
        
        statusText.textContent = message;
        loadingSpinner.style.display = loading ? 'inline-block' : 'none';
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ConventionCenterApp();
});
