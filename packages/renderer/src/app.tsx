import React, { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { AppShell } from './components/layout/AppShell';
import { RegisterPage } from './pages/RegisterPage';
import { DebugPanel } from './components/common/DebugPanel';
import { useAuthStore } from './store/auth';
import { useSettingsStore, BG_GRADIENTS } from './store/settings';

type AuthPage = 'login' | 'register';

function AppBackground(): React.ReactElement | null {
  const { settings } = useSettingsStore();
  if (settings.bgType === 'image' && settings.bgImage) {
    return (
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          zIndex: -10,
          backgroundImage: `url(${settings.bgImage})`,
          filter: `brightness(${settings.bgBrightness}%)`,
        }}
      />
    );
  }
  if (settings.bgType === 'gradient') {
    return (
      <div
        className="fixed inset-0"
        style={{ zIndex: -10, background: BG_GRADIENTS[settings.bgGradient] ?? BG_GRADIENTS[0] }}
      />
    );
  }
  return null;
}

export function App(): React.ReactElement {
  const { user, isLoading, loadFromStorage } = useAuthStore();
  const { load: loadSettings } = useSettingsStore();
  const [authPage, setAuthPage] = useState<AuthPage>('login');

  useEffect(() => {
    void loadFromStorage();
    void loadSettings();
  }, [loadFromStorage, loadSettings]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface text-white/60">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authPage === 'register') {
      return <RegisterPage onGoToLogin={() => setAuthPage('login')} />;
    }
    return <LoginPage onGoToRegister={() => setAuthPage('register')} />;
  }

  return (
    <>
      <AppBackground />
      <AppShell />
      <DebugPanel />
    </>
  );
}

interface LoginPageProps {
  onGoToRegister(): void;
}

function LoginPage({ onGoToRegister }: LoginPageProps): React.ReactElement {
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(getLoginErrorMessage(err));
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-surface">
      <form onSubmit={(e) => void handleSubmit(e)} className="bg-white/5 border border-white/10 rounded-xl p-8 w-80 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-center text-white">GameDev Messenger</h1>
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
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          required
          className="bg-white/10 rounded px-3 py-2 text-sm outline-none placeholder-white/40 text-white focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-accent text-white rounded py-2 text-sm font-medium disabled:opacity-50 hover:bg-accent/80 transition-colors"
        >
          {isLoading ? '로그인 중…' : '로그인'}
        </button>
        <p className="text-center text-white/50 text-xs">
          계정이 없으신가요?{' '}
          <button
            type="button"
            onClick={onGoToRegister}
            className="text-accent hover:underline"
          >
            회원가입
          </button>
        </p>
      </form>
    </div>
  );
}

function getLoginErrorMessage(err: unknown): string {
  if (!isAxiosError(err)) {
    return 'Unexpected login error. Check the app console or server logs.';
  }
  if (!err.response) {
    return 'Cannot reach the server at http://localhost:4000.\nMake sure the server container or pnpm dev server is running.';
  }
  const detail = getResponseError(err.response.data);
  if (err.response.status === 401) {
    return detail ?? 'Invalid email or password.';
  }
  return detail
    ? `Server returned ${err.response.status}: ${detail}`
    : `Server returned ${err.response.status}. Check the server logs for details.`;
}

function getResponseError(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('error' in data)) return null;
  const error = (data as { error?: unknown }).error;
  return typeof error === 'string' && error.trim() ? error : null;
}
