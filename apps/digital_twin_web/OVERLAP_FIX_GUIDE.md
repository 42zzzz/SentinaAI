# Hall Overlap Issue - Complete Fix Guide

## Why Halls Overlap

Your halls are overlapping because they're positioned too close in the layout data **combined with rotation**.

### Example from your current layout:

```javascript
// SouthHall1
x: 1450, y: 530, width: 140, height: 120, rotation: 15°
// When rotated, extends beyond 1590

// SouthHall2  
x: 1604, y: 579, width: 190, height: 120, rotation: 15°
// Starts at 1604

// Problem: Gap is only 14 units, but rotation causes overlap!
```

## How to Fix Using Move Mode

Now that V5 is ACTUALLY working:

### 1. Open the Editor
- Click "Edit Layout" button at bottom
- Editor opens with all halls visible

### 2. Switch to Move Mode
- Click "Move Mode (M)" button at top (green when active)
- Or press `M` key

### 3. Move Halls Apart
- Click and drag any overlapping hall
- Move it further away
- **Changes appear instantly in 3D when you exit**

### 4. Check in 3D
- Press ESC to exit editor
- See halls in 3D with new positions
- Re-enter editor if more adjustment needed

## Quick Fix Values

If you prefer to manually edit `src/data/hallsLayout.js`:

```javascript
// BEFORE (overlapping):
{ id: "SouthHall1", x: 1450, width: 140, rotation: 15 }
{ id: "SouthHall2", x: 1604, width: 190, rotation: 15 }

// AFTER (properly spaced):
{ id: "SouthHall1", x: 1400, width: 140, rotation: 15 }
{ id: "SouthHall2", x: 1680, width: 190, rotation: 15 }
// Gap increased from 14 to 140 units
```

Apply similar spacing increases to all overlapping halls.

## Why Increasing SCALE Didn't Help

SCALE affects the size of everything proportionally:
- SCALE 0.05: Gap of 14 units = 0.7m
- SCALE 0.1: Gap of 14 units = 1.4m

The problem isn't the scale - it's that 14 units is too small even at any scale when rotation is applied!

## The Real Solution

**Use Move Mode** to visually adjust spacing:
1. ✅ See exactly how much space you need
2. ✅ Changes update live
3. ✅ No math required
4. ✅ No guessing

## Features Now Working

- ✅ **Move Mode** button (green when active)
- ✅ **Vertex Mode** button for polygon editing
- ✅ Drag halls to reposition
- ✅ Changes reflect instantly
- ✅ Export when done

## Keyboard Shortcuts

- `M` - Move Mode
- `V` - Vertex Mode  
- `ESC` - Exit editor
- `Shift + Drag` - Snap to grid

---

**This is the REAL V5 with all features actually working!**
