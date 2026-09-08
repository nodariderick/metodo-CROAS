import { LogOut, Settings, LayoutDashboard, GraduationCap, DollarSign, Briefcase, Users, Shield, Activity as ActivityIcon, UserCheck } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useLogout, useListTeamTasks, getListTeamTasksQueryKey } from '@workspace/api-client-react';
import { useEffect } from 'react';
import { toast } from 'sonner';

function useOverdueTasks(enabled: boolean) {
  const { data: tasks = [] } = useListTeamTasks(undefined, { query: { enabled, queryKey: getListTeamTasksQueryKey() } });
  const today = new Date().toISOString().slice(0, 10);
  return tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < today).length;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const isMaster = user?.role === 'MASTER';
  const canAccessTeam = isMaster || user?.role === 'COLLABORATOR';
  const overdueCount = useOverdueTasks(canAccessTeam);

  // Show a once-per-session toast for each authenticated user with overdue tasks.
  useEffect(() => {
    if (!user || overdueCount === 0) return;
    const key = `croas_overdue_alerted_${user.id}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      toast.warning(
        `${overdueCount} tarefa${overdueCount > 1 ? 's' : ''} em atraso`,
        { description: 'Acesse Equipe → Tarefas para ver os detalhes.' },
      );
    }
  }, [overdueCount, isMaster]);

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      setLocation('/login');
    } catch (err) {
      console.error('Failed to logout', err);
    }
  };

  if (!user) return <>{children}</>;

  if (user.role === 'CLIENT') {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="h-20 border-b border-border flex items-center justify-between px-8 shrink-0">
          <div className="font-serif text-xl tracking-wider text-primary">CROAS OS</div>
          <div className="flex items-center gap-4">
            <div className="text-right flex flex-col">
              <span className="text-sm font-medium leading-none">{user.name}</span>
              <span className="text-xs text-muted-foreground mt-1">Área do Cliente</span>
            </div>
            <button 
              onClick={handleLogout}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    );
  }

  // Sidebar links
  const links = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['MASTER'] },
    { path: '/alunos', label: 'Alunos', icon: GraduationCap, roles: ['MASTER'] },
    { path: '/financeiro', label: 'Financeiro', icon: DollarSign, roles: ['MASTER', 'COLLABORATOR'] },
    { path: '/financeiro/metas', label: 'Metas', icon: DollarSign, roles: ['MASTER', 'COLLABORATOR'] },
    { path: '/comercial', label: 'Comercial', icon: Briefcase, roles: ['MASTER'] },
    { path: '/equipe', label: 'Equipe', icon: UserCheck, roles: ['MASTER', 'COLLABORATOR'] },
    { path: '/users', label: 'Usuários', icon: Users, roles: ['MASTER'] },
    { path: '/permissions', label: 'Permissões', icon: Shield, roles: ['MASTER'] },
    { path: '/activity', label: 'Atividade', icon: ActivityIcon, roles: ['MASTER'] },
  ];

  const visibleLinks = links.filter(l => l.roles.includes(user.role));

  return (
    <div className="min-h-[100dvh] flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        <div className="h-20 flex items-center justify-center border-b border-border shrink-0">
           <Link href={isMaster ? '/dashboard' : '/equipe'} className="font-serif text-2xl tracking-widest text-primary hover:text-accent transition-colors">
            CROAS OS
          </Link>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
          {visibleLinks.map(link => {
            const Icon = link.icon;
            const isActive = location.startsWith(link.path);
            const badge = link.path === '/equipe' && overdueCount > 0 ? overdueCount : null;
            return (
              <Link 
                key={link.path} 
                href={link.path}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-all duration-300 border-l-2 ${
                  isActive 
                    ? 'border-primary text-primary bg-primary/5' 
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="font-medium tracking-wide flex-1">{link.label}</span>
                {badge !== null && (
                  <span className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold leading-none">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border bg-background/50 shrink-0">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary font-serif font-bold text-xs shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-medium truncate">{user.name}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{user.role}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link 
              href="/settings"
              className="flex-1 h-9 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground border border-border hover:border-primary hover:text-primary transition-colors"
            >
              <Settings className="w-3 h-3" />
              AJUSTES
            </Link>
            <button 
              onClick={handleLogout}
              className="h-9 w-9 flex items-center justify-center text-muted-foreground border border-border hover:border-destructive hover:text-destructive transition-colors shrink-0"
              title="Sair"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-[100dvh] overflow-y-auto relative bg-background">
        <div className="absolute inset-0 pointer-events-none opacity-[0.015] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
        <div className="p-8 max-w-7xl mx-auto min-h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
