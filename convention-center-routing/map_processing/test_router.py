# test_router.py
import json
from routing.dijkstra import DijkstraRouter

# Load the graph
with open('data/graph_data.json', 'r') as f:
    graph_data = json.load(f)

print("Testing router...")
print(f"Nodes: {len(graph_data['nodes'])}")
print(f"Edges: {len(graph_data['edges'])}")

# Create router
router = DijkstraRouter(graph_data['nodes'], graph_data['edges'])

# Test a simple route
try:
    print("\nTesting route from 'Zone A' to 'Zone B'...")
    path, distance = router.find_shortest_path("Zone A", "Zone B")
    print(f"✓ Success! Path length: {len(path)}, Distance: {distance:.2f}")
    print(f"Path: {path}")
except Exception as e:
    print(f"✗ Error: {e}")
    print("\nDebug info:")
    print(f"Node IDs: {list(graph_data['nodes'].keys())[:5]}...")
    print(f"First edge: {graph_data['edges'][0] if graph_data['edges'] else 'No edges'}")