import React from 'react';

function Controls({ currentView, onViewChange, isEditMode, onToggleEdit }) {
  const views = [
    { id: 'all', label: 'View All' },
    { id: 'north', label: 'North Zone' },
    { id: 'east', label: 'East Zone' },
    { id: 'south', label: 'South Zone' },
    { id: 'central', label: 'Central' },
  ];

  return (
    <div className="controls">
      {views.map((view) => (
        <button
          key={view.id}
          className={currentView === view.id && !isEditMode ? 'active' : ''}
          onClick={() => onViewChange(view.id)}
          disabled={isEditMode}
        >
          {view.label}
        </button>
      ))}
      <span style={{ color: '#666', margin: '0 8px' }}>|</span>
      <button
        className={isEditMode ? 'active btn-edit' : 'btn-edit'}
        onClick={onToggleEdit}
      >
        {isEditMode ? 'Exit Editor' : 'Edit Layout'}
      </button>
    </div>
  );
}

export default Controls;
