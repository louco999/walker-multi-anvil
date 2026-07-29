import { Suspense, useEffect, useMemo, useState } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
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

/** Per-group / per-id PBR so press orange / white / SS / gray read correctly on web. */
function materialForCadPart(meta: CadPartMeta, transparentShell?: boolean): THREE.MeshStandardMaterial {
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
    metalness = 0.72;
    roughness = 0.36;
  } else if (group === 'hatbox' || group === 'end_ring') {
    metalness = 0.88;
    roughness = 0.24;
  } else if (group === 'press_ram') {
    // RAL orange paint — not chrome
    metalness = 0.12;
    roughness = 0.48;
    emissive = color.clone().multiplyScalar(0.12);
    emissiveIntensity = 0.18;
  } else if (group === 'press_base') {
    // machine pedestal gray paint
    metalness = 0.18;
    roughness = 0.62;
  } else if (group === 'press_table' || group === 'press_platen') {
    // stainless work surfaces / tooling
    metalness = 0.88;
    roughness = 0.2;
  } else if (group === 'press_cabinet') {
    if (id.includes('EStop')) {
      metalness = 0.15;
      roughness = 0.45;
      emissive = new THREE.Color('#400000');
      emissiveIntensity = 0.15;
    } else if (id.includes('Screen') || id.includes('Button')) {
      metalness = 0.08;
      roughness = 0.55;
    } else {
      metalness = 0.28;
      roughness = 0.52;
    }
  } else if (group === 'press_frame') {
    if (id.includes('Chrome') || id.includes('Handle')) {
      metalness = 0.95;
      roughness = 0.12;
    } else if (id.includes('Column') && !id.includes('Nut')) {
      // white column paint
      metalness = 0.22;
      roughness = 0.4;
    } else if (id.includes('GaugeDial')) {
      metalness = 0.05;
      roughness = 0.35;
    } else if (id.includes('Gauge') || id.includes('Brand') || id.includes('Hub')) {
      metalness = 0.35;
      roughness = 0.45;
    } else if (id.includes('Crown') || id.includes('HeadFront') || id.includes('TopCrossHead')) {
      // gray painted head
      metalness = 0.28;
      roughness = 0.48;
    } else {
      metalness = 0.55;
      roughness = 0.35;
    }
  } else if (group.startsWith('press_')) {
    metalness = 0.4;
    roughness = 0.4;
  } else if (group.startsWith('cell_')) {
    metalness = 0.35;
    roughness = 0.45;
  }

  // chrome tooling override by name
  if (id.includes('UpperChrome') || id.includes('ChromeBar')) {
    metalness = 0.95;
    roughness = 0.12;
  }

  const isTransparent = Boolean(transparentShell && isMgo) || isCapsule;
  // DoubleSide + coplanar WC faces → z-fight flicker when rotating / cutaway
  const side = isTransparent || isMgo ? THREE.DoubleSide : THREE.FrontSide;
  // Slight depth bias on tightly packed anvils (8 WC faces touch)
  const needBias = group === 'wc' || group === 'first_stage';

  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    side,
    emissive,
    emissiveIntensity,
    transparent: isTransparent,
    opacity: transparentShell && isMgo ? 0.38 : isCapsule ? 0.75 : 1,
    depthWrite: !(transparentShell && isMgo),
    envMapIntensity: group === 'wc' ? 0.55 : 1.0,
    flatShading: false,
    polygonOffset: needBias,
    polygonOffsetFactor: needBias ? 1 : 0,
    polygonOffsetUnits: needBias ? 1 : 0,
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

  // Weld STL verts + smooth normals once — raw STL facets shimmer when metal/orbiting
  const geometry = useMemo(() => {
    let g: THREE.BufferGeometry = rawGeo;
    try {
      g = mergeVertices(rawGeo, 1e-4);
    } catch {
      g = rawGeo;
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [rawGeo]);

  const mat = useMemo(
    () => materialForCadPart(meta, transparentShell),
    [meta.color, meta.group, meta.id, transparentShell],
  );

  // Clip in world +X (half-section). Shared plane instance is fine — constant is fixed.
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.015), []);

  useEffect(() => {
    if (cutaway) {
      mat.clippingPlanes = [clipPlane];
      mat.clipShadows = false; // clipped shadow maps look blocky/mosaic on WC
    } else {
      mat.clippingPlanes = [];
      mat.clipShadows = false;
    }
    mat.needsUpdate = true;
  }, [mat, cutaway, clipPlane]);

  if (hiddenGroups.has(meta.group)) return null;

  // Never explode outer press frame parts (they must stay seated)
  const isPress = meta.group.startsWith('press_');
  const isWc = meta.group === 'wc';
  const isCell = meta.group.startsWith('cell_');
  const e = isPress ? 0 : layerExplosion(explosion, meta.layer);
  const distMm = e * explodeScale * (1 + meta.layer * 0.25);
  const [tx, ty, tz] = meta.thrust;
  // FreeCAD +Z press → Three +Y
  const pos = new THREE.Vector3(
    isPress ? 0 : tx * distMm,
    isPress ? 0 : tz * distMm,
    isPress ? 0 : -ty * distMm,
  );

  // WC cubes: no receiveShadow — shadow acne on dark faces looks like mosaic when orbiting
  return (
    <mesh
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

  return (
    <group>
      <CadAssembly manifest={manifest} explodeScale={80} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]} receiveShadow>
        <circleGeometry args={[2.8, 64]} />
        <meshStandardMaterial color="#2a2e34" metalness={0.12} roughness={0.88} />
      </mesh>
    </group>
  );
}

/** Walker module CAD (hatbox + anvils + cell), no outer press. */
export function CadModel() {
  const { manifest, error } = useCadManifest(publicUrl('cad/manifest.json'));

  if (error) {
    console.warn('CAD manifest failed', error);
    return <CadSingleStlFallback url={publicUrl('cad/WalkerTypeModule.stl')} scale={0.012} />;
  }
  if (!manifest) return null;

  return (
    <group>
      <CadAssembly manifest={manifest} explodeScale={32} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]} receiveShadow>
        <circleGeometry args={[2.4, 48]} />
        <meshStandardMaterial color="#2a2e34" metalness={0.1} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Isolated 14/8 cell — grooves / TC / sample visible. */
export function CellModel() {
  const { manifest, error } = useCadManifest(publicUrl('cad/cell_manifest.json'));

  if (error) {
    console.warn('Cell manifest failed', error);
    return <CadSingleStlFallback url={publicUrl('cad/cell_14_8/Cell_14_8.stl')} scale={0.09} />;
  }
  if (!manifest) return null;

  return (
    <group>
      <CadAssembly manifest={manifest} explodeScale={5} transparentShell />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} receiveShadow>
        <circleGeometry args={[0.95, 48]} />
        <meshStandardMaterial color="#1e2228" metalness={0.1} roughness={0.9} />
      </mesh>
    </group>
  );
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
