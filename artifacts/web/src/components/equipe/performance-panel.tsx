import { useState } from 'react';
import { useGetTeamPerformance } from '@workspace/api-client-react';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function ProgressBar({ value, max, colorClass }: { value: number; max: number; colorClass?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 bg-border w-full rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${colorClass ?? 'bg-primary'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function PerformancePanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: perf, isLoading, error } = useGetTeamPerformance({ year, month });

  return (
    <div className="space-y-6 pb-8">
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

      {isLoading && (
        <div className="text-muted-foreground text-sm font-mono animate-pulse">Carregando...</div>
      )}

      {error && (
        <div className="text-destructive text-sm">Erro ao carregar dados de desempenho.</div>
      )}

      {perf && (perf.collaborators ?? []).length === 0 && (
        <div className="border border-dashed border-border py-16 text-center text-muted-foreground">
          Nenhum colaborador cadastrado.
        </div>
      )}

      {perf && (perf.collaborators ?? []).length > 0 && (
        <div className="grid gap-4">
          {(perf.collaborators ?? []).map((c, idx) => {
            const completedTotal = c.completedTotal ?? 0;
            const completedOnTime = c.completedOnTime ?? 0;
            const monthTasksDue = c.monthTasksDue ?? 0;
            const overdueCount = c.overdueCount ?? 0;
            const goalTargetTasks = c.goalTargetTasks ?? null;

            const goalPct = goalTargetTasks !== null && goalTargetTasks > 0
              ? Math.min(100, Math.round((completedTotal / goalTargetTasks) * 100))
              : null;
            const onTimePct = monthTasksDue > 0
              ? Math.round((completedOnTime / monthTasksDue) * 100)
              : null;

            return (
              <div key={c.userId ?? idx} className="border border-border bg-card p-6 space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-serif text-lg text-foreground">{c.name ?? `Usuário #${c.userId}`}</div>
                    <div className="flex gap-4 mt-1 text-xs font-mono text-muted-foreground">
                      <span>{c.totalTasks ?? 0} tarefas totais</span>
                      <span>
                        {overdueCount > 0
                          ? <span className="text-destructive">{overdueCount} atrasadas</span>
                          : <span className="text-green-500">0 atrasadas</span>
                        }
                      </span>
                    </div>
                  </div>
                  {c.goalHit !== null && c.goalHit !== undefined && (
                    <div className={`text-xs font-mono px-2 py-1 border ${c.goalHit ? 'border-green-700/50 text-green-500 bg-green-900/10' : 'border-border text-muted-foreground'}`}>
                      {c.goalHit ? 'META ATINGIDA' : 'EM PROGRESSO'}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tarefas concluídas</span>
                      <span className="font-mono text-foreground">
                        {completedTotal}
                        {goalTargetTasks !== null && <span className="text-muted-foreground"> / {goalTargetTasks}</span>}
                      </span>
                    </div>
                    <ProgressBar
                      value={completedTotal}
                      max={goalTargetTasks ?? Math.max(monthTasksDue, 1)}
                      colorClass={c.goalHit ? 'bg-green-600' : 'bg-primary'}
                    />
                    {goalPct !== null && (
                      <div className="text-[10px] font-mono text-muted-foreground text-right">{goalPct}% da meta</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">No prazo (mês)</span>
                      <span className="font-mono text-foreground">
                        {completedOnTime} / {monthTasksDue}
                      </span>
                    </div>
                    <ProgressBar
                      value={completedOnTime}
                      max={Math.max(monthTasksDue, 1)}
                      colorClass="bg-primary/70"
                    />
                    {onTimePct !== null && (
                      <div className="text-[10px] font-mono text-muted-foreground text-right">{onTimePct}% no prazo</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
