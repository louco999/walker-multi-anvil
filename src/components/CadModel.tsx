import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { easeOutCubic, layerExplosion, useWalkerStore } from '../store/useWalkerStore';
import type { CadManifest, CadPartMeta } from '../cad/types';

/** Public asset URL with Vite base (works on GitHub Pages /repo-name/). */
function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const clean = path.replace(/^\/+/, '');
  return `${base}${clean}`;
}

/**
 * Everything *inside* the heater stack gets a heat map:
 * furnace tube, spacers, capsule, sample, TC, electrodes.
 * Outer MgO / ZrO₂ sleeve stay cold (static materials).
 *
 * False-color axial gradient (furnace +Z): mid-plane white-hot, both ends blue-cold.
 * Material.color must be white when vertexColors is on (otherwise dark albedo kills map).
 */
const HEATER_STACK_GROUPS = new Set([
  'cell_furnace',
  'cell_sample',
  'cell_spacer',
  'cell_tc',
  'cell_electrode',
]);

/** Half-length of heater stack along Z (mm). Matches 14/8 furnace ~5.2 mm tall. */
const HEATER_STACK_HALF_Z = 2.7;

function isHeaterStackPart(meta: CadPartMeta): boolean {
  return HEATER_STACK_GROUPS.has(meta.group);
}

/** Classic thermal false-color: cold navy → cyan → yellow → white-hot. */
function heatFalseColor(heat01: number, out: THREE.Color): THREE.Color {
  const h = Math.min(1, Math.max(0, heat01));
  if (h < 0.25) {
    const u = h / 0.25;
    return out.setRGB(0.05 + u * 0.05, 0.08 + u * 0.35, 0.35 + u * 0.45);
  }
  if (h < 0.5) {
    const u = (h - 0.25) / 0.25;
    return out.setRGB(0.1 + u * 0.7, 0.43 + u * 0.45, 0.8 - u * 0.55);
  }
  if (h < 0.75) {
    const u = (h - 0.5) / 0.25;
    return out.setRGB(0.8 + u * 0.2, 0.88 - u * 0.15, 0.25 - u * 0.2);
  }
  const u = (h - 0.75) / 0.25;
  return out.setRGB(1.0, 0.73 + u * 0.27, 0.05 + u * 0.75);
}

function applyHeaterStackGradientColors(
  geo: THREE.BufferGeometry,
  temperatureC: number,
  baseColor: THREE.Color,
) {
  const pos = geo.getAttribute('position');
  if (!pos) return;
  let colors = geo.getAttribute('color') as THREE.BufferAttribute | null;
  if (!colors || colors.count !== pos.count) {
    colors = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    geo.setAttribute('color', colors);
  }

  // Use this mesh's Z span if it is long (furnace); else global heater half-length
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  const span = zMax - zMin;
  // gradient reference: prefer full stack scale so mid vs ends read clearly
  const half =
    span > 1.5
      ? Math.max(Math.abs(zMin), Math.abs(zMax), span * 0.5) * 0.98
      : HEATER_STACK_HALF_Z;

  const tNorm = Math.min(1, Math.max(0, (temperatureC - 25) / 2000));
  // Boost visibility: heat map kicks in early and stays strong
  const heatAmp = Math.min(1, tNorm * 1.35);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    // 0 at mid-plane, 1 at ends
    const u = Math.min(1, Math.abs(z) / Math.max(half, 1e-3));
    // middle = 1 (hot), ends = 0 (cold) — strong parabolic falloff
    const midHot = Math.pow(1 - u, 1.65);
    if (heatAmp < 0.03) {
      c.copy(baseColor);
    } else {
      // local heat 0..1: ends stay cooler even at high T
      const local = heatAmp * (0.12 + 0.88 * midHot);
      heatFalseColor(local, c);
    }
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
}

/**
 * World-space cut plane for 半剖. Normal -X keeps the +X half (camera-friendly).
 * Shared instance — Three.js reads plane state each frame.
 */
const CUTAWAY_PLANE = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.015);

