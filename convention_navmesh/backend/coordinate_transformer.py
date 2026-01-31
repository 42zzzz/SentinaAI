"""
Coordinate Transformer Module
Converts between SVG pixels, meters, and geographic coordinates (lat/lon)
"""

from typing import Tuple, Dict, List
import math


class CoordinateTransformer:
    """Transform coordinates between different reference systems"""
    
    def __init__(self, svg_dimensions: Tuple[float, float], geojson_bounds: Dict = None):
        """
        Initialize coordinate transformer
        
        Args:
            svg_dimensions: (width, height) in pixels
            geojson_bounds: Optional dict with 'min_lat', 'max_lat', 'min_lon', 'max_lon'
        """
        self.svg_width, self.svg_height = svg_dimensions
        
        # If GeoJSON bounds provided, calculate real-world scale
        if geojson_bounds:
            self.geojson_bounds = geojson_bounds
            self._calculate_real_world_scale()
        else:
            # Default: assume 1 pixel = 0.1 meter (this is adjustable)
            self.meters_per_pixel = 0.1
            self.geojson_bounds = None
    
    def _calculate_real_world_scale(self):
        """Calculate meters per pixel from GeoJSON geographic bounds"""
        # Get bounds
        min_lat = self.geojson_bounds['min_lat']
        max_lat = self.geojson_bounds['max_lat']
        min_lon = self.geojson_bounds['min_lon']
        max_lon = self.geojson_bounds['max_lon']
        
        # Calculate real-world dimensions using Haversine formula
        # Width (longitude distance at average latitude)
        avg_lat = (min_lat + max_lat) / 2
        lat_rad = math.radians(avg_lat)
        
        # Earth radius in meters
        R = 6371000
        
        # Width in meters
        lon_diff = math.radians(max_lon - min_lon)
        width_m = R * lon_diff * math.cos(lat_rad)
        
        # Height in meters
        lat_diff = math.radians(max_lat - min_lat)
        height_m = R * lat_diff
        
        # Calculate scale (use average of both dimensions)
        width_scale = width_m / self.svg_width
        height_scale = height_m / self.svg_height
        
        self.meters_per_pixel = (width_scale + height_scale) / 2
        self.building_dimensions_m = {
            'width': width_m,
            'height': height_m
        }
        
        print(f"Building dimensions: {width_m:.1f}m x {height_m:.1f}m")
        print(f"Scale: {self.meters_per_pixel:.3f} meters/pixel")
    
    def svg_to_meters(self, x: float, y: float) -> Tuple[float, float]:
        """Convert SVG pixel coordinates to meters"""
        return (
            x * self.meters_per_pixel,
            y * self.meters_per_pixel
        )
    
    def meters_to_svg(self, x_m: float, y_m: float) -> Tuple[float, float]:
        """Convert meters to SVG pixel coordinates"""
        return (
            x_m / self.meters_per_pixel,
            y_m / self.meters_per_pixel
        )
    
    def polygon_to_meters(self, polygon: List[List[float]]) -> List[List[float]]:
        """Convert a polygon from SVG pixels to meters"""
        return [
            list(self.svg_to_meters(point[0], point[1]))
            for point in polygon
        ]
    
    def normalize_coordinates(self, x: float, y: float) -> Tuple[float, float]:
        """
        Normalize SVG coordinates to 0-1 range
        Useful for WebGL/rendering engines
        """
        return (
            x / self.svg_width,
            y / self.svg_height
        )
    
    def denormalize_coordinates(self, x_norm: float, y_norm: float) -> Tuple[float, float]:
        """Convert normalized coordinates back to SVG pixels"""
        return (
            x_norm * self.svg_width,
            y_norm * self.svg_height
        )
    
    def transform_geometry(self, geometry: Dict, target_system: str = 'meters') -> Dict:
        """
        Transform all coordinates in a geometry object
        
        Args:
            geometry: Dict with 'polygon', 'bounds', 'center' keys
            target_system: 'meters', 'normalized', or 'pixels'
        """
        transformed = geometry.copy()
        
        if target_system == 'meters':
            transform_fn = self.svg_to_meters
        elif target_system == 'normalized':
            transform_fn = self.normalize_coordinates
        else:  # pixels - no transformation
            return transformed
        
        # Transform polygon
        if 'polygon' in geometry:
            transformed['polygon'] = [
                list(transform_fn(p[0], p[1]))
                for p in geometry['polygon']
            ]
        
        # Transform center
        if 'center' in geometry:
            x, y = transform_fn(geometry['center']['x'], geometry['center']['y'])
            transformed['center'] = {'x': x, 'y': y}
        
        # Transform bounds
        if 'bounds' in geometry:
            x, y = transform_fn(geometry['bounds']['x'], geometry['bounds']['y'])
            w, h = (
                geometry['bounds']['width'] * self.meters_per_pixel if target_system == 'meters' else geometry['bounds']['width'],
                geometry['bounds']['height'] * self.meters_per_pixel if target_system == 'meters' else geometry['bounds']['height']
            )
            transformed['bounds'] = {
                'x': x,
                'y': y,
                'width': w,
                'height': h
            }
        
        return transformed
    
    def get_scale_info(self) -> Dict:
        """Get scaling information for frontend"""
        return {
            'svg_dimensions': {
                'width': self.svg_width,
                'height': self.svg_height
            },
            'meters_per_pixel': self.meters_per_pixel,
            'building_dimensions_m': getattr(self, 'building_dimensions_m', None)
        }


