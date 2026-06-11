import React, { useState } from 'react';
import { useAuthStore } from '../store/auth';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { storage } from '../lib/api';

type Section = 'profile' | 'account' | 'appearance' | 'notifications' | 'shortcuts' | 'about';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'profile', label: '프로필', icon: '👤' },
  { id: 'account', label: '계정 & 보안', icon: '🔒' },
  { id: 'appearance', label: '외관', icon: '🎨' },
  { id: 'notifications', label: '알림', icon: '🔔' },
  { id: 'shortcuts', label: '단축키', icon: '⌨️' },
  { id: 'about', label: '정보', icon: 'ℹ️' },
];

interface Props {
  onClose(): void;
  darkMode: boolean;
  onToggleDarkMode(): void;
  accentColor: string;
  onAccentColorChange(color: string): void;
  fontSize: number;
  onFontSizeChange(size: number): void;
}

const ACCENT_COLORS = [
  '#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245',
  '#3BA55C', '#FAA61A', '#7289DA', '#00B0F4',
];

export function SettingsPage({ onClose, darkMode, onToggleDarkMode, accentColor, onAccentColorChange, fontSize, onFontSizeChange }: Props): React.ReactElement {
  const { user } = useAuthStore();
  const [section, setSection] = useState<Section>('profile');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [statusText, setStatusText] = useState(user?.statusText ?? '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [notifSound, setNotifSound] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(true);
  const [notifBadge, setNotifBadge] = useState(true);

  async function saveProfile(): Promise<void> {
    if (!displayName.trim()) { toast.error('이름을 입력하세요'); return; }
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/me', {
        displayName: displayName.trim(),
        statusText: statusText.trim() || null,
      });
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, ...data } : s.user }));
      toast.success('저장되었습니다');
    } catch {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(): Promise<void> {
    if (!currentPw || !newPw) { toast.error('비밀번호를 입력하세요'); return; }
    if (newPw.length < 8) { toast.error('새 비밀번호는 8자 이상이어야 합니다'); return; }
    if (newPw !== confirmPw) { toast.error('새 비밀번호가 일치하지 않습니다'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      toast.success('비밀번호가 변경되었습니다');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch {
      toast.error('비밀번호 변경 실패');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-3xl h-[600px] flex overflow-hidden shadow-2xl">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0 bg-white/5 border-r border-white/10 flex flex-col py-4">
          <div className="px-4 mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-sm">설정</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">&times;</button>
          </div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                section === s.id ? 'bg-accent/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {section === 'profile' && (
            <div className="space-y-5 max-w-md">
              <h3 className="text-base font-semibold mb-4">프로필</h3>
              <div>
                <label className="block text-sm text-white/60 mb-1">이름</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">상태 메시지</label>
                <input
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="지금 하고 있는 일..."
                  className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">이메일</label>
                <input
                  value={user?.email ?? ''}
                  readOnly
                  className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-white/40 cursor-not-allowed"
                />
              </div>
              <button
                onClick={() => void saveProfile()}
                disabled={saving}
                className="px-5 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          )}

          {section === 'account' && (
            <div className="space-y-5 max-w-md">
              <h3 className="text-base font-semibold mb-4">비밀번호 변경</h3>
              <div>
                <label className="block text-sm text-white/60 mb-1">현재 비밀번호</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">새 비밀번호</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="최소 8자"
                  className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <button
                onClick={() => void changePassword()}
                disabled={saving}
                className="px-5 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          )}

          {section === 'appearance' && (
            <div className="space-y-6 max-w-md">
              <h3 className="text-base font-semibold mb-4">외관</h3>
              <div>
                <label className="block text-sm text-white/60 mb-2">테마</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => { if (!darkMode) onToggleDarkMode(); }}
                    className={`flex-1 py-3 text-sm rounded-lg border transition-colors ${darkMode ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 text-white/50 hover:border-white/30'}`}
                  >
                    🌙 다크 모드
                  </button>
                  <button
                    onClick={() => { if (darkMode) onToggleDarkMode(); }}
                    className={`flex-1 py-3 text-sm rounded-lg border transition-colors ${!darkMode ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 text-white/50 hover:border-white/30'}`}
                  >
                    ☀️ 라이트 모드
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">강조 색상</label>
                <div className="flex gap-2 flex-wrap">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        onAccentColorChange(color);
                        void storage.set('accentColor', color);
                      }}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${accentColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">폰트 크기: {fontSize}px</label>
                <input
                  type="range"
                  min={12}
                  max={18}
                  value={fontSize}
                  onChange={(e) => {
                    const size = Number(e.target.value);
                    onFontSizeChange(size);
                    void storage.set('fontSize', String(size));
                    document.documentElement.style.fontSize = `${size}px`;
                  }}
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-xs text-white/30 mt-1">
                  <span>12px</span><span>18px</span>
                </div>
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div className="space-y-4 max-w-md">
              <h3 className="text-base font-semibold mb-4">알림 설정</h3>
              {[
                { label: '소리 알림', value: notifSound, set: setNotifSound },
                { label: '데스크탑 알림', value: notifDesktop, set: setNotifDesktop },
                { label: '앱 뱃지 카운트', value: notifBadge, set: setNotifBadge },
              ].map(({ label, value, set }) => (
                <label key={label} className="flex items-center justify-between cursor-pointer py-2 border-b border-white/5">
                  <span className="text-sm">{label}</span>
                  <div
                    onClick={() => set((v) => !v)}
                    className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${value ? 'bg-accent' : 'bg-white/20'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </label>
              ))}
            </div>
          )}

          {section === 'shortcuts' && (
            <div className="max-w-md">
              <h3 className="text-base font-semibold mb-4">키보드 단축키</h3>
              <div className="space-y-2">
                {[
                  ['Ctrl + K', '빠른 탐색 (Command Palette)'],
                  ['Ctrl + /', '단축키 목록 보기'],
                  ['Ctrl + Shift + G', '앱 창 표시/숨김'],
                  ['Ctrl + F', '채널 내 메시지 검색'],
                  ['Escape', '모달 닫기'],
                  ['Enter', '메시지 전송'],
                  ['Shift + Enter', '줄바꿈'],
                  ['↑', '마지막 메시지 편집 시작'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm text-white/70">{desc}</span>
                    <kbd className="text-xs bg-white/10 border border-white/20 px-2 py-0.5 rounded font-mono">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'about' && (
            <div className="max-w-md">
              <h3 className="text-base font-semibold mb-4">정보</h3>
              <div className="space-y-3 text-sm text-white/60">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-2xl">👾</div>
                  <div>
                    <div className="text-white font-semibold text-base">GameDev Messenger</div>
                    <div className="text-xs">v{window.electron?.app ? '...' : '1.0.0'}</div>
                  </div>
                </div>
                <p>게임 개발팀을 위한 올인원 협업 도구</p>
                <p>Slack 클론 + 기획서 뷰어/편집기 + 태스크 트래커 + Notion/Obsidian 연동</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
