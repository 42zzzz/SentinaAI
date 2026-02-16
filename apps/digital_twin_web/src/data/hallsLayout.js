// DWTC Hall Layout Data
// Based on your Map_1_v4 layout

export const DWTC_OUTLINE = {
  // DWTC building footprint from Wikipedia SVG
  minX: 830,
  maxX: 1416,
  minY: 263,
  maxY: 838,
  width: 586,
  height: 575
};

export const HALLS_LAYOUT = [
  // ZONE A (HZC01-06) - SOUTH HALLS (Bottom-right, orange, tilted)
  { id: 'SouthHall1', telemetryId: 'HZC01', zone: 'South', x: 1200, y: 400, width: 140, height: 120, rotation: -15, color: '#e09f3e' },
  { id: 'SouthHall2', telemetryId: 'HZC02', zone: 'South', x: 1350, y: 380, width: 140, height: 120, rotation: -15, color: '#e09f3e' },
  { id: 'SouthHall3', telemetryId: 'HZC03', zone: 'South', x: 1500, y: 360, width: 140, height: 120, rotation: -15, color: '#e09f3e' },
  { id: 'SouthHall4', telemetryId: 'HZC04', zone: 'South', x: 1200, y: 530, width: 140, height: 120, rotation: -15, color: '#e09f3e' },
  { id: 'SouthHall5', telemetryId: 'HZC05', zone: 'South', x: 1350, y: 510, width: 140, height: 120, rotation: -15, color: '#e09f3e' },
  { id: 'SouthHall6', telemetryId: 'HZC06', zone: 'South', x: 1500, y: 490, width: 140, height: 120, rotation: -15, color: '#e09f3e' },

  // ZONE B (HZB01-08) - EAST HALLS (Top row) + Hall 7-10 (middle row)
  { id: 'EastHall1', telemetryId: 'HZB01', zone: 'East', x: 1000, y: 280, width: 100, height: 90, rotation: 0, color: '#1f3a5f' },
  { id: 'EastHall2', telemetryId: 'HZB02', zone: 'East', x: 1110, y: 280, width: 100, height: 90, rotation: 0, color: '#1f3a5f' },
  { id: 'EastHall3', telemetryId: 'HZB03', zone: 'East', x: 1220, y: 280, width: 140, height: 90, rotation: 0, color: '#1f3a5f' },
  { id: 'EastHall4', telemetryId: 'HZB04', zone: 'East', x: 1370, y: 280, width: 120, height: 90, rotation: 0, color: '#1f3a5f' },
  { id: 'Hall7', telemetryId: 'HZB05', zone: 'East', x: 1040, y: 395, width: 110, height: 100, rotation: 0, color: '#1f3a5f' },
  { id: 'Hall8', telemetryId: 'HZB06', zone: 'East', x: 1160, y: 395, width: 110, height: 100, rotation: 0, color: '#1f3a5f' },
  { id: 'Hall9', telemetryId: 'HZB07', zone: 'East', x: 1280, y: 395, width: 110, height: 100, rotation: 0, color: '#1f3a5f' },
  { id: 'Hall10', telemetryId: 'HZB08', zone: 'East', x: 1400, y: 395, width: 110, height: 100, rotation: 0, color: '#1f3a5f' },

  // ZONE C (HZD01-06) - CENTRAL HALLS (Teal/cyan)
  { id: 'Hall1', telemetryId: 'HZD01', zone: 'Central', x: 950, y: 600, width: 95, height: 160, rotation: 0, color: '#2f8f9d' },
  { id: 'Hall2', telemetryId: 'HZD02', zone: 'Central', x: 1070, y: 560, width: 60, height: 100, rotation: 0, color: '#2f8f9d' },
  { id: 'Hall3', telemetryId: 'HZD03', zone: 'Central', x: 950, y: 530, width: 95, height: 120, rotation: 0, color: '#2f8f9d' },
  { id: 'Hall4', telemetryId: 'HZD04', zone: 'Central', x: 950, y: 460, width: 95, height: 120, rotation: 0, color: '#2f8f9d' },
  { id: 'Hall5', telemetryId: 'HZD05', zone: 'Central', x: 950, y: 390, width: 70, height: 60, rotation: 0, color: '#2f8f9d' },
  { id: 'Hall6', telemetryId: 'HZD06', zone: 'Central', x: 900, y: 360, width: 40, height: 70, rotation: 0, color: '#2f8f9d' },

  // ZONE D (HZA01-06) - NORTH HALLS (Left side, pink/red)
  { id: 'NorthHall1', telemetryId: 'HZA01', zone: 'North', x: 880, y: 440, width: 80, height: 90, rotation: 0, color: '#9e2a2b' },
  { id: 'NorthHall2', telemetryId: 'HZA02', zone: 'North', x: 880, y: 540, width: 80, height: 120, rotation: 0, color: '#9e2a2b' },
  { id: 'NorthHall3', telemetryId: 'HZA03', zone: 'North', x: 880, y: 670, width: 80, height: 120, rotation: 0, color: '#9e2a2b' },
  { id: 'NorthHall4', telemetryId: 'HZA04', zone: 'North', x: 830, y: 520, width: 40, height: 280, rotation: 0, color: '#9e2a2b' },
  { id: 'NorthHall5', telemetryId: 'HZA05', zone: 'North', x: 770, y: 550, width: 50, height: 140, rotation: 0, color: '#9e2a2b' },
  { id: 'NorthHall6', telemetryId: 'HZA06', zone: 'North', x: 850, y: 280, width: 120, height: 50, rotation: 0, color: '#9e2a2b' }
];

// Zone telemetry mapping
export const ZONE_MAPPING = {
  'HZA01': 'North', 'HZA02': 'North', 'HZA03': 'North', 'HZA04': 'North', 'HZA05': 'North', 'HZA06': 'North',
  'HZB01': 'East', 'HZB02': 'East', 'HZB03': 'East', 'HZB04': 'East', 
  'HZB05': 'East', 'HZB06': 'East', 'HZB07': 'East', 'HZB08': 'East',
  'HZC01': 'South', 'HZC02': 'South', 'HZC03': 'South', 'HZC04': 'South', 'HZC05': 'South', 'HZC06': 'South',
  'HZD01': 'Central', 'HZD02': 'Central', 'HZD03': 'Central', 'HZD04': 'Central', 'HZD05': 'Central', 'HZD06': 'Central'
};

export const HALL_HEIGHT = 10; // All halls 10 meters tall
export const SCALE = 0.05; // SVG to 3D world scale
