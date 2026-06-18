import numpy as np
from typing import List, Optional

class LayerData:
    def __init__(self, name: str, img_bgr: np.ndarray, ink_mask: Optional[np.ndarray] = None, vectors: Optional[List] = None):
        self._name = name
        self._img_bgr = img_bgr
        self._ink_mask = ink_mask
        self._vectors = vectors or []

    @property
    def name(self) -> str: return self._name
    @property
    def img_bgr(self) -> np.ndarray: return self._img_bgr
    @property
    def ink_mask(self) -> Optional[np.ndarray]: return self._ink_mask
    @property
    def vectors(self) -> List: return self._vectors
