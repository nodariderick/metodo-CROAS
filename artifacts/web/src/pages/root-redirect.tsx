import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

export default function RootRedirect() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        setLocation('/login');
      } else {
        if (user.role === 'MASTER') {
          setLocation('/dashboard');
        } else if (user.role === 'COLLABORATOR') {
          setLocation('/equipe');
        } else if (user.role === 'CLIENT') {
          setLocation('/meu-painel');
        } else {
          setLocation('/login');
        }
      }
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
