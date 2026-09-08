import { useListUsers, useUpdateUser, useGetUsersSummary, getListUsersQueryKey, getGetUsersSummaryQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Users() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const { data: summary } = useGetUsersSummary();
  const updateUser = useUpdateUser();

  const handleRoleChange = async (userId: number, newRole: 'MASTER' | 'COLLABORATOR' | 'CLIENT') => {
    try {
      await updateUser.mutateAsync({ id: userId, data: { role: newRole } });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetUsersSummaryQueryKey() });
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusToggle = async (userId: number, currentStatus: boolean) => {
    try {
      await updateUser.mutateAsync({ id: userId, data: { isActive: !currentStatus } });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Usuários</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm uppercase">Gerenciamento de Acesso</p>
        </div>
        
        {summary && (
          <div className="flex gap-6 border border-border bg-card px-6 py-3 font-mono text-xs">
            <div className="flex flex-col">
              <span className="text-muted-foreground">TOTAL</span>
              <span className="text-primary text-lg">{summary.total}</span>
            </div>
            <div className="w-px bg-border"></div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">MASTERS</span>
              <span className="text-foreground">{summary.masters}</span>
            </div>
            <div className="w-px bg-border"></div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">COLAB</span>
              <span className="text-foreground">{summary.collaborators}</span>
            </div>
            <div className="w-px bg-border"></div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">CLIENTES</span>
              <span className="text-foreground">{summary.clients}</span>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[800px] border border-border bg-card">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border font-mono tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Usuário</th>
                <th className="px-6 py-4 font-medium">Cargo</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Último Login</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-mono text-xs text-primary uppercase">Carregando dados</span>
                    </div>
                  </td>
                </tr>
              ) : users?.map((u, i) => (
                <tr 
                  key={u.id} 
                  className="border-b border-border last:border-0 hover:bg-background/30 transition-colors animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationFillMode: 'both', animationDelay: `${i * 30}ms` }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 border border-border bg-background flex items-center justify-center text-primary font-serif font-bold text-xs shrink-0">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                          u.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                      disabled={updateUser.isPending}
                      className="bg-background border border-border text-foreground px-2 py-1.5 text-xs font-mono uppercase focus:border-primary outline-none hover:border-primary/50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <option value="MASTER">Master</option>
                      <option value="COLLABORATOR">Colaborador</option>
                      <option value="CLIENT">Cliente</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-primary' : 'bg-muted-foreground'}`}></div>
                      <span className={`font-mono text-[10px] tracking-widest ${u.isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                        {u.isActive ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                    {u.lastLoginAt ? format(new Date(u.lastLoginAt), "dd/MM/yyyy HH:mm") : 'Nunca'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleStatusToggle(u.id, u.isActive ?? true)}
                      disabled={updateUser.isPending}
                      className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {u.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
