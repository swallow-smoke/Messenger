import React, { useState } from 'react';
import type { Attachment } from '../../store/messages';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateName(name: string): string {
  const maxLen = 24;
  if (name.length <= maxLen) return name;
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx > 0 && name.length - dotIdx <= 6) {
    const ext = name.slice(dotIdx);
    return name.slice(0, maxLen - ext.length - 1) + '…' + ext;
  }
  return name.slice(0, maxLen - 1) + '…';
}

interface TypeInfo {
  label: string;
  textColor: string;
  bgColor: string;
}

function getTypeInfo(fileName: string, mimeType: string): TypeInfo {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown'))
    return { label: 'MD', textColor: 'text-purple-400', bgColor: 'bg-purple-500/20' };
  if (lower.endsWith('.pdf'))
    return { label: 'PDF', textColor: 'text-red-400', bgColor: 'bg-red-500/20' };
  if (lower.endsWith('.glb') || lower.endsWith('.fbx') || lower.endsWith('.gltf'))
    return { label: '3D', textColor: 'text-blue-400', bgColor: 'bg-blue-500/20' };
  if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z') || lower.endsWith('.tar') || lower.endsWith('.gz'))
    return { label: 'ZIP', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
  if (mimeType.startsWith('video/'))
    return { label: 'VID', textColor: 'text-green-400', bgColor: 'bg-green-500/20' };
  if (mimeType.startsWith('audio/'))
    return { label: 'AUD', textColor: 'text-green-400', bgColor: 'bg-green-500/20' };
  return { label: 'FILE', textColor: 'text-white/50', bgColor: 'bg-white/10' };
}

interface Props {
  attachment: Attachment;
}

export function FileChip({ attachment }: Props): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const { label, textColor, bgColor } = getTypeInfo(attachment.fileName, attachment.mimeType);

  function download() {
    const a = document.createElement('a');
    a.href = attachment.fileUrl;
    a.download = attachment.fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <button
      type="button"
      onClick={download}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2.5 mt-1 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-colors"
    >
      <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center flex-shrink-0`}>
        <span className={`text-[10px] font-bold leading-none ${textColor}`}>{label}</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span
          className="text-white/90 text-xs font-medium leading-tight"
          title={attachment.fileName}
        >
          {truncateName(attachment.fileName)}
        </span>
        <span className="text-white/40 text-[10px] leading-tight mt-0.5">
          {formatFileSize(attachment.fileSize)}
        </span>
      </div>
      <div className={`ml-auto pl-2 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
        <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
    </button>
  );
}
