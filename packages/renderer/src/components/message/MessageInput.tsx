import React, { useState, useRef, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { getSocket } from '../../lib/socket';
import { useMessagesStore } from '../../store/messages';
import { useAuthStore } from '../../store/auth';
import { useChannelsStore } from '../../store/channels';
import { usePresenceStore } from '../../store/presence';
import { useLinkPreview } from '../../hooks/useLinkPreview';
import { EmbedCard } from './EmbedCard';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { Message, Attachment } from '../../store/messages';

interface EmojiData {
  native: string;
  id: string;
}

interface WorkspaceMember {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface Props {
  contextType: 'channel' | 'dm';
  contextId: string;
  parentId?: string;
  placeholder?: string;
}

interface PendingFile {
  file: File;
  progress: number;
  uploaded?: { file_url: string; thumbnail_url?: string | null; file_name: string; mime_type: string; file_size: number };
  error?: string;
}

const SLASH_COMMANDS = [
  { cmd: '/notion', label: 'Embed Notion page' },
  { cmd: '/wiki', label: 'Link wiki document' },
  { cmd: '/task', label: 'Reference task' },
  { cmd: '/remind', label: '<시간> <내용> — 타이머 알림' },
  { cmd: '/bug', label: '버그 리포트 작성' },
];

function parseRemindTime(s: string): number | null {
  let ms = 0;
  const pattern = /(\d+)(h|m|s)/g;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(s)) !== null) {
    matched = true;
    const n = parseInt(m[1], 10);
    if (m[2] === 'h') ms += n * 3_600_000;
    else if (m[2] === 'm') ms += n * 60_000;
    else ms += n * 1_000;
  }
  return matched && ms > 0 ? ms : null;
}

