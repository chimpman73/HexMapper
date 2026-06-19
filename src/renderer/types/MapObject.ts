export interface BaseMapObject {
  /** Stable identifier */
  id: string;
  /** Type of map object */
  type: 'city' | 'river' | 'terrainHex' | 'label' | 'road' | 'border' | 'coastline' | 'cliff' | 'legend' | 'grid' | 'bg_image' | 'group';
  /** Optional human‑readable name (e.g., city name, river name) */
  name?: string;
  /** Arbitrary metadata that can be used by UI or processing pipelines */
  meta?: Record<string, unknown>;
}
