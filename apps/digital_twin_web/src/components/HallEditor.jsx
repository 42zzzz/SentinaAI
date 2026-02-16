import React, { useState, useEffect } from 'react';
import { HALLS_LAYOUT } from '../data/hallsLayout';

function HallEditor({ isEditMode, halls, setHalls, selectedHallId, setSelectedHallId, onSave, onClose }) {
  const [draggedHallId, setDraggedHallId] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Temporary input values for live editing
  const [tempInputs, setTempInputs] = useState({});

  // Derive selectedHall from halls array
  const selectedHall = halls.find(h => h.id === selectedHallId);

  // Calculate bounds and centering
  const allX = halls.map(h => h.x);
  const allY = halls.map(h => h.y);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX.map((x, i) => x + halls[i].width));
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY.map((y, i) => y + halls[i].height));
  
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
    if (!isEditMode) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, onClose]);

  // Mouse handlers for drag
  const handleMouseDown = (e, hall) => {
    e.stopPropagation();
    setSelectedHallId(hall.id);
    setDraggedHallId(hall.id);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!draggedHallId) return;

    const dx = (e.clientX - dragStart.x) / scale;
    const dy = (e.clientY - dragStart.y) / scale;

    // Functional update to avoid stale closure
    setHalls(prevHalls => 
      prevHalls.map(h =>
        h.id === draggedHallId
          ? { ...h, x: Math.round(h.x + dx), y: Math.round(h.y + dy) }
          : h
      )
    );

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setDraggedHallId(null);
  };

  // Input change handlers with rounding
  const handleInputChange = (field, value) => {
    // Allow empty input while typing
    setTempInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleInputBlur = (field) => {
    if (!selectedHall) return;

    const value = tempInputs[field];
    if (value === undefined || value === '') {
      // Clear temp input, revert to actual value
      setTempInputs(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return;
    }

    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      // Invalid input, revert
      setTempInputs(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return;
    }

    // Round to integer and update
    const rounded = Math.round(parsed);
    setHalls(prevHalls =>
      prevHalls.map(h =>
        h.id === selectedHallId
          ? { ...h, [field]: rounded }
          : h
      )
    );

    // Clear temp input
    setTempInputs(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleInputKeyDown = (e, field) => {
    if (e.key === 'Enter') {
      e.target.blur(); // Trigger blur handler
    }
  };

  // Get display value for input (temp or actual)
  const getInputValue = (field) => {
    if (tempInputs[field] !== undefined) {
      return tempInputs[field];
    }
    return selectedHall ? selectedHall[field] : '';
  };

  // Button handlers
  const handleAdjustment = (field, delta) => {
    if (!selectedHall) return;
    
    setHalls(prevHalls =>
      prevHalls.map(h =>
        h.id === selectedHallId
          ? { ...h, [field]: Math.max(field === 'width' || field === 'height' ? 10 : -360, Math.round(h[field] + delta)) }
          : h
      )
    );
  };

  const handleExport = () => {
    const exportData = `export const HALLS_LAYOUT = ${JSON.stringify(halls, null, 2)};`;
    
    const dataBlob = new Blob([exportData], { type: 'text/javascript' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hallsLayout-edited.js';
    link.click();
    URL.revokeObjectURL(url);

    alert('Layout exported! Replace the content in src/data/hallsLayout.js with the downloaded file.');
    if (onSave) onSave(halls);
  };

  const handleReset = () => {
    if (confirm('Reset all halls to default positions?')) {
      setHalls([...HALLS_LAYOUT]);
      setSelectedHallId(null);
      setTempInputs({});
    }
  };

  if (!isEditMode) return null;

  return (
    <div className="hall-editor-overlay" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div className="hall-editor-container">
        <div className="editor-header">
          <h2>Hall Position Editor</h2>
          <button onClick={onClose} className="close-btn" title="Close (ESC)">×</button>
        </div>

        <div className="editor-body">
          <div className="editor-canvas-container">
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
                const x = hall.x * scale + offsetX;
                const y = hall.y * scale + offsetY;
                const w = hall.width * scale;
                const h = hall.height * scale;
                
                return (
                  <g
                    key={hall.id}
                    transform={`translate(${x + w/2}, ${y + h/2}) rotate(${hall.rotation || 0}) translate(${-w/2}, ${-h/2})`}
                    style={{ cursor: 'move' }}
                    onMouseDown={(e) => handleMouseDown(e, hall)}
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
              })}
            </svg>
          </div>

          <div className="editor-controls">
            <h3>Controls</h3>

            {selectedHall ? (
              <div className="selected-hall-controls">
                <div className="control-group">
                  <label>Selected: {selectedHall.telemetryId}</label>
                </div>

                <div className="control-group">
                  <label>X Position</label>
                  <input
                    type="text"
                    className="coord-input"
                    value={getInputValue('x')}
                    onChange={(e) => handleInputChange('x', e.target.value)}
                    onBlur={() => handleInputBlur('x')}
                    onKeyDown={(e) => handleInputKeyDown(e, 'x')}
                  />
                  <div className="button-group">
                    <button onClick={() => handleAdjustment('x', -10)}>-10</button>
                    <button onClick={() => handleAdjustment('x', -1)}>-1</button>
                    <button onClick={() => handleAdjustment('x', 1)}>+1</button>
                    <button onClick={() => handleAdjustment('x', 10)}>+10</button>
                  </div>
                </div>

                <div className="control-group">
                  <label>Y Position</label>
                  <input
                    type="text"
                    className="coord-input"
                    value={getInputValue('y')}
                    onChange={(e) => handleInputChange('y', e.target.value)}
                    onBlur={() => handleInputBlur('y')}
                    onKeyDown={(e) => handleInputKeyDown(e, 'y')}
                  />
                  <div className="button-group">
                    <button onClick={() => handleAdjustment('y', -10)}>-10</button>
                    <button onClick={() => handleAdjustment('y', -1)}>-1</button>
                    <button onClick={() => handleAdjustment('y', 1)}>+1</button>
                    <button onClick={() => handleAdjustment('y', 10)}>+10</button>
                  </div>
                </div>

                <div className="control-group">
                  <label>Width</label>
                  <input
                    type="text"
                    className="coord-input"
                    value={getInputValue('width')}
                    onChange={(e) => handleInputChange('width', e.target.value)}
                    onBlur={() => handleInputBlur('width')}
                    onKeyDown={(e) => handleInputKeyDown(e, 'width')}
                  />
                  <div className="button-group">
                    <button onClick={() => handleAdjustment('width', -10)}>-10</button>
                    <button onClick={() => handleAdjustment('width', -5)}>-5</button>
                    <button onClick={() => handleAdjustment('width', 5)}>+5</button>
                    <button onClick={() => handleAdjustment('width', 10)}>+10</button>
                  </div>
                </div>

                <div className="control-group">
                  <label>Height</label>
                  <input
                    type="text"
                    className="coord-input"
                    value={getInputValue('height')}
                    onChange={(e) => handleInputChange('height', e.target.value)}
                    onBlur={() => handleInputBlur('height')}
                    onKeyDown={(e) => handleInputKeyDown(e, 'height')}
                  />
                  <div className="button-group">
                    <button onClick={() => handleAdjustment('height', -10)}>-10</button>
                    <button onClick={() => handleAdjustment('height', -5)}>-5</button>
                    <button onClick={() => handleAdjustment('height', 5)}>+5</button>
                    <button onClick={() => handleAdjustment('height', 10)}>+10</button>
                  </div>
                </div>

                <div className="control-group">
                  <label>Rotation (degrees)</label>
                  <input
                    type="text"
                    className="coord-input"
                    value={getInputValue('rotation') || 0}
                    onChange={(e) => handleInputChange('rotation', e.target.value)}
                    onBlur={() => handleInputBlur('rotation')}
                    onKeyDown={(e) => handleInputKeyDown(e, 'rotation')}
                  />
                  <div className="button-group">
                    <button onClick={() => handleAdjustment('rotation', -15)}>-15°</button>
                    <button onClick={() => handleAdjustment('rotation', -5)}>-5°</button>
                    <button onClick={() => handleAdjustment('rotation', 5)}>+5°</button>
                    <button onClick={() => handleAdjustment('rotation', 15)}>+15°</button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="help-text">Click on a hall to select and edit</p>
            )}

            <div className="control-group editor-actions">
              <button onClick={handleExport} className="btn-primary">
                Export Layout JS
              </button>
              <button onClick={handleReset} className="btn-secondary">
                Reset to Default
              </button>
            </div>

            <div className="editor-help">
              <h4>How to Use:</h4>
              <ul>
                <li>Click and drag halls to move them</li>
                <li>Type coordinates to position precisely</li>
                <li>Use +/- buttons for fine adjustment</li>
                <li>Press ESC or click X to exit</li>
                <li>Export when finished to save</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HallEditor;
