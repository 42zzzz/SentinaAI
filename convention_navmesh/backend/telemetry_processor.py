"""
IoT Telemetry Processor

Processes real-time IoT sensor data (JSONL stream) and aggregates it for navigation routing.
Converts hall-level occupancy rates into crowd density values for navmesh edge weighting.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


class TelemetryProcessor:
    """Process IoT sensor streams and extract relevant navigation metrics."""
    
    def __init__(self):
        self.latest_occupancy: Dict[str, float] = {}
        self.hall_id_to_room_id: Dict[str, str] = {}
        self.last_update: Optional[datetime] = None
    
    def load_jsonl_stream(self, filepath: str | Path, max_records: int = 10000) -> None:
        """Load telemetry from JSONL file (most recent records)."""
        filepath = Path(filepath)
        
        if not filepath.exists():
            raise FileNotFoundError(f"Telemetry file not found: {filepath}")
        
        # Read all lines, process most recent
        with open(filepath, 'r') as f:
            lines = f.readlines()
        
        # Take last N records (most recent)
        recent_lines = lines[-max_records:] if len(lines) > max_records else lines
        
        # Parse and aggregate
        hall_readings: Dict[str, List[float]] = defaultdict(list)
        
        for line in recent_lines:
            try:
                record = json.loads(line.strip())
                
                # We only care about occupancy readings for routing
                if record.get('readingType') != 'occupancy':
                    continue
                
                hall_id = record.get('hallId')
                if not hall_id:
                    continue
                
                occupancy_rate = record.get('values', {}).get('occupancyRate')
                if occupancy_rate is not None:
                    hall_readings[hall_id].append(float(occupancy_rate))
                
                # Track timestamp
                ts_str = record.get('timestamp')
                if ts_str:
                    try:
                        self.last_update = datetime.fromisoformat(ts_str.replace('+00:00', ''))
                    except:
                        pass
                        
            except json.JSONDecodeError:
                continue
        
        # Average multiple readings per hall
        for hall_id, rates in hall_readings.items():
            self.latest_occupancy[hall_id] = sum(rates) / len(rates)
        
        print(f"Loaded telemetry: {len(self.latest_occupancy)} halls")
        if self.last_update:
            print(f"  Latest timestamp: {self.last_update}")
    
    def map_hall_ids_to_rooms(self, rooms_metadata: List[Dict]) -> None:
        """
        Create mapping from telemetry hall IDs (like HZA01) to room node IDs (like room_0).
        
        Strategy:
        1. Try exact name match
        2. Try fuzzy match (contains hall ID)
        3. Extract zone letter and hall number for pattern matching
        """
        self.hall_id_to_room_id.clear()
        
        # Create reverse lookup
        for room in rooms_metadata:
            room_id = room['id']
            room_name = room.get('name', '').strip()
            
            # Direct exact match (case-insensitive)
            for hall_id in self.latest_occupancy.keys():
                if hall_id.lower() == room_name.lower():
                    self.hall_id_to_room_id[hall_id] = room_id
                    continue
                
                # Pattern match: HZA01 -> "Sheikh Rashid Hall A1" or "North Hall A1"
                # Extract zone and number from hall_id
                if len(hall_id) >= 3:
                    zone_letter = hall_id[2] if len(hall_id) > 2 else ''  # HZA01 -> A
                    hall_num = hall_id[3:] if len(hall_id) > 3 else ''    # HZA01 -> 01
                    
                    # Try matching pattern in name
                    if zone_letter and hall_num:
                        # Remove leading zeros: "01" -> "1"
                        hall_num_clean = hall_num.lstrip('0') or '0'
                        
                        # Check if name contains zone letter + number
                        patterns = [
                            f"{zone_letter}{hall_num_clean}",
                            f"{zone_letter} {hall_num_clean}",
                            f"hall {zone_letter}{hall_num_clean}",
                            f"hall {zone_letter} {hall_num_clean}",
                        ]
                        
                        name_lower = room_name.lower()
                        for pattern in patterns:
                            if pattern.lower() in name_lower:
                                self.hall_id_to_room_id[hall_id] = room_id
                                break
        
        print(f"Mapped {len(self.hall_id_to_room_id)} hall IDs to rooms")
        
        # Show unmapped halls
        unmapped = set(self.latest_occupancy.keys()) - set(self.hall_id_to_room_id.keys())
        if unmapped:
            print(f"  Warning: {len(unmapped)} halls not mapped: {sorted(list(unmapped))[:5]}...")
    
    def get_sensor_data_for_navmesh(self) -> Dict[str, float]:
        """
        Get sensor data in format expected by navmesh_generator.update_edge_weights_from_iot().
        
        Returns dict with:
        - Keys: room IDs (room_0, room_1, ...) or room names
        - Values: crowd density 0.0-1.0 (occupancy rate)
        """
        sensor_data: Dict[str, float] = {}
        
        # Map telemetry hall IDs to room IDs
        for hall_id, occupancy_rate in self.latest_occupancy.items():
            room_id = self.hall_id_to_room_id.get(hall_id)
            if room_id:
                sensor_data[room_id] = occupancy_rate
        
        return sensor_data
    
    def get_summary(self) -> Dict:
        """Get summary statistics for display."""
        if not self.latest_occupancy:
            return {
                'total_halls': 0,
                'mapped_halls': 0,
                'avg_occupancy': 0.0,
                'max_occupancy': 0.0,
                'crowded_halls': []
            }
        
        occupancy_values = list(self.latest_occupancy.values())
        avg_occ = sum(occupancy_values) / len(occupancy_values)
        max_occ = max(occupancy_values)
        
        # Find crowded halls (>50% occupancy)
        crowded = [
            {'hallId': hid, 'occupancy': occ}
            for hid, occ in self.latest_occupancy.items()
            if occ > 0.5
        ]
        crowded.sort(key=lambda x: x['occupancy'], reverse=True)
        
        return {
            'total_halls': len(self.latest_occupancy),
            'mapped_halls': len(self.hall_id_to_room_id),
            'avg_occupancy': round(avg_occ, 3),
            'max_occupancy': round(max_occ, 3),
            'crowded_halls': crowded[:5],  # Top 5 most crowded
            'last_update': self.last_update.isoformat() if self.last_update else None
        }


if __name__ == '__main__':
    # Test the processor
    processor = TelemetryProcessor()
    
    # Load from test file
    test_file = Path('../telemetry_stream_hall_v3__1_.jsonl')
    if test_file.exists():
        processor.load_jsonl_stream(test_file)
        
        print("\nOccupancy by hall:")
        for hall_id, occ in sorted(processor.latest_occupancy.items())[:10]:
            print(f"  {hall_id}: {occ:.2%}")
        
        print("\nSummary:")
        summary = processor.get_summary()
        print(f"  Total halls: {summary['total_halls']}")
        print(f"  Avg occupancy: {summary['avg_occupancy']:.1%}")
        print(f"  Max occupancy: {summary['max_occupancy']:.1%}")
        
        if summary['crowded_halls']:
            print(f"\n  Most crowded halls:")
            for item in summary['crowded_halls']:
                print(f"    {item['hallId']}: {item['occupancy']:.1%}")
