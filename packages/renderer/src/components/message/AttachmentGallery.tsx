import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Lightbox, type LightboxImage } from './Lightbox';

type GalleryTab = 'image' | 'video' | '3d' | 'code';

interface GalleryAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  message: {
    id: string;
    createdAt: string;
    sender: { id: string; displayName: string };
  };
}

const TABS: { key: GalleryTab; label: string }[] = [
  { key: 'image', label: '이미지' },
  { key: 'video', label: '영상' },
  { key: '3d', label: '3D' },
  { key: 'code', label: '코드' },
];

export function AttachmentGallery({
  channelId,
  onClose,
}: {
  channelId: string;
  onClose(): void;
}): React.ReactElement {
  const [tab, setTab] = useState<GalleryTab>('image');
  const [attachments, setAttachments] = useState<GalleryAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; initialIndex: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    setAttachments([]);
    api.get<GalleryAttachment[]>(`/channels/${channelId}/attachments`, { params: { type: tab } })
      .then(({ data }) => setAttachments(data))
      .catch(() => toast.error('갤러리 로드 실패'))
      .finally(() => setLoading(false));
  }, [channelId, tab]);

  function openExternal(url: string) {
    if (window.electron?.shell) void window.electron.shell.openExternal(url);
    else window.open(url, '_blank');
  }

  return (
    <>
      {lightbox && (
        <Lightbox images={lightbox.images} initialIndex={lightbox.initialIndex} onClose={() => setLightbox(null)} />
      )}
      <div className="w-72 flex-shrink-0 border-l border-white/10 flex flex-col bg-surface-alt h-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <span className="font-semibold text-sm">첨부 파일</span>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="aspect-square bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          )}
          {!loading && attachments.length === 0 && (
            <p className="text-center text-white/40 text-xs py-8">파일이 없습니다.</p>
          )}
          {!loading && tab === 'image' && attachments.length > 0 && (
            <div className="grid grid-cols-3 gap-1">
              {attachments.map((a, idx) => (
                <button
                  key={a.id}
                  onClick={() =>
                    setLightbox({
                      images: attachments.map((x) => ({ src: x.fileUrl, fileName: x.fileName, fileSize: x.fileSize })),
                      initialIndex: idx,
                    })
                  }
                  className="aspect-square overflow-hidden rounded bg-black/30 hover:opacity-80 transition-opacity"
                  title={a.fileName}
                >
                  <img src={a.fileUrl} alt={a.fileName} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {!loading && tab !== 'image' && attachments.length > 0 && (
            <div className="space-y-1">
              {attachments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openExternal(a.fileUrl)}
                  className="w-full text-left flex items-center gap-2 px-2 py-2 rounded hover:bg-white/5 transition-colors"
                >
                  <span className="text-base flex-shrink-0">
                    {tab === 'video' ? '🎬' : tab === '3d' ? '🎮' : '📝'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-white/80 truncate">{a.fileName}</div>
                    <div className="text-[10px] text-white/40">
                      {(a.fileSize / 1024).toFixed(0)} KB ·{' '}
                      {format(new Date(a.message.createdAt), 'M/d', { locale: ko })} ·{' '}
                      {a.message.sender.displayName}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
