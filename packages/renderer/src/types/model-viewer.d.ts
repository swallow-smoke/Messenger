import type { CSSProperties } from 'react';

interface ModelViewerJSXProps {
  src?: string;
  alt?: string;
  poster?: string;
  'camera-controls'?: boolean | '';
  'auto-rotate'?: boolean | '';
  'shadow-intensity'?: string;
  'environment-image'?: string;
  style?: CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'model-viewer': ModelViewerJSXProps;
      }
    }
  }
}

export {};
