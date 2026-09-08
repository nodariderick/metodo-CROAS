import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';

export function useAuth() {
  const { data: user, isLoading, error } = useGetMe({ 
    query: {
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user
  };
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, error } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (error || !isAuthenticated)) {
      setLocation('/login');
    }
  }, [isLoading, isAuthenticated, error, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="font-serif text-primary tracking-widest text-sm uppercase">Autenticando</div>
        </div>
      </div>
    );
  }

  if (error || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export function RoleGuard({ 
  allowedRoles, 
  children 
}: { 
  allowedRoles: Array<'MASTER' | 'COLLABORATOR' | 'CLIENT'>;
  children: React.ReactNode 
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      setLocation('/dashboard');
    }
  }, [isLoading, user, allowedRoles, setLocation]);

  if (isLoading || !user || !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
