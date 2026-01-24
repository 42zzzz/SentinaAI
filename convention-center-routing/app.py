import os
import sys
import json
from flask import Flask, render_template, request, jsonify

# Add current directory to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from routing.dijkstra import DijkstraRouter

app = Flask(__name__, 
            template_folder='templates',
            static_folder='static')

# Get the correct path for graph data
graph_data_path = os.path.join(current_dir, 'data', 'graph_data.json')

# Check if file exists
if not os.path.exists(graph_data_path):
    print(f"ERROR: Graph data file not found at: {graph_data_path}")
    print("Generating a sample graph...")
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(graph_data_path), exist_ok=True)
    
    # Generate a sample graph with your actual convention center data
    sample_graph = {
        "nodes": {
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
        },
        "edges": [
            {"from": 0, "to": 1, "weight": 143.18, "from_name": "Zone A", "to_name": "South Hall 1"},
            {"from": 0, "to": 2, "weight": 80.62, "from_name": "Zone A", "to_name": "South Hall 2"},
            {"from": 0, "to": 3, "weight": 104.40, "from_name": "Zone A", "to_name": "South Hall 3"},
            {"from": 7, "to": 8, "weight": 167.02, "from_name": "Zone B", "to_name": "East Hall 1"},
            {"from": 7, "to": 10, "weight": 58.00, "from_name": "Zone B", "to_name": "East Hall 3"},
            {"from": 17, "to": 18, "weight": 103.00, "from_name": "Zone C", "to_name": "Hall 1"},
            {"from": 17, "to": 20, "weight": 28.00, "from_name": "Zone C", "to_name": "Hall 3"},
            {"from": 23, "to": 24, "weight": 85.00, "from_name": "Zone D", "to_name": "North Hall 1"},
            {"from": 23, "to": 25, "weight": 180.00, "from_name": "Zone D", "to_name": "North Hall 2"},
            {"from": 0, "to": 7, "weight": 291.55, "from_name": "Zone A", "to_name": "Zone B"},
            {"from": 7, "to": 17, "weight": 181.27, "from_name": "Zone B", "to_name": "Zone C"},
            {"from": 17, "to": 23, "weight": 275.57, "from_name": "Zone C", "to_name": "Zone D"}
        ],
        "image_dimensions": {"width": 850, "height": 600}
    }
    
    # Save the sample graph
    with open(graph_data_path, 'w') as f:
        json.dump(sample_graph, f, indent=2)
    print(f"✓ Sample graph created at: {graph_data_path}")

# Load graph data
try:
    with open(graph_data_path, 'r') as f:
        graph_data = json.load(f)
    print(f"✓ Graph data loaded from: {graph_data_path}")
    print(f"✓ Number of nodes: {len(graph_data['nodes'])}")
    print(f"✓ Number of edges: {len(graph_data['edges'])}")
except Exception as e:
    print(f"✗ Error loading graph data: {e}")
    sys.exit(1)

# Initialize router
router = DijkstraRouter(graph_data['nodes'], graph_data['edges'])

@app.route('/')
def index():
    """Main page with the map"""
    return render_template('index.html', 
                         nodes=graph_data['nodes'],
                         image_width=graph_data['image_dimensions']['width'],
                         image_height=graph_data['image_dimensions']['height'])

@app.route('/api/nodes')
def get_nodes():
    """API endpoint to get all nodes"""
    return jsonify(graph_data['nodes'])

@app.route('/api/calculate-route', methods=['POST'])
def calculate_route():
    """API endpoint to calculate route"""
    data = request.json
    start = data.get('start')
    end = data.get('end')
    
    if not start or not end:
        return jsonify({'error': 'Start and end locations required'}), 400
    
    try:
        path, distance = router.find_shortest_path(start, end)
        
        # Get coordinates for the path
        path_coordinates = router.get_path_coordinates(path)
        
        # Get node names for display
        path_names = [graph_data['nodes'][str(node_id)]['name'] for node_id in path]
        
        return jsonify({
            'success': True,
            'path': path,
            'path_names': path_names,
            'coordinates': path_coordinates,
            'distance': distance,
            'node_count': len(path)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/locations')
def get_locations():
    """Get all location names for dropdowns"""
    locations = [node['name'] for node in graph_data['nodes'].values()]
    return jsonify(sorted(locations))

if __name__ == '__main__':
    print("\n" + "=" * 50)
    print("Convention Center Routing System")
    print("=" * 50)
    print(f"Starting server on http://localhost:5000")
    print(f"Press Ctrl+C to stop")
    print("=" * 50)
    app.run(debug=True, port=5000)