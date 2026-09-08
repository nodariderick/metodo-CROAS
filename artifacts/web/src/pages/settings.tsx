import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { useSetPassword, getGetMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const setPasswordMutation = useSetPassword();

  if (!user) return null;

  const roleLabels = {
    MASTER: 'Master / Admin',
    COLLABORATOR: 'Colaborador',
    CLIENT: 'Cliente',
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 8) {
      setPwError('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('As senhas não coincidem.');
      return;
    }

    try {
      await setPasswordMutation.mutateAsync({
        data: {
          ...(user.hasPassword ? { currentPassword } : {}),
          newPassword,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setPwSuccess('Senha definida com sucesso! Agora você pode entrar com e-mail e senha.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Erro ao definir senha. Tente novamente.';
      setPwError(msg);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <header className="mb-10">
        <h1 className="font-serif text-4xl text-foreground">Ajustes & Perfil</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm uppercase">Preferências de Conta</p>
      </header>

      <div className="max-w-2xl w-full space-y-6">
        {/* ── Profile card ── */}
        <div className="border border-border bg-card">
          <div className="border-b border-border px-8 py-6 flex items-center gap-6 bg-background/50">
            <div className="w-24 h-24 rounded-none border border-primary flex items-center justify-center bg-background text-primary">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-serif text-4xl font-bold">{user.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2 className="font-serif text-2xl mb-1">{user.name}</h2>
              <p className="font-mono text-sm text-primary uppercase tracking-widest">{roleLabels[user.role]}</p>
            </div>
          </div>

          <div className="px-8 py-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Email</label>
                <div className="font-medium text-sm px-4 py-3 border border-border bg-background text-foreground/80">
                  {user.email}
                </div>
              </div>
              
              <div>
                <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">ID Sistema</label>
                <div className="font-medium text-sm px-4 py-3 border border-border bg-background text-foreground/80 font-mono">
                  {user.id.toString().padStart(6, '0')}
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Membro Desde</label>
                <div className="font-medium text-sm px-4 py-3 border border-border bg-background text-foreground/80">
                  {format(new Date(user.createdAt), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Status</label>
                <div className="font-medium text-sm px-4 py-3 border border-border bg-background flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-primary shadow-[0_0_10px_rgba(214,154,33,0.5)]' : 'bg-destructive'}`}></div>
                  <span className={user.isActive ? 'text-primary' : 'text-destructive'}>
                    {user.isActive ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Password section ── */}
        <div className="border border-border bg-card">
          <div className="border-b border-border px-8 py-5">
            <h3 className="font-serif text-lg">
              {user.hasPassword ? 'Alterar Senha' : 'Definir Senha'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {user.hasPassword
                ? 'Você já possui uma senha. Informe a atual para definir uma nova.'
                : 'Sua conta usa login com Google. Defina uma senha para poder entrar também com e-mail e senha.'}
            </p>
          </div>

          <div className="px-8 py-8">
            <form onSubmit={handleSetPassword} className="space-y-5 max-w-sm">
              {user.hasPassword && (
                <div>
                  <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3 border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <div>
                <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  {user.hasPassword ? 'Nova Senha' : 'Senha'}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full px-4 py-3 border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                  placeholder="Repita a senha"
                />
              </div>

              {pwError && (
                <p className="text-sm text-destructive font-mono">{pwError}</p>
              )}
              {pwSuccess && (
                <p className="text-sm text-primary font-mono">{pwSuccess}</p>
              )}

              <button
                type="submit"
                disabled={setPasswordMutation.isPending}
                className="h-10 px-8 border border-primary bg-primary/10 text-primary text-xs font-medium uppercase tracking-widest hover:bg-primary hover:text-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {setPasswordMutation.isPending ? 'Salvando…' : user.hasPassword ? 'Alterar Senha' : 'Definir Senha'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
