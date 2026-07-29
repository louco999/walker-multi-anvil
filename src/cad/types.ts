export interface CadPartMeta {
  id: string;
  group: string;
  layer: number;
  thrust: [number, number, number];
  stl: string;
  step?: string;
  color: [number, number, number];
  volume_mm3: number;
}

export interface CadManifest {
  units: string;
  scale_to_scene: number;
  press_axis: [number, number, number];
  cell: string;
  parameters: Record<string, number | string>;
  parts: CadPartMeta[];
  wc_overlap_mm3?: number;
}
