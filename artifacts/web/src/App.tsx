import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';

import Login from '@/pages/login';
import RootRedirect from '@/pages/root-redirect';
import Dashboard from '@/pages/dashboard';
import Users from '@/pages/users';
import Permissions from '@/pages/permissions';
import Activity from '@/pages/activity';
import MeuPainel from '@/pages/meu-painel';
import Settings from '@/pages/settings';
import Alunos from '@/pages/alunos';
import AlunoDossier from '@/pages/aluno-dossier';
import Comercial from '@/pages/comercial';
import Equipe from '@/pages/equipe';
import Financeiro from '@/pages/financeiro';
import FinanceiroMetas from '@/pages/financeiro-metas';
import NotFound from '@/pages/not-found';
import { AuthGuard, RoleGuard } from '@/hooks/use-auth';
import { AppLayout } from '@/components/app-layout';
import { useEffect } from 'react';

const queryClient = new QueryClient();

function ProtectedRoutes() {
  return (
    <AuthGuard>
      <AppLayout>
        <Switch>
          <Route path="/dashboard">
            <RoleGuard allowedRoles={['MASTER']}><Dashboard /></RoleGuard>
          </Route>
          <Route path="/users">
            <RoleGuard allowedRoles={['MASTER']}><Users /></RoleGuard>
          </Route>
          <Route path="/permissions">
            <RoleGuard allowedRoles={['MASTER']}><Permissions /></RoleGuard>
          </Route>
          <Route path="/activity">
            <RoleGuard allowedRoles={['MASTER']}><Activity /></RoleGuard>
          </Route>
          <Route path="/meu-painel">
            <RoleGuard allowedRoles={['CLIENT']}><MeuPainel /></RoleGuard>
          </Route>
          <Route path="/settings" component={Settings} />
          
          <Route path="/alunos">
            <RoleGuard allowedRoles={['MASTER']}><Alunos /></RoleGuard>
          </Route>
          <Route path="/alunos/:id">
            <RoleGuard allowedRoles={['MASTER']}><AlunoDossier /></RoleGuard>
          </Route>
          <Route path="/financeiro/metas">
            <RoleGuard allowedRoles={['MASTER', 'COLLABORATOR']}><FinanceiroMetas /></RoleGuard>
          </Route>
          <Route path="/financeiro">
            <RoleGuard allowedRoles={['MASTER', 'COLLABORATOR']}><Financeiro /></RoleGuard>
          </Route>
          <Route path="/comercial">
            <RoleGuard allowedRoles={['MASTER']}><Comercial /></RoleGuard>
          </Route>
          <Route path="/equipe">
            <RoleGuard allowedRoles={['MASTER', 'COLLABORATOR']}><Equipe /></RoleGuard>
          </Route>
          
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </AuthGuard>
  );
}

function Router() {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={RootRedirect} />
        {/* All other routes are protected */}
        <Route component={ProtectedRoutes} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
        <SonnerToaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
