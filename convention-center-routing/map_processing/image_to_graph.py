# map_processing/image_to_graph.py
import cv2
import numpy as np
import json
from typing import Dict, List, Tuple, Optional
import math

class MapToGraphConverter:
    def __init__(self, image_path: str):
        self.image_path = image_path
        self.image = cv2.imread(image_path)
        self.height, self.width = self.image.shape[:2]
        self.nodes = {}  # node_id: {"x": x, "y": y, "name": name}
        self.edges = []  # List of (node1, node2, weight)
        self.node_positions = {}  # For visualization
        
    def identify_locations_from_text(self):
        """Create nodes based on the text labels with exact coordinates"""
    
    # Create nodes dictionary with exact coordinates
    nodes_data = [
        # Zone A and South Halls
        {"id": "Zone A", "x": 755, "y": 317, "type": "zone"},
        {"id": "South Hall 1", "x": 612, "y": 312, "type": "hall"},
        {"id": "South Hall 2", "x": 710, "y": 350, "type": "hall"},
        {"id": "South Hall 3", "x": 800, "y": 380, "type": "hall"},
        {"id": "South Hall 4", "x": 586, "y": 415, "type": "hall"},
        {"id": "South Hall 5", "x": 680, "y": 444, "type": "hall"},
        {"id": "South Hall 6", "x": 770, "y": 469, "type": "hall"},
        
        # Zone B and East Halls/Halls 6-10
        {"id": "Zone B", "x": 490, "y": 180, "type": "zone"},
        {"id": "East Hall 1", "x": 330, "y": 122, "type": "hall"},
        {"id": "East Hall 2", "x": 392, "y": 122, "type": "hall"},
        {"id": "East Hall 3", "x": 490, "y": 122, "type": "hall"},
        {"id": "East Hall 4", "x": 613, "y": 122, "type": "hall"},
        {"id": "Hall 6", "x": 328, "y": 206, "type": "hall"},
        {"id": "Hall 7", "x": 385, "y": 224, "type": "hall"},
        {"id": "Hall 8", "x": 466, "y": 224, "type": "hall"},
        {"id": "Hall 9", "x": 547, "y": 224, "type": "hall"},
        {"id": "Hall 10", "x": 627, "y": 224, "type": "hall"},
        
        # Zone C and Halls 1-5
        {"id": "Zone C", "x": 309, "y": 357, "type": "zone"},
        {"id": "Hall 1", "x": 309, "y": 460, "type": "hall"},
        {"id": "Hall 2", "x": 361, "y": 385, "type": "hall"},
        {"id": "Hall 3", "x": 309, "y": 385, "type": "hall"},
        {"id": "Hall 4", "x": 309, "y": 301, "type": "hall"},
        {"id": "Hall 5", "x": 309, "y": 247, "type": "hall"},
        
        # Zone D and North Halls
        {"id": "Zone D", "x": 90, "y": 160, "type": "zone"},
        {"id": "North Hall 1", "x": 165, "y": 218, "type": "hall"},
        {"id": "North Hall 2", "x": 165, "y": 340, "type": "hall"},
        {"id": "North Hall 3", "x": 165, "y": 461, "type": "hall"},
        {"id": "North Hall 4", "x": 103, "y": 374, "type": "hall"},
        {"id": "North Hall 5", "x": 38, "y": 238, "type": "hall"},
        {"id": "North Hall 6", "x": 160, "y": 90, "type": "hall"},
    ]
    
    # Create nodes dictionary with sequential IDs
    for i, node in enumerate(nodes_data):
        self.nodes[i] = {
            "name": node["id"],
            "x": node["x"],
            "y": node["y"],
            "type": node["type"]
        }
    
    return self.nodes
    
    def create_edges_between_nodes(self):
        """Connect nodes based on proximity and logical connections"""
        node_ids = list(self.nodes.keys())
        
        for i in range(len(node_ids)):
            for j in range(i + 1, len(node_ids)):
                node1 = self.nodes[node_ids[i]]
                node2 = self.nodes[node_ids[j]]
                
                # Calculate Euclidean distance
                distance = math.sqrt(
                    (node1["x"] - node2["x"])**2 + 
                    (node1["y"] - node2["y"])**2
                )
                
                # Connect nodes that are close (threshold based on your map scale)
                max_distance = 250  # Adjust based on your map
                
                # Special connections for halls in same zone
                same_zone = (
                    ("North" in node1["name"] and "North" in node2["name"]) or
                    ("South" in node1["name"] and "South" in node2["name"]) or
                    ("East" in node1["name"] and "East" in node2["name"])
                )
                
                # Connect adjacent halls and zones to halls
                if distance < max_distance or same_zone:
                    # Adjust weight for different connection types
                    weight = distance
                    if same_zone:
                        weight *= 0.8  # Halls in same zone are better connected
                    
                    self.edges.append({
                        "from": node_ids[i],
                        "to": node_ids[j],
                        "weight": weight,
                        "from_name": node1["name"],
                        "to_name": node2["name"]
                    })
        
        return self.edges
    
    def save_graph_to_json(self, output_path: str):
        """Save the graph structure to a JSON file"""
        graph_data = {
            "nodes": self.nodes,
            "edges": self.edges,
            "image_dimensions": {
                "width": self.width,
                "height": self.height
            }
        }
        
        with open(output_path, 'w') as f:
            json.dump(graph_data, f, indent=2)
        
        print(f"Graph saved to {output_path}")
        return graph_data

# Quick test
if __name__ == "__main__":
    converter = MapToGraphConverter("static/images/convention_map.png")
    converter.identify_locations_from_text()
    converter.create_edges_between_nodes()
    converter.save_graph_to_json("data/graph_data.json")