# routing/dijkstra.py - UPDATED
import heapq
from typing import Dict, List, Tuple, Optional, Any

class DijkstraRouter:
    def __init__(self, nodes: Dict, edges: List):
        """
        Initialize with graph data
        
        Args:
            nodes: Dict of node_id -> node_data (node_id can be string or int)
            edges: List of edges with 'from', 'to', 'weight'
        """
        self.nodes = nodes
        self.edges = edges
        self.graph = self.build_adjacency_list()
    
    def build_adjacency_list(self) -> Dict:
        """Convert edge list to adjacency list for faster search"""
        # Initialize graph with all node IDs (convert to string for consistency)
        graph = {str(node_id): [] for node_id in self.nodes.keys()}
        
        for edge in self.edges:
            # Convert to string for consistency
            from_node = str(edge["from"])
            to_node = str(edge["to"])
            weight = edge["weight"]
            
            # Add bidirectional edges
            graph[from_node].append((to_node, weight))
            graph[to_node].append((from_node, weight))
        
        return graph
    
    def find_shortest_path(self, start_node_name: str, end_node_name: str) -> Tuple[List, float]:
        """
        Find shortest path between two nodes by name
        
        Returns:
            Tuple of (path_node_ids, total_distance)
        """
        # Find node IDs by name
        start_id = self.find_node_id_by_name(start_node_name)
        end_id = self.find_node_id_by_name(end_node_name)
        
        if start_id is None or end_id is None:
            raise ValueError(f"Could not find nodes: {start_node_name} or {end_node_name}")
        
        return self._dijkstra(start_id, end_id)
    
    def find_node_id_by_name(self, name: str) -> Optional[str]:
        """Find node ID by its name (returns string ID)"""
        for node_id, data in self.nodes.items():
            if data["name"] == name:
                return str(node_id)  # Return as string
        return None
    
    def _dijkstra(self, start: str, end: str) -> Tuple[List, float]:
        """Core Dijkstra algorithm implementation"""
        # Initialize distances
        distances = {node: float('inf') for node in self.graph.keys()}
        distances[start] = 0
        
        # Priority queue: (distance, node)
        pq = [(0, start)]
        
        # Track previous nodes for path reconstruction
        previous = {node: None for node in self.graph.keys()}
        
        while pq:
            current_dist, current_node = heapq.heappop(pq)
            
            # If we reached the destination
            if current_node == end:
                break
            
            # If we found a better path already, skip
            if current_dist > distances[current_node]:
                continue
            
            # Explore neighbors
            for neighbor, weight in self.graph[current_node]:
                distance = current_dist + weight
                
                if distance < distances[neighbor]:
                    distances[neighbor] = distance
                    previous[neighbor] = current_node
                    heapq.heappush(pq, (distance, neighbor))
        
        # Reconstruct path
        path = []
        current = end
        while current is not None:
            path.append(int(current))  # Convert back to int for consistency
            current = previous[current]
        
        path.reverse()
        
        return path, distances[end]
    
    def get_path_coordinates(self, path: List[int]) -> List[Tuple[int, int]]:
        """Convert path node IDs to coordinates for visualization"""
        coordinates = []
        for node_id in path:
            # Convert to string to access the nodes dict
            node = self.nodes[str(node_id)]
            coordinates.append((node["x"], node["y"]))
        return coordinates