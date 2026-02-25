// Auto-adapted for SentinaAI navigation_web (no bundler).
// Provides CSV loading + booth join maps for tooltip enrichment.
// Exposes CsvDataService on window.

(function() {
/**
 * CSV Data Service
 * Loads and parses CSV files, builds joined booth data
 */

/**
 * Parse CSV text to array of objects
 * @param {string} csvText - Raw CSV text
 * @returns {Array<Object>} Parsed rows as objects
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length !== headers.length) continue; // Skip malformed rows
    
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || '';
    });
    rows.push(row);
  }
  
  return rows;
}

/**
 * Load CSV file from public directory
 * @param {string} filename - CSV filename (e.g., 'events.csv')
 * @returns {Promise<Array<Object>>} Parsed CSV data
 */
async function loadCSV(pathOrFilename) {
  try {
    // Accept either a full URL/path or a bare filename.
    const url = (typeof pathOrFilename === 'string' && (pathOrFilename.includes('/') || pathOrFilename.startsWith('http')))
      ? pathOrFilename
      : `assets/data/${pathOrFilename}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.statusText}`);
    }
    const text = await response.text();
    return parseCSV(text);
  } catch (error) {
    console.error(`Error loading CSV ${pathOrFilename}:`, error);
    return [];
  }
}

/**
 * Load all CSV files
 * @returns {Promise<{events: Array, exhibitors: Array, assignments: Array}>}
 */
async function loadAllCSVData(eventsPath, exhibitorsPath, assignmentsPath) {
  // Backwards compatible: if no args, load from assets/data/*.csv
  const ev = eventsPath || 'events.csv';
  const ex = exhibitorsPath || 'exhibitors.csv';
  const asg = assignmentsPath || 'event_exhibitor_booth_assignments.csv';

  const [events, exhibitors, assignments] = await Promise.all([
    loadCSV(ev),
    loadCSV(ex),
    loadCSV(asg)
  ]);

  return {
    events: Array.isArray(events) ? events : [],
    exhibitors: Array.isArray(exhibitors) ? exhibitors : [],
    assignments: Array.isArray(assignments) ? assignments : [],
  };
}

/**
 * Build booth data map with joined exhibitor and event information
 * @param {{events: Array, exhibitors: Array, assignments: Array}} csvData
 * @returns {Object} Map of boothId/boothCode -> {exhibitors: [], events: []}
 */
function buildBoothDataMap(arg1, arg2, arg3) {
  // Support both signatures:
  // 1) buildBoothDataMap({events, exhibitors, assignments})
  // 2) buildBoothDataMap(events, exhibitors, assignments)
  let events, exhibitors, assignments;
  if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
    ({ events, exhibitors, assignments } = arg1);
  } else {
    events = arg1;
    exhibitors = arg2;
    assignments = arg3;
  }

  events = Array.isArray(events) ? events : [];
  exhibitors = Array.isArray(exhibitors) ? exhibitors : [];
  assignments = Array.isArray(assignments) ? assignments : [];
  
  // Create lookup maps
  const eventMap = new Map();
  events.forEach(event => {
    eventMap.set(event.eventId, event);
  });
  
  const exhibitorMap = new Map();
  exhibitors.forEach(exhibitor => {
    exhibitorMap.set(exhibitor.exhibitorId, exhibitor);
  });
  
  // Build booth data map
  const boothDataMap = {};
  
  assignments.forEach(assignment => {
    const boothKey = assignment.boothCode || assignment.boothId;
    if (!boothKey) return;
    
    // Initialize booth entry if not exists
    if (!boothDataMap[boothKey]) {
      boothDataMap[boothKey] = {
        boothId: assignment.boothId,
        boothCode: assignment.boothCode,
        hallName: assignment.hallName,
        zoneId: assignment.zoneId,
        exhibitors: [],
        events: []
      };
    }
    
    // Add exhibitor info
    const exhibitor = exhibitorMap.get(assignment.exhibitorId);
    if (exhibitor) {
      boothDataMap[boothKey].exhibitors.push({
        id: exhibitor.exhibitorId,
        name: exhibitor.exhibitorName,
        industry: exhibitor.industry,
        country: exhibitor.hqCountry,
        contact: exhibitor.contactName,
        email: exhibitor.contactEmail,
        phone: exhibitor.contactPhone
      });
    }
    
    // Add event info
    const event = eventMap.get(assignment.eventId);
    if (event) {
      // Check if event already added (avoid duplicates)
      const eventExists = boothDataMap[boothKey].events.some(e => e.id === event.eventId);
      if (!eventExists) {
        boothDataMap[boothKey].events.push({
          id: event.eventId,
          name: event.eventName,
          venue: event.venueName,
          startDate: event.startDateTimeUtc,
          endDate: event.endDateTimeUtc,
          expectedAttendance: event.expectedAttendanceTotal,
          status: event.status,
          personInCharge: event.personInChargeName,
          email: event.personInChargeEmail
        });
      }
    }
  });
  
  return boothDataMap;
}

/**
 * Get booth data by booth identifier (boothCode or boothId)
 * @param {Object} boothDataMap - Map from buildBoothDataMap
 * @param {string} boothIdentifier - Booth code or ID
 * @returns {Object|null} Booth data with exhibitors and events
 */
function getBoothData(boothDataMap, boothIdentifier) {
  return boothDataMap[boothIdentifier] || null;
}

/**
 * Format date string for display
 * @param {string} isoDateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(isoDateString) {
  if (!isoDateString) return 'N/A';
  
  try {
    const date = new Date(isoDateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoDateString;
  }
}


  window.CsvDataService = {
    parseCSV,
    loadCSV,
    loadAllCSVData,
    buildBoothDataMap,
    getBoothData,
    formatDate,
  };
})();
