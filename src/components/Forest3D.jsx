import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky, Stars, Cloud } from "@react-three/drei";

/**
 * 3D variant of the forest using react-three-fiber.
 * Lazy-loaded — only fetched when user toggles 3D mode.
 *
 * Each tree is a stylized low-poly cone + cylinder. Cheap to render.
 */
function Tree3D({ position, size, kind }) {
  const trunkColor = kind === "dead" ? "#57534e" : "#78350f";
  const leafColor =
    kind === "overtime" ? "#15803d"
    : kind === "late" ? "#84cc16"
    : kind === "stunted" ? "#65a30d"
    : kind === "dead" ? "#52525b"
    : kind === "stump" ? "#92400e"
    : "#16a34a";

  if (kind === "stump") {
    return (
      <group position={position}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.4, 0.5, 0.4, 8]} />
          <meshStandardMaterial color={trunkColor} />
        </mesh>
      </group>
    );
  }

  const trunkHeight = 0.8 * size;
  const leafHeight = 1.6 * size;

  return (
    <group position={position}>
      <mesh position={[0, trunkHeight / 2, 0]}>
        <cylinderGeometry args={[0.15, 0.2, trunkHeight, 6]} />
        <meshStandardMaterial color={trunkColor} />
      </mesh>
      {kind === "dead" ? (
        <>
          <mesh position={[0.3, trunkHeight + 0.2, 0]} rotation={[0, 0, -0.6]}>
            <cylinderGeometry args={[0.05, 0.08, 0.4, 4]} />
            <meshStandardMaterial color={trunkColor} />
          </mesh>
          <mesh position={[-0.3, trunkHeight + 0.1, 0]} rotation={[0, 0, 0.7]}>
            <cylinderGeometry args={[0.05, 0.08, 0.35, 4]} />
            <meshStandardMaterial color={trunkColor} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, trunkHeight + leafHeight / 2, 0]}>
            <coneGeometry args={[0.8 * size, leafHeight, 6]} />
            <meshStandardMaterial color={leafColor} flatShading />
          </mesh>
          <mesh position={[0, trunkHeight + leafHeight * 0.7, 0]}>
            <coneGeometry args={[0.6 * size, leafHeight * 0.8, 6]} />
            <meshStandardMaterial color={leafColor} flatShading />
          </mesh>
          <mesh position={[0, trunkHeight + leafHeight * 1.1, 0]}>
            <coneGeometry args={[0.4 * size, leafHeight * 0.6, 6]} />
            <meshStandardMaterial color={leafColor} flatShading />
          </mesh>
        </>
      )}
    </group>
  );
}

function River3D() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -2]}>
      <planeGeometry args={[30, 4]} />
      <meshStandardMaterial color="#3b82f6" transparent opacity={0.7} />
    </mesh>
  );
}

function Ground({ color = "#86efac" }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Mountains() {
  return (
    <group position={[0, 0, -10]}>
      {[-8, -4, 0, 4, 8].map((x) => (
        <mesh key={x} position={[x, 1.5, 0]}>
          <coneGeometry args={[3, 3, 4]} />
          <meshStandardMaterial color="#a7f3d0" flatShading />
        </mesh>
      ))}
    </group>
  );
}

export default function Forest3D({ trees, sky, season, weather, canvasW = 1000, canvasH = 500 }) {
  // Position trees in 3D space using their existing 2D positions
  const treeNodes = useMemo(() => {
    return (trees || []).map((t) => {
      const x = (t.xPct - 0.5) * 25;
      const z = (t.yPct - 0.6) * 15;
      return {
        id: t.date,
        position: [x, 0, z],
        size: t.size,
        kind: t.kind,
      };
    });
  }, [trees]);

  const isNight = sky.phase === "night";
  const groundColor = isNight ? "#166534" : season?.palette?.groundBottom || "#86efac";

  return (
    <div className="aspect-[2/1] bg-slate-900">
      <Canvas
        camera={{ position: [0, 6, 14], fov: 50 }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          {/* Sky and lighting */}
          {isNight ? (
            <>
              <color attach="background" args={["#0b1729"]} />
              <Stars radius={50} depth={50} count={1500} factor={4} fade speed={1} />
              <ambientLight intensity={0.3} />
              <directionalLight position={[0, 10, 5]} intensity={0.5} color="#f1f5f9" />
            </>
          ) : (
            <>
              <Sky
                distance={450000}
                sunPosition={[
                  Math.cos((sky.sun.x / canvasW) * Math.PI) * 100,
                  Math.max(5, (1 - sky.sun.y / canvasH) * 100),
                  100,
                ]}
                inclination={0.49}
                azimuth={0.25}
              />
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
              <Cloud position={[-8, 8, -4]} speed={0.2} opacity={0.7} />
              <Cloud position={[6, 9, -2]} speed={0.15} opacity={0.6} />
            </>
          )}

          {/* Scene */}
          <Mountains />
          <Ground color={groundColor} />
          <River3D />

          {treeNodes.map((t) => (
            <Tree3D
              key={t.id}
              position={t.position}
              size={t.size}
              kind={t.kind}
            />
          ))}

          {treeNodes.length === 0 && null}

          <OrbitControls
            enablePan={false}
            minDistance={6}
            maxDistance={25}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.1}
          />
        </Suspense>
      </Canvas>

      <div className="absolute bottom-3 left-3 bg-black/50 text-white text-xs px-3 py-1.5 rounded-md pointer-events-none">
        Drag to rotate · Scroll to zoom · {weather && `${weather} weather`}
      </div>
    </div>
  );
}