export function MessageInput({ contextType, contextId, parentId, placeholder }: Props): React.ReactElement {
  const [value, setValue] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showEmojiAutocomplete, setShowEmojiAutocomplete] = useState(false);
  const [emojiSuggestions, setEmojiSuggestions] = useState<EmojiData[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<WorkspaceMember[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [typingTimer, setTypingTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showBugModal, setShowBugModal] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const channels = useChannelsStore((s) => s.channels);
  const workspaceId = channels.find((c) => c.id === contextId)?.workspaceId;
  const presences = usePresenceStore((s) => s.presences);
  const { addOptimistic, confirmOptimistic, removeOptimistic } = useMessagesStore();
  const linkPreview = useLinkPreview(value);

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 20;
    const maxHeight = lineHeight * 6;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value]);

  // Fetch workspace members for @mention autocomplete (channel context only)
  useEffect(() => {
    if (!workspaceId) return;
    api
      .get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)
      .then(({ data: d }) => setMembers(d))
      .catch(() => {});
  }, [workspaceId]);

  function emitTypingStart() {
    getSocket().emit('typing:start', { contextId });
  }

  function emitTypingStop() {
    getSocket().emit('typing:stop', { contextId });
  }

  async function handleRemind(args: string): Promise<void> {
    const spaceIdx = args.indexOf(' ');
    if (spaceIdx < 0) {
      toast.error('/remind 사용법: /remind <시간> <내용> (예: /remind 5m 스탠드업!)');
      return;
    }
    const timeStr = args.slice(0, spaceIdx).trim();
    const text = args.slice(spaceIdx + 1).trim();
    const ms = parseRemindTime(timeStr);
    if (!ms || !text) {
      toast.error('/remind 사용법: /remind <시간> <내용> (예: /remind 5m 스탠드업!)');
      return;
    }
    toast.success(`⏰ ${timeStr} 후 알림 예약: "${text}"`);
    setTimeout(() => {
      toast(text, { icon: '⏰', duration: 10_000 });
    }, ms);
  }

  function checkMentionAutocomplete(v: string): void {
    if (members.length === 0) { setShowMentions(false); return; }
    const cursorPos = inputRef.current?.selectionStart ?? v.length;
    const before = v.slice(0, cursorPos);
    const match = /@(\w*)$/.exec(before);
    if (match) {
      const query = match[1].toLowerCase();
      const filtered = members.filter((m) => m.displayName.toLowerCase().includes(query)).slice(0, 6);
      if (filtered.length > 0) {
        setMentionSuggestions(filtered);
        setShowMentions(true);
        setMentionIdx(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }

  function insertMention(member: WorkspaceMember): void {
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursorPos);
    const afterText = value.slice(cursorPos);
    const atIdx = before.lastIndexOf('@');
    const newValue = (atIdx >= 0 ? before.slice(0, atIdx) : before) + '@' + member.displayName + ' ' + afterText;
    setValue(newValue);
    setShowMentions(false);

    // DND notice
    if (presences[member.id]?.status === 'dnd') {
      toast(`${member.displayName} 님은 방해 금지 상태입니다`, { icon: '🚫' });
    }

    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Emoji autocomplete: detect :word pattern
  async function checkEmojiAutocomplete(v: string) {
    const cursorPos = inputRef.current?.selectionStart ?? v.length;
    const before = v.slice(0, cursorPos);
    const match = /:(\w+)$/.exec(before);
    if (match && match[1].length >= 2) {
      try {
        const emojiMart = await import('emoji-mart');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = await (emojiMart.SearchIndex.search as (q: string) => Promise<EmojiData[]>)(match[1]);
        setEmojiSuggestions((results ?? []).slice(0, 6));
        setShowEmojiAutocomplete(true);
      } catch {
        setShowEmojiAutocomplete(false);
      }
    } else {
      setShowEmojiAutocomplete(false);
      setEmojiSuggestions([]);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    const v = e.target.value;
    setValue(v);
    setShowCommands(v.startsWith('/') && !v.includes(' '));

    if (typingTimer) clearTimeout(typingTimer);
    emitTypingStart();
    setTypingTimer(setTimeout(() => emitTypingStop(), 4000));

    void checkEmojiAutocomplete(v);
    checkMentionAutocomplete(v);
  }

  function insertEmoji(emoji: EmojiData): void {
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);
    const colonIdx = before.lastIndexOf(':');
    const newBefore = colonIdx >= 0 ? before.slice(0, colonIdx) : before;
    setValue(newBefore + emoji.native + ' ' + after);
    setShowEmojiAutocomplete(false);
    setShowEmojiPicker(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function insertPickerEmoji(emojiData: EmojiData): void {
    const v = value + emojiData.native;
    setValue(v);
    setShowEmojiPicker(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (showMentions) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx((i) => Math.min(i + 1, mentionSuggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); const m = mentionSuggestions[mentionIdx]; if (m) insertMention(m); return; }
      if (e.key === 'Escape') { setShowMentions(false); return; }
    }
    if (showEmojiAutocomplete && (e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (e.key === 'Escape') setShowEmojiAutocomplete(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
    if (e.key === 'Escape') {
      setShowCommands(false);
      setShowEmojiPicker(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>): void {
    const images = Array.from(e.clipboardData.items).filter((item) => item.type.startsWith('image/'));
    if (images.length === 0) return;
    e.preventDefault();
    const files = images.map((item) => item.getAsFile()).filter((f): f is File => f !== null);
    if (files.length) addFiles(files);
  }

  async function uploadFile(file: File): Promise<PendingFile['uploaded'] | undefined> {
    const formData = new FormData();
    formData.append('file', file);

    setPendingFiles((prev) =>
      prev.map((pf) => (pf.file === file ? { ...pf, progress: 10 } : pf))
    );

    try {
      const { data: result } = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 90) / (progressEvent.total ?? progressEvent.loaded));
          setPendingFiles((prev) =>
            prev.map((pf) => (pf.file === file ? { ...pf, progress: percent } : pf))
          );
        },
      });
      setPendingFiles((prev) =>
        prev.map((pf) =>
          pf.file === file
            ? { ...pf, progress: 100, uploaded: result as PendingFile['uploaded'] }
            : pf
        )
      );
      return result as PendingFile['uploaded'];
    } catch {
      setPendingFiles((prev) =>
        prev.map((pf) =>
          pf.file === file ? { ...pf, error: 'Upload failed' } : pf
        )
      );
      toast.error(`${file.name} 업로드 실패`);
      return undefined;
    }
  }

  function addFiles(files: FileList | File[]): void {
    const arr = Array.from(files);
    setPendingFiles((prev) => [
      ...prev,
      ...arr.map((f) => ({ file: f, progress: 0 })),
    ]);
    for (const f of arr) {
      void uploadFile(f);
    }
  }

  function handleDrop(e: React.DragEvent): void {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  async function send(): Promise<void> {
    const content = value.trim();
    const uploaded = pendingFiles
      .filter((pf) => pf.uploaded)
      .map((pf) => pf.uploaded!);

    // Slash command execution
    if (content.startsWith('/')) {
      const spaceIdx = content.indexOf(' ');
      const cmd = spaceIdx >= 0 ? content.slice(0, spaceIdx) : content;
      const args = spaceIdx >= 0 ? content.slice(spaceIdx + 1) : '';
      if (cmd === '/remind') {
        setValue('');
        setShowCommands(false);
        await handleRemind(args);
        return;
      }
      if (cmd === '/bug') {
        setValue('');
        setShowCommands(false);
        setShowBugModal(true);
        return;
      }
    }

    if (!content && !uploaded.length) return;
    if (pendingFiles.some((pf) => pf.progress < 100 && !pf.error)) {
      toast.error('파일 업로드가 완료될 때까지 기다려주세요.');
      return;
    }

    if (!user) return;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!contextId || !UUID_RE.test(contextId)) {
      toast.error('채널 ID가 올바르지 않습니다');
      return;
    }

    const tempId = `__temp_${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: Message = {
      id: tempId,
      contextType,
      contextId,
      senderId: user.id,
      sender: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl },
      parentId,
      content: content || `[파일 ${uploaded.length}개]`,
      metadata: {},
      isEdited: false,
      isDeleted: false,
      isPending: true,
      createdAt: now,
      updatedAt: now,
      attachments: uploaded.map((u, i) => ({
        id: `__att_${i}`,
        fileUrl: u.file_url,
        fileName: u.file_name,
        mimeType: u.mime_type,
        fileSize: u.file_size,
        thumbnailUrl: u.thumbnail_url ?? null,
      })) as Attachment[],
      reactions: [],
    };

    addOptimistic(optimistic);
    setValue('');
    setPendingFiles([]);
    setShowCommands(false);
    emitTypingStop();

    const socket = getSocket();
    socket.emit(
      'message:send',
      {
        contextType,
        contextId,
        content: content || ' ',
        parentId,
        metadata: uploaded.length ? { attachments: uploaded } : undefined,
        clientTempId: tempId,
      },
      (res: { ok: boolean; message?: Message; error?: string }) => {
        if (res.ok && res.message) {
          confirmOptimistic(tempId, res.message);
        } else {
          removeOptimistic(tempId, contextId);
          toast.error(res.error ?? '메시지 전송 실패');
        }
      }
    );
  }

  function selectCommand(cmd: string): void {
    setValue(cmd + ' ');
    setShowCommands(false);
    inputRef.current?.focus();
  }

  const hasContent = value.trim() || pendingFiles.some((pf) => pf.uploaded);

  return (
    <div
      className={`relative px-4 pb-4 ${dragging ? 'ring-2 ring-inset ring-accent/40' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {showBugModal && (
        <BugReportModal
          onClose={() => setShowBugModal(false)}
          onSubmit={(report) => {
            const socket = getSocket();
            if (!contextId || !user) return;
            socket.emit('message:send', {
              contextType,
              contextId,
              content: report.content,
              parentId,
              metadata: { buildTag: `bug-${report.severity}` },
            });
            setShowBugModal(false);
          }}
        />
      )}
      {dragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-accent/10 rounded-lg pointer-events-none border-2 border-dashed border-accent/40">
          <span className="text-accent font-medium text-sm">파일을 여기에 드롭하세요</span>
        </div>
      )}

      {linkPreview && (
        <div className="mb-2">
          <EmbedCard embed={{ type: 'link', ...linkPreview }} />
        </div>
      )}

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map((pf, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-white/60 truncate max-w-32">{pf.file.name}</span>
              {pf.error ? (
                <span className="text-red-400">실패</span>
              ) : pf.progress < 100 ? (
                <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${pf.progress}%` }}
                  />
                </div>
              ) : (
                <span className="text-green-400">✓</span>
              )}
              <button
                onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-white/30 hover:text-white/70"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Slash command menu */}
      {showCommands && (
        <div className="absolute bottom-full left-4 mb-1 bg-surface border border-white/20 rounded-lg shadow-xl w-72 z-10">
          {SLASH_COMMANDS.map((c) => (
            <button
              key={c.cmd}
              onClick={() => selectCommand(c.cmd)}
              className="w-full text-left px-3 py-2 hover:bg-white/10 text-sm"
            >
              <span className="text-accent font-mono">{c.cmd}</span>
              <span className="text-white/50 ml-2">{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Mention autocomplete */}
      {showMentions && mentionSuggestions.length > 0 && (
        <div className="absolute bottom-full left-4 mb-1 bg-surface border border-white/20 rounded-lg shadow-xl w-64 z-10">
          {mentionSuggestions.map((member, i) => (
            <button
              key={member.id}
              onClick={() => insertMention(member)}
              className={`w-full text-left px-3 py-2 hover:bg-white/10 text-sm flex items-center gap-2 ${i === mentionIdx ? 'bg-white/10' : ''}`}
            >
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className="w-5 h-5 rounded-full flex-shrink-0 object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-[10px] text-accent">
                  {member.displayName[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-white/80">{member.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji autocomplete */}
      {showEmojiAutocomplete && emojiSuggestions.length > 0 && (
        <div className="absolute bottom-full left-4 mb-1 bg-surface border border-white/20 rounded-lg shadow-xl z-10">
          {emojiSuggestions.map((emoji) => (
            <button
              key={emoji.id}
              onClick={() => insertEmoji(emoji)}
              className="w-full text-left px-3 py-2 hover:bg-white/10 text-sm flex items-center gap-2"
            >
              <span className="text-lg">{emoji.native}</span>
              <span className="text-white/60">:{emoji.id}:</span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-full right-4 mb-1 z-50" onClick={(e) => e.stopPropagation()}>
          <Picker
            data={data}
            onEmojiSelect={(e: EmojiData) => insertPickerEmoji(e)}
            theme="dark"
            locale="ko"
            previewPosition="none"
          />
        </div>
      )}

      <div className="flex items-end gap-2 bg-white/10 rounded-xl px-3 py-2">
        {/* File attach */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="파일 첨부"
          className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder ?? '메시지 입력...'}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder-white/40 min-h-[20px] leading-5"
          style={{ overflowY: 'hidden' }}
        />

        {/* Emoji button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker((v) => !v)}
          title="이모지"
          className={`p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 ${showEmojiPicker ? 'text-accent' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 13s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
          </svg>
        </button>

        <button
          onClick={() => void send()}
          disabled={!hasContent}
          className="px-3 py-1 rounded-lg bg-accent text-white text-sm disabled:opacity-40 hover:bg-accent/80 transition-colors flex-shrink-0"
        >
          전송
        </button>
      </div>
    </div>
  );
}

type BugSeverity = 'low' | 'medium' | 'high' | 'critical';

interface BugReport { content: string; severity: BugSeverity; }

function BugReportModal({
  onClose,
  onSubmit,
}: {
  onClose(): void;
  onSubmit(report: BugReport): void;
}): React.ReactElement {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [severity, setSeverity] = useState<BugSeverity>('medium');

  const SEVERITIES: { key: BugSeverity; label: string; color: string }[] = [
    { key: 'low', label: '낮음', color: 'text-green-400' },
    { key: 'medium', label: '중간', color: 'text-yellow-400' },
    { key: 'high', label: '높음', color: 'text-orange-400' },
    { key: 'critical', label: '심각', color: 'text-red-400' },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error('제목을 입력하세요'); return; }
    const content = [
      `🐛 **[BUG] ${title.trim()}**`,
      `**심각도**: ${SEVERITIES.find((s) => s.key === severity)?.label ?? severity}`,
      description.trim() ? `\n**설명**\n${description.trim()}` : '',
      steps.trim() ? `\n**재현 방법**\n${steps.trim()}` : '',
    ].filter(Boolean).join('\n');
    onSubmit({ content, severity });
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">🐛 버그 리포트</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="버그 제목 *"
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSeverity(s.key)}
                className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                  severity === s.key
                    ? `${s.color} border-current bg-white/5`
                    : 'text-white/40 border-white/10 hover:border-white/20'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            rows={3}
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none focus:ring-1 focus:ring-accent"
          />
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="재현 방법 (선택) — 각 단계를 줄바꿈으로 구분"
            rows={3}
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-white/60 hover:text-white">취소</button>
            <button type="submit" className="px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm">
              전송
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
