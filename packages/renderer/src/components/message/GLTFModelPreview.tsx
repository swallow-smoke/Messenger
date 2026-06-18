import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  fileUrl: string;
  fileName: string;
  fileSize?: number;
}

function GLTFScene({ url, onLoaded }: { url: string; onLoaded: () => void }): React.ReactElement {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null!);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    const box = new THREE.Box3().setFromObject(g);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) g.scale.setScalar(2 / maxDim);
    const center = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());
    g.position.set(-center.x, -center.y, -center.z);
    onLoaded();
  }, [scene, onLoaded]);

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

interface BoundaryProps {
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  children: React.ReactNode;
}

class GLTFErrorBoundary extends React.Component<BoundaryProps, { failed: boolean }> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): React.ReactNode {
    if (this.state.failed) {
      const { fileName, fileUrl, fileSize } = this.props;
      return (
        <div className="inline-flex items-center gap-3 mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70">
          <span className="text-2xl">🎮</span>
          <div className="flex-1">
            <div className="font-medium text-white/80">{fileName}</div>
            <div className="text-white/40 mt-0.5">
              {fileSize !== undefined ? `${(fileSize / 1024).toFixed(0)} KB · ` : ''}3D 모델 (GLTF)
            </div>
          </div>
          <a
            href={fileUrl}
            download={fileName}
            onClick={(e) => {
              e.preventDefault();
              if (window.electron?.shell) void window.electron.shell.openExternal(fileUrl);
              else window.open(fileUrl, '_blank');
            }}
            className="px-2 py-1 bg-accent/20 hover:bg-accent/40 text-accent rounded text-xs transition-colors"
          >
            다운로드
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

export function GLTFModelPreview({ fileUrl, fileName, fileSize }: Props): React.ReactElement {
  const [loaded, setLoaded] = useState(false);
  const handleLoaded = useCallback(() => setLoaded(true), []);

  function openExternal(url: string) {
    if (window.electron?.shell) void window.electron.shell.openExternal(url);
    else window.open(url, '_blank');
  }

  return (
    <GLTFErrorBoundary fileName={fileName} fileUrl={fileUrl} fileSize={fileSize}>
      <div
        className="mt-1 rounded-lg overflow-hidden border border-white/10 bg-black/30 relative group/gltf"
        style={{ width: 400, height: 300 }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 z-10 pointer-events-none">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
            <span className="text-xs text-white/40">3D 모델 로드 중...</span>
          </div>
        )}
        <Canvas
          gl={{ alpha: false }}
          camera={{ position: [0, 1.5, 4], fov: 50 }}
          style={{ width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 5]} intensity={1.2} />
          <directionalLight position={[-5, -5, -5]} intensity={0.3} />
          <Suspense fallback={null}>
            <GLTFScene url={fileUrl} onLoaded={handleLoaded} />
          </Suspense>
          <OrbitControls makeDefault />
        </Canvas>
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover/gltf:opacity-100 transition-opacity pointer-events-none">
          <span className="text-xs text-white/50 truncate max-w-[200px]">{fileName}</span>
          <a
            href={fileUrl}
            download={fileName}
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData('DownloadURL', `model/gltf-binary:${fileName}:${fileUrl}`)
            }
            onClick={(e) => {
              e.preventDefault();
              openExternal(fileUrl);
            }}
            className="pointer-events-auto px-2 py-1 bg-black/60 hover:bg-black/80 text-white/80 hover:text-white rounded text-xs"
          >
            ⬇ 다운로드
          </a>
        </div>
      </div>
    </GLTFErrorBoundary>
  );
}
