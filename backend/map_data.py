import numpy as np
from typing import List, Dict, Optional, Any
from layer_data import LayerData

class MapData:
    """Data class to hold the preprocessed image layers and global vectors."""
    def __init__(self) -> None:
        self._width: int = 0
        self._height: int = 0
        self._water_mask: np.ndarray = np.array([])
        self._global_coastlines: List[List[Dict[str, float]]] = []
        self._global_borders: List[List[Dict[str, float]]] = []
        self._global_rivers: List[Dict[str, Any]] = []
        self._global_cliffs: List[List[Dict[str, float]]] = []
        self._terrain_layers: List[LayerData] = []
        self._cliff_layers: List[LayerData] = []
        self._coastline_layers: List[LayerData] = []
        self._city_layers: List[LayerData] = []
        self._source_unknowns: Optional[np.ndarray] = None

    @property
    def width(self) -> int: return self._width
    @width.setter
    def width(self, value: int): self._width = value

    @property
    def height(self) -> int: return self._height
    @height.setter
    def height(self, value: int): self._height = value

    @property
    def water_mask(self) -> np.ndarray: return self._water_mask
    @water_mask.setter
    def water_mask(self, value: np.ndarray): self._water_mask = value

    @property
    def global_coastlines(self) -> List[List[Dict[str, float]]]: return self._global_coastlines
    @property
    def global_borders(self) -> List[List[Dict[str, float]]]: return self._global_borders
    @property
    def global_rivers(self) -> List[Dict[str, Any]]: return self._global_rivers
    @property
    def global_cliffs(self) -> List[List[Dict[str, float]]]: return self._global_cliffs
    @property
    def terrain_layers(self) -> List[LayerData]: return self._terrain_layers
    @property
    def cliff_layers(self) -> List[LayerData]: return self._cliff_layers
    @property
    def coastline_layers(self) -> List[LayerData]: return self._coastline_layers
    @property
    def city_layers(self) -> List[LayerData]: return self._city_layers
    @property
    def source_unknowns(self) -> Optional[np.ndarray]: return self._source_unknowns
    @source_unknowns.setter
    def source_unknowns(self, value: Optional[np.ndarray]): self._source_unknowns = value