/** Per-group / per-id PBR so press orange / white / SS / gray read correctly on web. */
function materialForCadPart(
  meta: CadPartMeta,
  transparentShell?: boolean,
  cutaway?: boolean,
): THREE.MeshStandardMaterial {
  const [r, g, b] = meta.color;
  const color = new THREE.Color(r, g, b);
  const id = meta.id;
  const group = meta.group;

  const isSample = group === 'cell_sample' && id.includes('Sample');
  const isCapsule = id.includes('Capsule');
  const isFurnace = group === 'cell_furnace';
  const isTc = group === 'cell_tc';
  const isMgo = group === 'cell_mgo';

  let metalness = 0.45;
  let roughness = 0.42;
  let emissive = new THREE.Color(0x000000);
  let emissiveIntensity = 0;

  if (isSample) {
    metalness = 0.18;
    roughness = 0.48;
    emissive = new THREE.Color('#14532d');
    emissiveIntensity = 0.35;
  } else if (isTc) {
    metalness = 0.88;
    roughness = 0.22;
    emissive = new THREE.Color('#664400');
    emissiveIntensity = 0.22;
  } else if (isFurnace) {
    metalness = 0.1;
    roughness = 0.82;
    emissive = new THREE.Color('#331100');
    emissiveIntensity = 0.12;
  } else if (isMgo || group === 'cell_insulator' || group === 'cell_spacer') {
    metalness = 0.04;
    roughness = 0.78;
  } else if (group === 'wc') {
    // WC-Co: nearly matte dark — high metalness + low-poly STL = shimmer / “mosaic” when orbiting
    metalness = 0.12;
    roughness = 0.62;
  } else if (group === 'first_stage') {
    // Satin tool steel — not mirror polish
    metalness = 0.55;
    roughness = 0.42;
  } else if (group === 'hatbox' || group === 'end_ring') {
    // Brushed stainless module
    metalness = 0.62;
    roughness = 0.38;
  } else if (group === 'press_ram') {
    // RAL orange paint — matte industrial, tiny self-illum only
    metalness = 0.08;
    roughness = 0.58;
    emissive = color.clone().multiplyScalar(0.04);
    emissiveIntensity = 0.06;
  } else if (group === 'press_base') {
    // machine pedestal gray paint
    metalness = 0.12;
    roughness = 0.72;
  } else if (group === 'press_table' || group === 'press_platen') {
    // Satin stainless — was too mirror-like (0.88 / 0.2)
    metalness = 0.55;
    roughness = 0.42;
  } else if (group === 'press_cabinet') {
    if (id.includes('EStop')) {
      metalness = 0.1;
      roughness = 0.55;
      emissive = new THREE.Color('#300000');
      emissiveIntensity = 0.08;
    } else if (id.includes('Screen') || id.includes('Button')) {
      metalness = 0.05;
      roughness = 0.62;
    } else {
      metalness = 0.18;
      roughness = 0.62;
    }
  } else if (group === 'press_frame') {
    if (id.includes('Chrome') || id.includes('Handle')) {
      // Soft chrome, not showroom mirror
      metalness = 0.72;
      roughness = 0.28;
    } else if (id.includes('Column') && !id.includes('Nut')) {
      // white column paint — matte
      metalness = 0.1;
      roughness = 0.55;
    } else if (id.includes('GaugeDial')) {
      metalness = 0.04;
      roughness = 0.45;
    } else if (id.includes('Gauge') || id.includes('Brand') || id.includes('Hub')) {
      metalness = 0.22;
      roughness = 0.55;
    } else if (id.includes('Crown') || id.includes('HeadFront') || id.includes('TopCrossHead')) {
      // gray painted head
      metalness = 0.16;
      roughness = 0.58;
    } else {
      metalness = 0.28;
      roughness = 0.48;
    }
  } else if (group === 'press_props') {
    metalness = 0.25;
    roughness = 0.55;
  } else if (group.startsWith('press_')) {
    metalness = 0.22;
    roughness = 0.52;
  } else if (group.startsWith('cell_')) {
    metalness = 0.28;
    roughness = 0.5;
  }

  // chrome tooling override by name — soft polish only
  if (id.includes('UpperChrome') || id.includes('ChromeBar')) {
    metalness = 0.7;
    roughness = 0.28;
  }

  const isShellGlass = Boolean(transparentShell && isMgo);
  const isTransparent = isShellGlass || isCapsule;
  // Clip + FrontSide leaves reverse faces undrawn → hollow “transparent holes”.
  // DoubleSide during cutaway shows inner walls of shells / cut solids.
  // Intact view: FrontSide on WC/first-stage avoids coplanar z-fight flicker.
  const side =
    cutaway || isTransparent || isMgo ? THREE.DoubleSide : THREE.FrontSide;

  // Semi-transparent shells without depthWrite punch holes through internals when clipped.
  let opacity = 1;
  if (isShellGlass) opacity = cutaway ? 0.58 : 0.38;
  else if (isCapsule) opacity = cutaway ? 0.9 : 0.75;
  const depthWrite = isShellGlass ? Boolean(cutaway) : true;

  // Slight depth bias on tightly packed anvils; stronger when DoubleSide cutaway
  const needBias = group === 'wc' || group === 'first_stage' || Boolean(cutaway);
  const biasFactor = group === 'wc' && cutaway ? 2 : needBias ? 1 : 0;

  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    side,
    emissive,
    emissiveIntensity,
    transparent: isTransparent,
    opacity,
    depthWrite,
    // Full press has large painted + satin surfaces — keep env soft to avoid glitter
    envMapIntensity: group === 'wc'
      ? 0.4
      : group.startsWith('press_')
        ? 0.45
        : group === 'hatbox' || group === 'end_ring' || group === 'first_stage'
          ? 0.55
          : 0.7,
    flatShading: false,
    polygonOffset: needBias,
    polygonOffsetFactor: biasFactor,
    polygonOffsetUnits: needBias ? 1 : 0,
    clippingPlanes: cutaway ? [CUTAWAY_PLANE] : [],
    clipShadows: false,
  });
}

