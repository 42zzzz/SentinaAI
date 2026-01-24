# generate_graph.py
import json
import os
import math

def generate_convention_graph():
    """Generate the convention center graph with your coordinates"""
    
    nodes = {
        "0": {"name": "Zone A", "x": 755, "y": 317, "type": "zone"},
        "1": {"name": "South Hall 1", "x": 612, "y": 312, "type": "hall"},
        "2": {"name": "South Hall 2", "x": 710, "y": 350, "type": "hall"},
        "3": {"name": "South Hall 3", "x": 800, "y": 380, "type": "hall"},
        "4": {"name": "South Hall 4", "x": 586, "y": 415, "type": "hall"},
        "5": {"name": "South Hall 5", "x": 680, "y": 444, "type": "hall"},
        "6": {"name": "South Hall 6", "x": 770, "y": 469, "type": "hall"},
        "7": {"name": "Zone B", "x": 490, "y": 180, "type": "zone"},
        "8": {"name": "East Hall 1", "x": 330, "y": 122, "type": "hall"},
        "9": {"name": "East Hall 2", "x": 392, "y": 122, "type": "hall"},
        "10": {"name": "East Hall 3", "x": 490, "y": 122, "type": "hall"},
        "11": {"name": "East Hall 4", "x": 613, "y": 122, "type": "hall"},
        "12": {"name": "Hall 6", "x": 328, "y": 206, "type": "hall"},
        "13": {"name": "Hall 7", "x": 385, "y": 224, "type": "hall"},
        "14": {"name": "Hall 8", "x": 466, "y": 224, "type": "hall"},
        "15": {"name": "Hall 9", "x": 547, "y": 224, "type": "hall"},
        "16": {"name": "Hall 10", "x": 627, "y": 224, "type": "hall"},
        "17": {"name": "Zone C", "x": 309, "y": 357, "type": "zone"},
        "18": {"name": "Hall 1", "x": 309, "y": 460, "type": "hall"},
        "19": {"name": "Hall 2", "x": 361, "y": 385, "type": "hall"},
        "20": {"name": "Hall 3", "x": 309, "y": 385, "type": "hall"},
        "21": {"name": "Hall 4", "x": 309, "y": 301, "type": "hall"},
        "22": {"name": "Hall 5", "x": 309, "y": 247, "type": "hall"},
        "23": {"name": "Zone D", "x": 90, "y": 160, "type": "zone"},
        "24": {"name": "North Hall 1", "x": 165, "y": 218, "type": "hall"},
        "25": {"name": "North Hall 2", "x": 165, "y": 340, "type": "hall"},
        "26": {"name": "North Hall 3", "x": 165, "y": 461, "type": "hall"},
        "27": {"name": "North Hall 4", "x": 103, "y": 374, "type": "hall"},
        "28": {"name": "North Hall 5", "x": 38, "y": 238, "type": "hall"}
    }
    
    edges = []
    
    # Helper function to calculate distance
    def calculate_distance(node1_id, node2_id):
        node1 = nodes[node1_id]
        node2 = nodes[node2_id]
        return math.sqrt((node1["x"] - node2["x"])**2 + (node1["y"] - node2["y"])**2)
    
    # Connect each hall to its zone
    zone_connections = {
        "0": ["1", "2", "3", "4", "5", "6"],  # Zone A to South Halls
        "7": ["8", "9", "10", "11", "12", "13", "14", "15", "16"],  # Zone B to East Halls/Halls 6-10
        "17": ["18", "19", "20", "21", "22"],  # Zone C to Halls 1-5
        "23": ["24", "25", "26", "27", "28"]   # Zone D to North Halls
    }
    
    for zone_id, hall_ids in zone_connections.items():
        for hall_id in hall_ids:
            distance = calculate_distance(zone_id, hall_id)
            edges.append({
                "from": int(zone_id),
                "to": int(hall_id),
                "weight": distance,
                "from_name": nodes[zone_id]["name"],
                "to_name": nodes[hall_id]["name"]
            })
    
    # Connect adjacent halls within each zone
    # South Halls (1-6) - connect in sequence
    for i in range(1, 6):  # 1 to 5
        distance = calculate_distance(str(i), str(i + 1))
        edges.append({
            "from": i,
            "to": i + 1,
            "weight": distance * 0.8,  # Shorter since they're connected
            "from_name": nodes[str(i)]["name"],
            "to_name": nodes[str(i + 1)]["name"]
        })
    
    # East Halls (8-11) - connect in sequence
    for i in range(8, 11):  # 8 to 10
        distance = calculate_distance(str(i), str(i + 1))
        edges.append({
            "from": i,
            "to": i + 1,
            "weight": distance * 0.8,
            "from_name": nodes[str(i)]["name"],
            "to_name": nodes[str(i + 1)]["name"]
        })
    
    # Halls 6-10 (12-16) - connect in sequence
    for i in range(12, 16):  # 12 to 15
        distance = calculate_distance(str(i), str(i + 1))
        edges.append({
            "from": i,
            "to": i + 1,
            "weight": distance * 0.8,
            "from_name": nodes[str(i)]["name"],
            "to_name": nodes[str(i + 1)]["name"]
        })
    
    # Halls 1-5 (18-22) - connect to their zone and each other
    for i in range(18, 22):  # 18 to 21
        distance = calculate_distance(str(i), str(i + 1))
        edges.append({
            "from": i,
            "to": i + 1,
            "weight": distance * 0.8,
            "from_name": nodes[str(i)]["name"],
            "to_name": nodes[str(i + 1)]["name"]
        })
    
    # North Halls (24-28) - connect to zone and each other
    for i in range(24, 28):  # 24 to 27
        distance = calculate_distance(str(i), str(i + 1))
        edges.append({
            "from": i,
            "to": i + 1,
            "weight": distance * 0.8,
            "from_name": nodes[str(i)]["name"],
            "to_name": nodes[str(i + 1)]["name"]
        })
    
    # Connect zones to each other (main corridors)
    zone_to_zone = [
        ("0", "7", 1.2),  # Zone A to Zone B
        ("7", "17", 1.2), # Zone B to Zone C
        ("17", "23", 1.2) # Zone C to Zone D
    ]
    
    for zone1, zone2, factor in zone_to_zone:
        distance = calculate_distance(zone1, zone2)
        edges.append({
            "from": int(zone1),
            "to": int(zone2),
            "weight": distance * factor,
            "from_name": nodes[zone1]["name"],
            "to_name": nodes[zone2]["name"]
        })
    
    graph_data = {
        "nodes": nodes,
        "edges": edges,
        "image_dimensions": {"width": 850, "height": 600}
    }
    
    return graph_data

if __name__ == "__main__":
    # Create data directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    # Generate graph
    graph_data = generate_convention_graph()
    
    # Save to file
    output_path = 'data/graph_data.json'
    with open(output_path, 'w') as f:
        json.dump(graph_data, f, indent=2)
    
    print(f"✓ Graph generated at: {output_path}")
    print(f"✓ Created {len(graph_data['nodes'])} nodes")
    print(f"✓ Created {len(graph_data['edges'])} edges")
    print("\nNode list:")
    for node_id, node in graph_data['nodes'].items():
        print(f"  {node_id}: {node['name']} ({node['x']}, {node['y']})")