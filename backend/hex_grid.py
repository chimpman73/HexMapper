import math
from typing import Tuple, List

class HexGrid:
    def __init__(self, hex_size: int = 40) -> None:
        self._hex_size = hex_size

    @property
    def hex_size(self) -> int:
        return self._hex_size

    def hex_to_pixel(self, q: int, r: int, orientation: str) -> Tuple[float, float]:
        """Convert axial coordinates to pixel coordinates."""
        if orientation == 'flat':
            x = self._hex_size * (3.0 / 2.0 * q)
            y = self._hex_size * (math.sqrt(3) / 2.0 * q + math.sqrt(3) * r)
        else: # pointy
            x = self._hex_size * (math.sqrt(3) * q + math.sqrt(3) / 2.0 * r)
            y = self._hex_size * (3.0 / 2.0 * r)
        return x, y

    def pixel_to_hex(self, x: float, y: float, orientation: str) -> Tuple[float, float]:
        """Convert pixel coordinates to fractional axial coordinates."""
        if orientation == 'flat':
            q = (2.0 / 3.0 * x) / self._hex_size
            r = (-1.0 / 3.0 * x + math.sqrt(3) / 3.0 * y) / self._hex_size
        else:
            q = (math.sqrt(3) / 3.0 * x - 1.0 / 3.0 * y) / self._hex_size
            r = (2.0 / 3.0 * y) / self._hex_size
        return q, r

    def hex_round(self, q: float, r: float) -> Tuple[int, int]:
        s = -q - r
        rq = round(q)
        rr = round(r)
        rs = round(s)
        
        q_diff = abs(rq - q)
        r_diff = abs(rr - r)
        s_diff = abs(rs - s)
        
        if q_diff > r_diff and q_diff > s_diff:
            rq = -rr - rs
        elif r_diff > s_diff:
            rr = -rq - rs
            
        return int(rq), int(rr)
        
    def get_hex_vertices(self, q: int, r: int, orientation: str) -> List[Tuple[float, float]]:
        cx, cy = self.hex_to_pixel(q, r, orientation)
        vertices = []
        for i in range(6):
            angle_deg = 60 * i + (0 if orientation == 'flat' else 30)
            angle_rad = math.pi / 180 * angle_deg
            vertices.append((cx + self._hex_size * math.cos(angle_rad), cy + self._hex_size * math.sin(angle_rad)))
        return vertices

    def generate_rectangular_grid(self, width: int, height: int, orientation: str) -> List[Tuple[int, int]]:
        hexes = []
        if orientation == 'flat':
            for q in range(width):
                offset = q // 2
                for row in range(height):
                    r = row - offset
                    hexes.append((q, r))
        else:
            for r in range(height):
                offset = r // 2
                for col in range(width):
                    q = col - offset
                    hexes.append((q, r))
        return hexes

class HexEdgeGraph:
    def __init__(self, size: float):
        self.adj = {}
        self.size = size

def build_hex_edge_graph(hex_grid: HexGrid, orientation: str, grid_hexes: List[Tuple[int, int]]) -> HexEdgeGraph:
    graph = HexEdgeGraph(hex_grid.hex_size)
    
    def node_key(x: float, y: float) -> str:
        return f"{round(x)},{round(y)}"
        
    for q, r in grid_hexes:
        vertices = hex_grid.get_hex_vertices(q, r, orientation)
        for i in range(6):
            p1 = {"x": vertices[i][0], "y": vertices[i][1]}
            p2 = {"x": vertices[(i + 1) % 6][0], "y": vertices[(i + 1) % 6][1]}
            k1 = node_key(p1["x"], p1["y"])
            k2 = node_key(p2["x"], p2["y"])
            
            if k1 not in graph.adj:
                graph.adj[k1] = []
            if k2 not in graph.adj:
                graph.adj[k2] = []
                
            if not any(node_key(n["x"], n["y"]) == k2 for n in graph.adj[k1]):
                graph.adj[k1].append(p2)
            if not any(node_key(n["x"], n["y"]) == k1 for n in graph.adj[k2]):
                graph.adj[k2].append(p1)
                
    return graph

def find_hex_edge_path(start_pixel: dict, end_pixel: dict, graph: HexEdgeGraph) -> List[float]:
    import heapq
    import itertools
    import math

    def node_key(x: float, y: float) -> str:
        return f"{round(x)},{round(y)}"
        
    start_node = None
    end_node = None
    min_dist_start = float('inf')
    min_dist_end = float('inf')
    
    for key, neighbors in graph.adj.items():
        sx_str, sy_str = key.split(',')
        sx, sy = float(sx_str), float(sy_str)
        
        d_start = (sx - start_pixel["x"]) ** 2 + (sy - start_pixel["y"]) ** 2
        if d_start < min_dist_start:
            min_dist_start = d_start
            start_node = {"x": sx, "y": sy, "key": key}
            
        d_end = (sx - end_pixel["x"]) ** 2 + (sy - end_pixel["y"]) ** 2
        if d_end < min_dist_end:
            min_dist_end = d_end
            end_node = {"x": sx, "y": sy, "key": key}
            
    if not start_node or not end_node:
        return [start_pixel["x"], start_pixel["y"], end_pixel["x"], end_pixel["y"]]
        
    if start_node["key"] == end_node["key"]:
        return [start_node["x"], start_node["y"]]
        
    counter = itertools.count()
    queue = []
    # (f_cost, count, node_dict, path_list, g_cost)
    heapq.heappush(queue, (0, next(counter), start_node, [start_node["x"], start_node["y"]], 0))
    visited = set()
    
    while queue:
        f_cost, _, current, path, cost = heapq.heappop(queue)
        
        if current["key"] == end_node["key"]:
            return path
            
        if current["key"] in visited:
            continue
        visited.add(current["key"])
        
        neighbors = graph.adj.get(current["key"], [])
        for n in neighbors:
            n_key = node_key(n["x"], n["y"])
            if n_key not in visited:
                g_cost = cost + graph.size
                h_cost = math.sqrt((n["x"] - end_node["x"])**2 + (n["y"] - end_node["y"])**2)
                f_cost_new = g_cost + h_cost
                new_path = path + [n["x"], n["y"]]
                heapq.heappush(queue, (f_cost_new, next(counter), {"x": n["x"], "y": n["y"], "key": n_key}, new_path, g_cost))
                
    return [start_pixel["x"], start_pixel["y"], end_pixel["x"], end_pixel["y"]]
