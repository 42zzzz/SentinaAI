# Quick Start Guide

## Live Editing in 3 Steps

### 1. Open Editor
Click "Edit Layout" at bottom of screen

### 2. Edit Halls
**Move entire hall**: Click and drag
**Edit vertices**: 
  - Click "Vertex Mode"  
  - Drag vertex circles to reshape
  - Click blue circles on edges to add vertices
  - Select vertex and press Delete to remove

### 3. See Changes
Changes appear instantly in 2D and 3D. No export needed!

## Features

### Keyboard Shortcuts
- `ESC` - Exit editor
- `Delete/Backspace` - Remove selected vertex
- `Shift + Drag` - Snap to grid
- `M` - Move mode
- `V` - Vertex mode

### Mouse Actions
- Click hall - Select
- Drag hall - Move (in Move mode)
- Drag vertex - Reshape (in Vertex mode)
- Click edge midpoint (blue circle) - Add vertex
- Click vertex - Select for deletion

### Convert Rectangle
1. Select rectangle hall
2. Click "Convert to Polygon" button
3. Now you can edit vertices!

### Import SVG
1. Click "Import SVG" button
2. Select your SVG file
3. Halls automatically created
4. Edit them like any other hall

## Tips

- Hold Shift while dragging to snap to 10px grid
- Vertex mode shows small circles on corners
- Blue circles on edges let you add vertices
- Selected vertex turns red
- Minimum 3 vertices per polygon

## Export (Optional)
Click "Export Layout JS" to save your work to a file.
Replace content in `src/data/hallsLayout.js` to persist changes.

---
For full documentation, see IMPLEMENTATION_GUIDE.md
