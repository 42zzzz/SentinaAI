import React, { useState, useEffect, useRef } from 'react';
import { useHalls } from '../context/HallsContext';
import { isPolygonHall, getRectBounds, getHallCenter } from '../data/hallsLayout';
import { parseSvg } from '../utils/svgParser';

function HallEditor({ onClose }) {
  const {
    halls,
    setHalls,
    selectedHallId,
    setSelectedHallId,
    editMode,
    setEditMode,
    selectedVertexIndex,
    setSelectedVertexIndex,
    updateHall,
    updateVertex,
    addVertex,
    removeVertex,
    convertToPolygon,
    resetHalls,
    importHalls
  } = useHalls();

  const [dragState, setDragState] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef(null);

  const selectedHall = halls.find(h => h.id === selectedHallId);

  // Calculate canvas bounds
  const allBounds = halls.map(h => getRectBounds(h));
  const allX = allBounds.map(b => b.x);
  const allY = allBounds.map(b => b.y);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allBounds.map((b, i) => b.x + b.width));
  const minY = Math.min(...allY);
  const maxY = Math.max(...allBounds.map((b, i) => b.y + b.height));
  
  const layoutWidth = maxX - minX;
  const layoutHeight = maxY - minY;
  
  const canvasWidth = 2000;
  const canvasHeight = 1200;
  
  const scaleX = (canvasWidth - 100) / layoutWidth;
  const scaleY = (canvasHeight - 100) / layoutHeight;
  const scale = Math.min(scaleX, scaleY, 1.5);
  
  const offsetX = (canvasWidth - layoutWidth * scale) / 2 - minX * scale;
  const offsetY = (canvasHeight - layoutHeight * scale) / 2 - minY * scale;

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedHallId && selectedVertexIndex !== null && editMode === 'vertex') {
          removeVertex(selectedHallId, selectedVertexIndex);
          setSelectedVertexIndex(null);
        }
      } else if (e.key === 'm' || e.key === 'M') {
        setEditMode('move');
      } else if (e.key === 'v' || e.key === 'V') {
        setEditMode('vertex');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedHallId, selectedVertexIndex, editMode, onClose, setEditMode, removeVertex, setSelectedVertexIndex]);

  // Mouse handlers
  const handleMouseDown = (e, hall, type, index) => {
    e.stopPropagation();
    setSelectedHallId(hall.id);
    
    if (type === 'vertex' && editMode === 'vertex') {
      setDragState({ type: 'vertex', hallId: hall.id, vertexIndex: index });
      setSelectedVertexIndex(index);
    } else if (type === 'edge' && editMode === 'vertex') {
      const bounds = getRectBounds(hall);
      const x = (e.clientX - e.currentTarget.getBoundingClientRect().left - offsetX) / scale;
      const y = (e.clientY - e.currentTarget.getBoundingClientRect().top - offsetY) / scale;
      addVertex(hall.id, index + 1, [Math.round(x), Math.round(y)]);
    } else if (type === 'hall') {
      setDragState({ type: 'hall', hallId: hall.id });
    }
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!dragState) return;

    const dx = (e.clientX - dragStart.x) / scale;
    const dy = (e.clientY - dragStart.y) / scale;

    if (dragState.type === 'vertex') {
      const hall = halls.find(h => h.id === dragState.hallId);
      if (hall && hall.vertices) {
        const vertex = hall.vertices[dragState.vertexIndex];
        let newX = vertex[0] + dx;
        let newY = vertex[1] + dy;

        // Snap to grid if Shift is pressed
        if (e.shiftKey) {
          const gridSize = 10;
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }

        updateVertex(dragState.hallId, dragState.vertexIndex, [Math.round(newX), Math.round(newY)]);
      }
    } else if (dragState.type === 'hall') {
      const hall = halls.find(h => h.id === dragState.hallId);
      if (isPolygonHall(hall)) {
        const newVertices = hall.vertices.map(v => [
          Math.round(v[0] + dx),
          Math.round(v[1] + dy)
        ]);
        updateHall(dragState.hallId, { vertices: newVertices });
      } else {
        updateHall(dragState.hallId, {
          x: Math.round(hall.x + dx),
          y: Math.round(hall.y + dy)
        });
      }
    }

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  const handleExport = () => {
    const exportData = `export const HALLS_LAYOUT = ${JSON.stringify(halls, null, 2)};`;
    const blob = new Blob([exportData], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hallsLayout-edited.js';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSvg = async () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const importedHalls = parseSvg(text);
    
    if (importedHalls.length > 0) {
      setHalls([...halls, ...importedHalls]);
      alert(`Imported ${importedHalls.length} halls from SVG`);
    } else {
      alert('No valid halls found in SVG file');
    }
  };

  return (
    <div className="hall-editor-overlay" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div className="hall-editor-container">
        <div className="editor-header">
          <h2>Hall Layout Editor</h2>
          <div className="mode-switcher">
            <button 
              className={editMode === 'move' ? 'active' : ''}
              onClick={() => setEditMode('move')}
            >
              Move Mode (M)
            </button>
            <button 
              className={editMode === 'vertex' ? 'active' : ''}
              onClick={() => setEditMode('vertex')}
            >
              Vertex Mode (V)
            </button>
          </div>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="editor-body">
          <svg
            width={canvasWidth}
            height={canvasHeight}
            className="editor-canvas"
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#222" strokeWidth="1"/>
              </pattern>
            </defs>
            
            <rect width={canvasWidth} height={canvasHeight} fill="url(#grid)" />
            
            {halls.map(hall => {
              const isSelected = selectedHallId === hall.id;
              
              if (isPolygonHall(hall)) {
                const pathData = hall.vertices.map((v, i) => {
                  const x = v[0] * scale + offsetX;
                  const y = v[1] * scale + offsetY;
                  return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                }).join(' ') + ' Z';
                
                const center = getHallCenter(hall);
                const labelX = center.x * scale + offsetX;
                const labelY = center.y * scale + offsetY;
                
                return (
                  <g key={hall.id}>
                    <path
                      d={pathData}
                      fill={hall.color}
                      fillOpacity="0.5"
                      stroke={isSelected ? '#4ade80' : '#000'}
                      strokeWidth={isSelected ? 3 : 1.5}
                      style={{ cursor: editMode === 'move' ? 'move' : 'default' }}
                      onMouseDown={(e) => handleMouseDown(e, hall, 'hall')}
                    />
                    
                    {editMode === 'vertex' && isSelected && hall.vertices.map((v, i) => {
                      const x = v[0] * scale + offsetX;
                      const y = v[1] * scale + offsetY;
                      const isVertexSelected = selectedVertexIndex === i;
                      
                      return (
                        <circle
                          key={`vertex-${i}`}
                          cx={x}
                          cy={y}
                          r={isVertexSelected ? 8 : 6}
                          fill={isVertexSelected ? '#ef4444' : '#4ade80'}
                          stroke="#000"
                          strokeWidth="2"
                          style={{ cursor: 'move' }}
                          onMouseDown={(e) => handleMouseDown(e, hall, 'vertex', i)}
                        />
                      );
                    })}
                    
                    {editMode === 'vertex' && isSelected && hall.vertices.map((v, i) => {
                      const nextI = (i + 1) % hall.vertices.length;
                      const v1 = hall.vertices[i];
                      const v2 = hall.vertices[nextI];
                      const midX = ((v1[0] + v2[0]) / 2) * scale + offsetX;
                      const midY = ((v1[1] + v2[1]) / 2) * scale + offsetY;
                      
                      return (
                        <circle
                          key={`edge-${i}`}
                          cx={midX}
                          cy={midY}
                          r={4}
                          fill="#3b82f6"
                          stroke="#000"
                          strokeWidth="1"
                          style={{ cursor: 'pointer' }}
                          onMouseDown={(e) => handleMouseDown(e, hall, 'edge', i)}
                        />
                      );
                    })}
                    
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fff"
                      fontSize={14}
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      {hall.telemetryId}
                    </text>
                  </g>
                );
              } else {
                const x = hall.x * scale + offsetX;
                const y = hall.y * scale + offsetY;
                const w = hall.width * scale;
                const h = hall.height * scale;
                
                return (
                  <g
                    key={hall.id}
                    transform={`translate(${x + w/2}, ${y + h/2}) rotate(${hall.rotation || 0}) translate(${-w/2}, ${-h/2})`}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={w}
                      height={h}
                      fill={hall.color}
                      fillOpacity="0.5"
                      stroke={isSelected ? '#4ade80' : '#000'}
                      strokeWidth={isSelected ? 3 : 1.5}
                      style={{ cursor: 'move' }}
                      onMouseDown={(e) => handleMouseDown(e, hall, 'hall')}
                    />
                    <text
                      x={w / 2}
                      y={h / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fff"
                      fontSize={Math.min(14, w / 6)}
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      {hall.telemetryId}
                    </text>
                  </g>
                );
              }
            })}
          </svg>

          <div className="editor-controls">
            <h3>Controls</h3>
            
            <div className="mode-indicator">
              <strong>Current Mode:</strong> {editMode === 'move' ? 'Move Halls' : 'Edit Vertices'}
            </div>

            {selectedHall && (
              <div className="selected-hall-info">
                <div className="control-group">
                  <label>Selected: {selectedHall.telemetryId}</label>
                  <div className="hall-info">
                    <span>Zone: {selectedHall.zone}</span>
                    <span>Type: {isPolygonHall(selectedHall) ? 'Polygon' : 'Rectangle'}</span>
                  </div>
                </div>

                {!isPolygonHall(selectedHall) && (
                  <div className="control-group">
                    <button onClick={() => convertToPolygon(selectedHallId)} className="btn-primary">
                      Convert to Polygon
                    </button>
                  </div>
                )}

                {editMode === 'vertex' && isPolygonHall(selectedHall) && (
                  <div className="vertex-help">
                    <p><strong>Vertex Editing:</strong></p>
                    <ul>
                      <li>Drag green circles to move vertices</li>
                      <li>Click blue circles to add vertices</li>
                      <li>Select vertex + Delete to remove</li>
                      <li>Hold Shift to snap to grid</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="control-group editor-actions">
              <button onClick={handleImportSvg} className="btn-secondary">
                Import SVG
              </button>
              <button onClick={handleExport} className="btn-primary">
                Export Layout JS
              </button>
              <button onClick={resetHalls} className="btn-secondary">
                Reset to Default
              </button>
            </div>

            <div className="editor-help">
              <h4>Keyboard Shortcuts:</h4>
              <ul>
                <li><kbd>M</kbd> - Move Mode</li>
                <li><kbd>V</kbd> - Vertex Mode</li>
                <li><kbd>Delete</kbd> - Remove Vertex</li>
                <li><kbd>ESC</kbd> - Exit Editor</li>
                <li><kbd>Shift+Drag</kbd> - Snap to Grid</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".svg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}

export default HallEditor;