def extract_geojson_bounds(geojson_data: Dict) -> Dict:
    """Extract bounding box from GeoJSON data"""
    if geojson_data['type'] == 'FeatureCollection':
        features = geojson_data['features']
        if not features:
            return None
        
        # Get first feature's geometry
        geometry = features[0]['geometry']
        coordinates = geometry['coordinates'][0]  # Outer ring of polygon
        
        lons = [coord[0] for coord in coordinates]
        lats = [coord[1] for coord in coordinates]
        
        return {
            'min_lon': min(lons),
            'max_lon': max(lons),
            'min_lat': min(lats),
            'max_lat': max(lats)
        }
    
    return None


if __name__ == '__main__':
    # Test with your GeoJSON data
    import json
    
    geojson_str = '''{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"coordinates":[[[55.28514167811778,25.221544615013386],[55.285686028545314,25.22123340829775],[55.28616814714442,25.221948974483112],[55.28827305653181,25.220899043260104],[55.29181204995919,25.225541532185503],[55.29026162371224,25.227136599916307],[55.2890019971085,25.226140196693052],[55.28699133263294,25.22713370705307],[55.28514635183484,25.224359979970103],[55.28401929803499,25.22246726320094],[55.285294274281426,25.22176237175553],[55.28514167811778,25.221544615013386]]],"type":"Polygon"}}]}'''
    
    geojson_data = json.loads(geojson_str)
    bounds = extract_geojson_bounds(geojson_data)
    
    print("GeoJSON Bounds:")
    print(f"  Longitude: {bounds['min_lon']:.6f} to {bounds['max_lon']:.6f}")
    print(f"  Latitude: {bounds['min_lat']:.6f} to {bounds['max_lat']:.6f}")
    
    # Initialize transformer
    transformer = CoordinateTransformer(
        svg_dimensions=(5600, 3200),
        geojson_bounds=bounds
    )
    
    # Test transformation
    test_point = (1000, 1000)
    meters = transformer.svg_to_meters(*test_point)
    normalized = transformer.normalize_coordinates(*test_point)
    
    print(f"\nTest point SVG: {test_point}")
    print(f"  In meters: ({meters[0]:.2f}, {meters[1]:.2f})")
    print(f"  Normalized: ({normalized[0]:.4f}, {normalized[1]:.4f})")
