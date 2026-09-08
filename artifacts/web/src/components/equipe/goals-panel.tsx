import { useState } from 'react';
import { useListTeamGoals, useUpsertTeamGoal, useDeleteTeamGoal, useListUsers } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtMonth(m: number) { return MONTHS[m - 1] ?? String(m); }

export function GoalsPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const { data: goals = [], refetch } = useListTeamGoals();
  // Only MASTER can fetch all users; collaborators don't need the full list (they see their own goals)
  const { data: collaborators = [] } = useListUsers(
    { role: 'COLLABORATOR' },
    { query: { enabled: isMaster, queryKey: ['/api/users', 'COLLABORATOR'] } },
  );
  const upsert = useUpsertTeamGoal();
  const deleteGoal = useDeleteTeamGoal();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: '', targetTasks: '', notes: '' });

  const filteredGoals = goals.filter((g) => g.year === year && g.month === month);

  const handleUpsert = async () => {
    if (!form.userId || !form.targetTasks) { toast.error('Preencha todos os campos obrigatórios'); return; }
    try {
      await upsert.mutateAsync({ data: {
        userId: Number(form.userId),
        year,
        month,
        targetTasks: Number(form.targetTasks),
        notes: form.notes || null,
      }});
      toast.success('Meta salva');
      setForm({ userId: '', targetTasks: '', notes: '' });
      setShowForm(false);
      refetch();
    } catch { toast.error('Erro ao salvar meta'); }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <select
            className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <input
            type="number"
            className="bg-card border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none w-24"
            value={year}
            min={2020}
            max={2100}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        {isMaster && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="ml-auto px-4 py-2 text-sm border border-primary text-primary hover:bg-primary/10 transition-colors"
          >
            + Definir Meta
          </button>
        )}
      </div>

      {showForm && (
        <div className="border border-border bg-card p-5 space-y-4">
          <h3 className="font-serif text-lg text-foreground">Meta — {fmtMonth(month)}/{year}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Colaborador *</label>
              <select
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
              >
                <option value="">Selecionar...</option>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Meta de Tarefas *</label>
              <input
                type="number"
                min={0}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
                value={form.targetTasks}
                onChange={(e) => setForm({ ...form, targetTasks: e.target.value })}
                placeholder="Ex: 8"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Observação</label>
              <input
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleUpsert} className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors">
              Salvar Meta
            </button>
          </div>
        </div>
      )}

      {filteredGoals.length === 0 ? (
        <div className="border border-dashed border-border py-16 text-center text-muted-foreground">
          Nenhuma meta definida para {fmtMonth(month)}/{year}.
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredGoals.map((goal) => {
            const collaborator = collaborators.find((c) => c.id === goal.userId);
            return (
              <div key={goal.id} className="border border-border bg-card p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-foreground">{collaborator?.name ?? `Usuário #${goal.userId}`}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Meta: <span className="font-mono text-primary font-semibold">{goal.targetTasks}</span> tarefas
                  </div>
                  {goal.notes && <div className="text-xs text-muted-foreground mt-1">{goal.notes}</div>}
                </div>
                {isMaster && (
                  <button
                    onClick={async () => {
                      try {
                        await deleteGoal.mutateAsync({ id: goal.id });
                        toast.success('Meta removida');
                        refetch();
                      } catch { toast.error('Erro ao remover meta'); }
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