function PartMesh({
  meta,
  explosion,
  cutaway,
  hiddenGroups,
  explodeScale,
  transparentShell,
}: {
  meta: CadPartMeta;
  explosion: number;
  cutaway: boolean;
  hiddenGroups: Set<string>;
  explodeScale: number;
  transparentShell?: boolean;
}) {
  const url = publicUrl(`cad/${meta.stl}`);
  const rawGeo = useLoader(STLLoader, url);
  const meshRef = useRef<THREE.Mesh>(null);
  const pivotRef = useRef<THREE.Group>(null);

  const temperatureC = useWalkerStore((s) => s.temperatureC);
  const pressureGPa = useWalkerStore((s) => s.pressureGPa);
  const simRunning = useWalkerStore((s) => s.simRunning);
  const simProgress = useWalkerStore((s) => s.simProgress);

  const isCell = meta.group.startsWith('cell_');
  // Everything packed inside the heater (not outer MgO / ZrO₂ shell)
  const isHeaterStack = isHeaterStackPart(meta);
  // Dial face + hub spin (not the whole gauge body housing)
  const isGaugeSpin = meta.id.includes('GaugeDial') || meta.id.includes('GaugeHub');

  const geometry = useMemo(() => {
    let g: THREE.BufferGeometry = rawGeo;
    try {
      g = mergeVertices(rawGeo, 1e-4);
    } catch {
      g = rawGeo;
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    if (isHeaterStack) {
      const [r, g0, b] = meta.color;
      applyHeaterStackGradientColors(g, 25, new THREE.Color(r, g0, b));
    }
    return g;
  }, [rawGeo, isHeaterStack, meta.color]);

  const gaugeCenter = useMemo(() => {
    if (!isGaugeSpin) return null;
    geometry.computeBoundingBox();
    const c = new THREE.Vector3();
    geometry.boundingBox?.getCenter(c);
    return c;
  }, [geometry, isGaugeSpin]);

  const mat = useMemo(() => {
    const m = materialForCadPart(meta, transparentShell, cutaway);
    if (isHeaterStack) {
      // CRITICAL: vertexColors multiply material.color — must be white or map is invisible
      m.color.set(0xffffff);
      m.vertexColors = true;
      m.metalness = 0.02;
      m.roughness = 0.62;
      m.emissive.set(0x000000);
      m.emissiveIntensity = 0;
      // skip ACES crush so false-color heat stays vivid
      m.toneMapped = false;
    }
    return m;
  }, [meta.color, meta.group, meta.id, transparentShell, isHeaterStack, cutaway]);

  // Needle / hub extras must clip with the same plane or they "float" into the cut void
  const needleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a1a1a',
        metalness: 0.4,
        roughness: 0.35,
        side: cutaway ? THREE.DoubleSide : THREE.FrontSide,
        clippingPlanes: cutaway ? [CUTAWAY_PLANE] : [],
      }),
    [cutaway],
  );
  const hubMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0d0d0d',
        metalness: 0.5,
        roughness: 0.3,
        side: cutaway ? THREE.DoubleSide : THREE.FrontSide,
        clippingPlanes: cutaway ? [CUTAWAY_PLANE] : [],
      }),
    [cutaway],
  );

  // Heater stack: strong false-color axial map (mid white-hot, ends blue-cold)
  useEffect(() => {
    if (!isHeaterStack) return;
    const [r, g0, b] = meta.color;
    applyHeaterStackGradientColors(geometry, temperatureC, new THREE.Color(r, g0, b));
    const tNorm = Math.min(1, Math.max(0, (temperatureC - 25) / 2000));
    mat.color.set(0xffffff);
    mat.vertexColors = true;
    // mild global glow — keep restrained so bloom doesn't wash out the cell
    mat.emissive.setRGB(0.45, 0.18, 0.04);
    mat.emissiveIntensity = Math.min(0.4, tNorm * 0.38);
    mat.needsUpdate = true;
  }, [isHeaterStack, geometry, temperatureC, meta.color, mat]);

  // Press top gauges: left follows pressure, right follows temperature
  useFrame((_, dt) => {
    if (!isGaugeSpin || !pivotRef.current) return;
    const isLeft = meta.id.includes('_L') || meta.id.endsWith('L');
    // sweep ~270° as experiment ramps; slight extra turn while climbing
    const climb = simRunning ? simProgress * 0.35 : 0;
    const target = isLeft
      ? (pressureGPa / 25) * Math.PI * 1.5 + climb
      : (Math.max(0, temperatureC - 25) / 2000) * Math.PI * 1.5 + climb * 0.85;
    pivotRef.current.rotation.y = THREE.MathUtils.damp(
      pivotRef.current.rotation.y,
      target,
      simRunning ? 4.5 : 6,
      dt,
    );
  });

  if (hiddenGroups.has(meta.group)) return null;

  const isPress = meta.group.startsWith('press_');
  const isWc = meta.group === 'wc';
  const e = isPress ? 0 : layerExplosion(explosion, meta.layer);
  const distMm = e * explodeScale * (1 + meta.layer * 0.25);
  const [tx, ty, tz] = meta.thrust;
  const pos = new THREE.Vector3(
    isPress ? 0 : tx * distMm,
    isPress ? 0 : tz * distMm,
    isPress ? 0 : -ty * distMm,
  );

  if (isGaugeSpin && gaugeCenter) {
    const gr = Math.max(geometry.boundingSphere?.radius ?? 8, 4);
    const showNeedle = meta.id.includes('GaugeDial');
    return (
      <group position={pos}>
        <group ref={pivotRef} position={gaugeCenter}>
          <mesh
            ref={meshRef}
            geometry={geometry}
            material={mat}
            position={gaugeCenter.clone().negate()}
            castShadow={false}
            receiveShadow={false}
          />
          {showNeedle && (
            <mesh position={[gr * 0.28, 0, 0]} castShadow={false} material={needleMat}>
              <boxGeometry args={[gr * 0.72, gr * 0.08, gr * 0.12]} />
            </mesh>
          )}
          {showNeedle && (
            <mesh castShadow={false} material={hubMat}>
              <sphereGeometry args={[gr * 0.1, 12, 12]} />
            </mesh>
          )}
        </group>
      </group>
    );
  }

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={mat}
      position={pos}
      castShadow={!isWc && !isCell}
      receiveShadow={!isWc && !isCell}
    />
  );
}

