import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMeQueryKey } from '@workspace/api-client-react';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

const GOOGLE_AUTH_ERRORS: Record<string, string> = {
  google_access_denied:
    'O acesso pelo Google foi recusado. Use uma conta autorizada ou tente novamente.',
  google_account_not_authorized:
    'Esta conta Google ainda não foi autorizada. Peça ao administrador para liberar seu e-mail.',
  account_deactivated: 'Esta conta está desativada. Fale com o administrador.',
  google_auth_failed:
    'Não foi possível concluir o login com Google. Verifique a conta autorizada e tente novamente.',
};

export default function Login() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState(() => {
    const errorCode = new URLSearchParams(window.location.search).get('error');
    return errorCode ? (GOOGLE_AUTH_ERRORS[errorCode] ?? GOOGLE_AUTH_ERRORS.google_auth_failed) : '';
  });
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Pick up reset_token from URL query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (token) {
      setResetToken(token);
      setMode('reset');
      // Clean the token from the URL bar without reloading
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setError('');
    };
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setSuccess('');
    setForm({ name: '', email: '', password: '', confirm: '' });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'register' && form.password !== form.confirm) {
      setError('As senhas não coincidem');
      return;
    }

    if (mode === 'reset' && form.password !== form.confirm) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'forgot') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError((data as { error?: string }).error ?? 'Erro inesperado');
          return;
        }
        setSuccess('Se este e-mail estiver cadastrado, você receberá um link em breve.');
        setForm((f) => ({ ...f, email: '' }));
        return;
      }

      if (mode === 'reset') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password: form.password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { error?: string }).error ?? 'Erro inesperado');
          return;
        }
        setSuccess('Senha redefinida com sucesso. Faça login com a nova senha.');
        setResetToken('');
        setForm({ name: '', email: '', password: '', confirm: '' });
        setTimeout(() => switchMode('login'), 2000);
        return;
      }

      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body: Record<string, string> =
        mode === 'login'
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Erro inesperado');
        return;
      }

      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      window.location.href = '/';
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const isLoginOrRegister = mode === 'login' || mode === 'register';

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient noise texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>

      {/* Subtle radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full px-6">
        {/* Logotype */}
        <div className="mb-10">
          <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-widest text-primary mb-6">
            CROAS
          </h1>
          <div className="h-[1px] w-24 bg-primary/30 mx-auto mb-6"></div>
          <p className="font-sans text-muted-foreground uppercase tracking-[0.2em] text-sm font-medium">
            Sistema de Gestão 360
          </p>
        </div>

        {/* ── Forgot password panel ── */}
        {mode === 'forgot' && (
          <>
            <p className="w-full text-left text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Recuperação de senha
            </p>
            <form onSubmit={submit} className="w-full flex flex-col gap-3">
              <input
                type="email"
                placeholder="Seu e-mail"
                value={form.email}
                onChange={set('email')}
                required
                className="w-full h-12 bg-card border border-border px-4 text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
              />
              {error && (
                <p className="text-xs font-mono text-destructive uppercase tracking-wider text-left">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-xs font-mono text-primary/80 uppercase tracking-wider text-left">
                  {success}
                </p>
              )}
              {!success && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-card border border-primary/40 text-primary font-medium uppercase tracking-widest text-sm hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '...' : 'Enviar link'}
                </button>
              )}
            </form>
            <button
              onClick={() => switchMode('login')}
              className="mt-5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
            >
              Voltar ao login
            </button>
          </>
        )}

        {/* ── Reset password panel ── */}
        {mode === 'reset' && (
          <>
            <p className="w-full text-left text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Nova senha
            </p>
            <form onSubmit={submit} className="w-full flex flex-col gap-3">
              <input
                type="password"
                placeholder="Nova senha"
                value={form.password}
                onChange={set('password')}
                required
                minLength={8}
                className="w-full h-12 bg-card border border-border px-4 text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
              />
              <input
                type="password"
                placeholder="Confirmar nova senha"
                value={form.confirm}
                onChange={set('confirm')}
                required
                minLength={8}
                className="w-full h-12 bg-card border border-border px-4 text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
              />
              {error && (
                <p className="text-xs font-mono text-destructive uppercase tracking-wider text-left">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-xs font-mono text-primary/80 uppercase tracking-wider text-left">
                  {success}
                </p>
              )}
              {!success && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-card border border-primary/40 text-primary font-medium uppercase tracking-widest text-sm hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '...' : 'Redefinir senha'}
                </button>
              )}
            </form>
            <button
              onClick={() => switchMode('login')}
              className="mt-5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
            >
              Voltar ao login
            </button>
          </>
        )}

        {/* ── Login / Register panel ── */}
        {isLoginOrRegister && (
          <>
            {/* Google button */}
            <a
              href="/api/auth/google"
              className="group relative w-full h-14 flex items-center justify-center gap-3 bg-primary text-primary-foreground font-medium uppercase tracking-widest text-sm transition-all hover:bg-accent focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <span className="relative z-10 flex items-center gap-3">
                <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
                </svg>
                Entrar com Google
              </span>
              <div className="absolute inset-0 border border-primary/50 group-hover:scale-[1.02] transition-transform duration-300 pointer-events-none"></div>
            </a>

            {/* Divider */}
            <div className="w-full flex items-center gap-3 my-6">
              <div className="flex-1 h-[1px] bg-border"></div>
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">ou</span>
              <div className="flex-1 h-[1px] bg-border"></div>
            </div>

            {/* Email / password form */}
            <form onSubmit={submit} className="w-full flex flex-col gap-3">
              {mode === 'register' && (
                <input
                  type="text"
                  placeholder="Nome"
                  value={form.name}
                  onChange={set('name')}
                  required
                  className="w-full h-12 bg-card border border-border px-4 text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
                />
              )}
              <input
                type="email"
                placeholder="E-mail"
                value={form.email}
                onChange={set('email')}
                required
                className="w-full h-12 bg-card border border-border px-4 text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
              />
              <input
                type="password"
                placeholder="Senha"
                value={form.password}
                onChange={set('password')}
                required
                minLength={8}
                className="w-full h-12 bg-card border border-border px-4 text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
              />
              {mode === 'register' && (
                <input
                  type="password"
                  placeholder="Confirmar senha"
                  value={form.confirm}
                  onChange={set('confirm')}
                  required
                  minLength={8}
                  className="w-full h-12 bg-card border border-border px-4 text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
                />
              )}

              {/* Inline error */}
              {error && (
                <p className="text-xs font-mono text-destructive uppercase tracking-wider text-left">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-card border border-primary/40 text-primary font-medium uppercase tracking-widest text-sm hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>

            {/* Forgot password link — only visible on login mode */}
            {mode === 'login' && (
              <button
                onClick={() => switchMode('forgot')}
                className="mt-3 text-xs font-mono text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
              >
                Esqueci minha senha
              </button>
            )}

            {/* Toggle login ↔ register */}
            <button
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="mt-3 text-xs font-mono text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
            >
              {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
            </button>
          </>
        )}

        <p className="mt-10 text-xs text-muted-foreground/60 font-mono tracking-wider">
          RESTRICTED ACCESS // COMMAND CENTER
        </p>
      </div>
    </div>
  );
}
