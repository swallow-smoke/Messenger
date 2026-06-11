import React, { useState } from 'react';
import { useAuthStore } from '../store/auth';

interface Props {
  onGoToLogin(): void;
}

export function RegisterPage({ onGoToLogin }: Props): React.ReactElement {
  const { register, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('올바른 이메일 형식이 아닙니다.');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!displayName.trim()) {
      setError('표시 이름을 입력해주세요.');
      return;
    }

    try {
      await register(email, displayName.trim(), password);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : '회원가입에 실패했습니다.';
      setError(msg);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-surface">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-white/5 border border-white/10 rounded-xl p-8 w-80 flex flex-col gap-4"
      >
        <h1 className="text-xl font-bold text-center text-white">회원가입</h1>
        <p className="text-center text-white/50 text-sm -mt-2">GameDev Messenger</p>

        {error && (
          <p className="text-red-400 text-sm text-center whitespace-pre-line bg-red-400/10 rounded px-3 py-2" role="alert">
            {error}
          </p>
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          required
          className="bg-white/10 rounded px-3 py-2 text-sm outline-none placeholder-white/40 text-white focus:ring-1 focus:ring-accent"
        />
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="표시 이름"
          required
          maxLength={32}
          className="bg-white/10 rounded px-3 py-2 text-sm outline-none placeholder-white/40 text-white focus:ring-1 focus:ring-accent"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (8자 이상)"
          required
          minLength={8}
          className="bg-white/10 rounded px-3 py-2 text-sm outline-none placeholder-white/40 text-white focus:ring-1 focus:ring-accent"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="비밀번호 확인"
          required
          className="bg-white/10 rounded px-3 py-2 text-sm outline-none placeholder-white/40 text-white focus:ring-1 focus:ring-accent"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="bg-accent text-white rounded py-2 text-sm font-medium disabled:opacity-50 hover:bg-accent/80 transition-colors"
        >
          {isLoading ? '가입 중…' : '회원가입'}
        </button>

        <p className="text-center text-white/50 text-xs">
          이미 계정이 있으신가요?{' '}
          <button
            type="button"
            onClick={onGoToLogin}
            className="text-accent hover:underline"
          >
            로그인
          </button>
        </p>
      </form>
    </div>
  );
}