function CadAssembly({
  manifest,
  explodeScale,
  transparentShell,
}: {
  manifest: CadManifest;
  explodeScale: number;
  transparentShell?: boolean;
}) {
  const explosion = useWalkerStore((s) => s.explosion);
  const cutaway = useWalkerStore((s) => s.cutaway);
  const cadHidden = useWalkerStore((s) => s.cadHiddenGroups);
  const gl = useThree((s) => s.gl);
  const scale = manifest.scale_to_scene || 0.012;
  const hidden = useMemo(() => new Set(cadHidden), [cadHidden]);

  useEffect(() => {
    gl.localClippingEnabled = cutaway;
  }, [gl, cutaway]);

  // key includes version so STL loader remounts when CAD rebuilds
  const ver = (manifest as CadManifest & { version?: string }).version ?? '0';

  return (
    <group scale={scale} rotation={[-Math.PI / 2, 0, 0]}>
      {manifest.parts.map((p) => (
        <Suspense key={`${p.id}-${ver}-${p.stl}`} fallback={null}>
          <PartMesh
            meta={p}
            explosion={explosion}
            cutaway={cutaway}
            hiddenGroups={hidden}
            explodeScale={explodeScale}
            transparentShell={transparentShell}
          />
        </Suspense>
      ))}
    </group>
  );
}

