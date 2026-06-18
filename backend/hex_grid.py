import math
from typing import Tuple

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
