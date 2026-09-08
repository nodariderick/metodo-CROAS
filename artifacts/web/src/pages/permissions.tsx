import { useGetPermissionsMatrix, useSetPermission, getGetPermissionsMatrixQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, PenLine, Minus } from 'lucide-react';
import { useMemo } from 'react';

const MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'finance', label: 'Financeiro' },
  { id: 'students', label: 'Alunos' },
  { id: 'files', label: 'Arquivos' },
  { id: 'commercial', label: 'Comercial' },
  { id: 'team', label: 'Equipe' },
  { id: 'calendar', label: 'Agenda' }
] as const;

export default function Permissions() {
  const queryClient = useQueryClient();
  const { data: matrix, isLoading } = useGetPermissionsMatrix();
  const setPermission = useSetPermission();

  // Group by user
  const groupedData = useMemo(() => {
    if (!matrix) return [];
    
    const usersMap = new Map<number, { id: number; name: string; permissions: Record<string, 'NONE' | 'READ' | 'WRITE'> }>();
    
    matrix.forEach(entry => {
      if (!usersMap.has(entry.userId)) {
        usersMap.set(entry.userId, { 
          id: entry.userId, 
          name: entry.userName || `User #${entry.userId}`,
          permissions: {} 
        });
      }
      usersMap.get(entry.userId)!.permissions[entry.module] = entry.level;
    });

    return Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [matrix]);

  const handleToggle = async (userId: number, module: any, currentLevel: 'NONE' | 'READ' | 'WRITE') => {
    const nextLevel = 
      currentLevel === 'NONE' ? 'READ' : 
      currentLevel === 'READ' ? 'WRITE' : 
      'NONE';

    try {
      // Optimistic update logic could go here, but invalidate is safer
      await setPermission.mutateAsync({ 
        userId, 
        module, 
        data: { level: nextLevel } 
      });
      queryClient.invalidateQueries({ queryKey: getGetPermissionsMatrixQueryKey() });
    } catch (err) {
      console.error(err);
    }
  };

  const renderIcon = (level?: 'NONE' | 'READ' | 'WRITE', isPending?: boolean) => {
    if (isPending) return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>;
    if (level === 'WRITE') return <PenLine className="w-4 h-4 text-primary" />;
    if (level === 'READ') return <Eye className="w-4 h-4 text-primary" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <header className="mb-10">
        <h1 className="font-serif text-4xl text-foreground">Permissões</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm uppercase">Matriz de Acesso</p>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full border border-border bg-card">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border font-mono tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-medium border-r border-border bg-background/90 backdrop-blur sticky left-0 z-20">Colaborador</th>
                {MODULES.map(mod => (
                  <th key={mod.id} className="px-4 py-4 font-medium text-center">
                    <div className="transform rotate-180 h-32 text-[10px] mx-auto opacity-70 hover:opacity-100 transition-opacity cursor-default [writing-mode:vertical-rl]">
                      {mod.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={MODULES.length + 1} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-mono text-xs text-primary uppercase">Carregando matriz</span>
                    </div>
                  </td>
                </tr>
              ) : groupedData.length === 0 ? (
                <tr>
                  <td colSpan={MODULES.length + 1} className="px-6 py-12 text-center text-muted-foreground font-mono text-xs">
                    Nenhum colaborador encontrado.
                  </td>
                </tr>
              ) : (
                groupedData.map((user, i) => (
                  <tr 
                    key={user.id} 
                    className="border-b border-border last:border-0 hover:bg-background/30 transition-colors animate-in fade-in"
                    style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'both' }}
                  >
                    <td className="px-6 py-4 border-r border-border font-medium bg-card sticky left-0 z-10">
                      {user.name}
                    </td>
                    {MODULES.map(mod => {
                      const level = user.permissions[mod.id] || 'NONE';
                      const isPending = setPermission.isPending && 
                        setPermission.variables?.userId === user.id && 
                        setPermission.variables?.module === mod.id;
                      
                      return (
                        <td key={mod.id} className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleToggle(user.id, mod.id, level)}
                            disabled={isPending}
                            className={`w-10 h-10 mx-auto rounded flex items-center justify-center border transition-all ${
                              level !== 'NONE' 
                                ? 'border-primary/30 bg-primary/5 hover:bg-primary/10' 
                                : 'border-transparent hover:border-border hover:bg-background'
                            }`}
                            title={`Nível atual: ${level}. Clique para alterar.`}
                          >
                            {renderIcon(level, isPending)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-6 flex items-center justify-end gap-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <div className="flex items-center gap-2"><Minus className="w-3 h-3" /> Sem Acesso</div>
        <div className="flex items-center gap-2"><Eye className="w-3 h-3 text-primary" /> Leitura</div>
        <div className="flex items-center gap-2"><PenLine className="w-3 h-3 text-primary" /> Escrita</div>
      </div>
    </div>
  );
}
