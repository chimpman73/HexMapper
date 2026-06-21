import math
from typing import Tuple, List

class HexGrid:
    def __init__(self, hex_size: int = 40):
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
