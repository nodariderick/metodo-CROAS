import { useState } from 'react';
import { useListTeamTasks, useCreateTeamTask, useUpdateTeamTask, useDeleteTeamTask, useListUsers } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

const STATUS_LABELS: Record<string, string> = {
  pending: 'A Fazer',
  in_progress: 'Em Andamento',
  done: 'Concluído',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'border-border text-muted-foreground',
  in_progress: 'border-primary/40 text-primary',
  done: 'border-green-700/40 text-green-500',
};

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

function isOverdue(dueDate: string | null | undefined, status: string) {
  if (!dueDate || status === 'done') return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

export function TaskBoard() {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const { data: tasks = [], refetch } = useListTeamTasks();
  // Only MASTER needs the full collaborator list (for the create-task form)
  const { data: collaborators = [] } = useListUsers(
    { role: 'COLLABORATOR' },
    { query: { enabled: isMaster, queryKey: ['/api/users', 'COLLABORATOR'] } },
  );
  const createTask = useCreateTeamTask();
  const updateTask = useUpdateTeamTask();
  const deleteTask = useDeleteTeamTask();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assignedToId: '', dueDate: '', notes: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');

  const statuses: Array<'pending' | 'in_progress' | 'done'> = ['pending', 'in_progress', 'done'];

  const handleCreate = async () => {
    if (!form.title.trim() || !form.assignedToId) {
      toast.error('Título e responsável são obrigatórios');
      return;
    }
    try {
      await createTask.mutateAsync({ data: {
        title: form.title.trim(),
        description: form.description || undefined,
        assignedToId: Number(form.assignedToId),
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
      }});
      toast.success('Tarefa criada');
      setForm({ title: '', description: '', assignedToId: '', dueDate: '', notes: '' });
      setShowForm(false);
      refetch();
    } catch { toast.error('Erro ao criar tarefa'); }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateTask.mutateAsync({ id, data: { status: status as any } });
      refetch();
    } catch { toast.error('Erro ao atualizar status'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTask.mutateAsync({ id });
      toast.success('Tarefa removida');
      refetch();
    } catch { toast.error('Erro ao remover tarefa'); }
  };

  return (
    <div className="space-y-6 pb-8">
      {isMaster && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors"
          >
            + Nova Tarefa
          </button>
        </div>
      )}

      {showForm && isMaster && (
        <div className="border border-border bg-card p-5 space-y-4">
          <h3 className="font-serif text-lg text-foreground">Nova Tarefa</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Título *</label>
              <input
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Título da tarefa"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Responsável *</label>
              <select
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
                value={form.assignedToId}
                onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
              >
                <option value="">Selecionar...</option>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Prazo</label>
              <input
                type="date"
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Descrição</label>
              <textarea
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:border-primary outline-none resize-none"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhes da tarefa"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
              Criar Tarefa
            </button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-3 gap-4">
        {statuses.map((status) => {
          const colTasks = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="space-y-3">
              <div className={`flex items-center gap-2 pb-2 border-b ${status === 'done' ? 'border-green-700/30' : status === 'in_progress' ? 'border-primary/30' : 'border-border'}`}>
                <span className={`text-xs font-mono font-semibold uppercase tracking-wider ${STATUS_COLORS[status].split(' ')[1]}`}>
                  {STATUS_LABELS[status]}
                </span>
                <span className="text-xs font-mono text-muted-foreground bg-card border border-border px-1.5">
                  {colTasks.length}
                </span>
              </div>
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  className={`border bg-card p-4 space-y-2 ${isOverdue(task.dueDate, task.status) ? 'border-destructive/50' : 'border-border'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-foreground leading-snug">{task.title}</span>
                    {isMaster && (
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 text-xs"
                        title="Remover"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground truncate">
                      {task.assignedToName ?? `#${task.assignedToId}`}
                    </span>
                    {task.dueDate && (
                      <span className={`text-[10px] font-mono ${isOverdue(task.dueDate, task.status) ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                        {isOverdue(task.dueDate, task.status) ? 'ATRASADA ' : ''}{fmtDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                  <select
                    className="w-full bg-background border border-border px-2 py-1 text-[11px] text-muted-foreground focus:border-primary outline-none mt-1"
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              ))}
              {colTasks.length === 0 && (
                <div className="border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground/50">
                  Sem tarefas
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