function useCadManifest(url: string) {
  const [manifest, setManifest] = useState<CadManifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setManifest(null);
    setError(null);
    // Drop Three.js loader cache so updated STLs are not sticky
    THREE.Cache.clear();
    // bust JSON cache too
    const u = url.includes('?') ? url : `${url}?t=${Date.now()}`;
    fetch(u, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`${url} ${r.status}`);
        return r.json();
      })
      .then((data: CadManifest) => {
        if (!cancelled) setManifest(data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { manifest, error };
}

/** Full apparatus: 4-column press + Walker module + cell. */
export function FullPressModel() {
  const { manifest, error } = useCadManifest(publicUrl('cad/full_manifest.json'));

  if (error) {
    console.warn('Full press manifest failed, fallback to module', error);
    return <CadModel />;
  }
  if (!manifest) return null;

  // Floor lives only in Studio — avoid a second black disc blocking the press when orbiting.
  return <CadAssembly manifest={manifest} explodeScale={80} />;
}

/** Walker module CAD (hatbox + anvils + cell), no outer press. */
export function CadModel() {
  const { manifest, error } = useCadManifest(publicUrl('cad/manifest.json'));

  if (error) {
    console.warn('CAD manifest failed', error);
    return <CadSingleStlFallback url={publicUrl('cad/WalkerTypeModule.stl')} scale={0.012} />;
  }
  if (!manifest) return null;

  return <CadAssembly manifest={manifest} explodeScale={32} />;
}

/** Isolated 14/8 cell — grooves / TC / sample visible. */
export function CellModel() {
  const { manifest, error } = useCadManifest(publicUrl('cad/cell_manifest.json'));

  if (error) {
    console.warn('Cell manifest failed', error);
    return <CadSingleStlFallback url={publicUrl('cad/cell_14_8/Cell_14_8.stl')} scale={0.09} />;
  }
  if (!manifest) return null;

  return <CadAssembly manifest={manifest} explodeScale={5} transparentShell />;
}

function CadSingleStlFallback({ url, scale }: { url: string; scale: number }) {
  const geometry = useLoader(STLLoader, `${url}?t=${Date.now()}`);
  const explosion = useWalkerStore((s) => s.explosion);
  useEffect(() => {
    geometry.computeVertexNormals();
    geometry.center();
  }, [geometry]);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b0b8c0',
        metalness: 0.55,
        roughness: 0.4,
        side: THREE.DoubleSide,
      }),
    [],
  );
  return (
    <group
      scale={scale}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, easeOutCubic(explosion) * 0.12, 0]}
    >
      <mesh geometry={geometry} material={mat} castShadow receiveShadow />
    </group>
  );
}
