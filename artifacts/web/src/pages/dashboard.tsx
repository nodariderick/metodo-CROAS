import { Link } from 'wouter';
import { useGetDashboard360, useGetCapacitySettings, useSetCapacitySettings } from '@workspace/api-client-react';
import { useState } from 'react';
import { toast } from 'sonner';

function fmt(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

function Pct({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground font-mono text-xs">—</span>;
  const color = value >= 100 ? 'text-green-500' : value >= 70 ? 'text-primary' : 'text-yellow-500';
  return <span className={`font-mono text-sm font-bold ${color}`}>{value}%</span>;
}

function MiniBar({ pct, colorClass }: { pct: number; colorClass?: string }) {
  return (
    <div className="h-1 w-full bg-border rounded-full overflow-hidden mt-2">
      <div
        className={`h-full rounded-full transition-all duration-700 ${colorClass ?? 'bg-primary'}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function KpiCard({
  title,
  href,
  children,
  accent,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <Link href={href}>
      <div className={`border bg-card p-5 hover:border-primary/40 transition-colors cursor-pointer group relative overflow-hidden ${accent ?? 'border-border'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">{title}</div>
        {children}
        <div className="absolute bottom-3 right-3 text-[10px] font-mono text-muted-foreground/40 group-hover:text-primary/40 transition-colors">VER MAIS &rarr;</div>
      </div>
    </Link>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  call_agendada: 'Call Agendada',
  call_realizada: 'Call Realizada',
  proposta: 'Proposta',
  fechado: 'Fechado',
  perdido: 'Perdido',
};

function CapacityWidget() {
  const { data: cap, refetch } = useGetCapacitySettings();
  const setCap = useSetCapacitySettings();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  const save = async () => {
    const n = Number(val);
    if (!n || n < 1) { toast.error('Valor inválido'); return; }
    try {
      await setCap.mutateAsync({ data: { weeklySessionCapacity: n } });
      toast.success('Capacidade atualizada');
      setEditing(false);
      refetch();
    } catch { toast.error('Erro ao salvar'); }
  };

  return (
    <div className="flex items-center justify-between mt-2 gap-2">
      <span className="text-xs text-muted-foreground">Capacidade semanal</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="number"
            className="w-16 bg-background border border-primary px-1.5 py-0.5 text-xs font-mono text-foreground outline-none"
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
          <button onClick={save} className="text-[10px] text-primary hover:text-accent">OK</button>
          <button onClick={() => setEditing(false)} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.preventDefault(); setVal(String(cap?.weeklySessionCapacity ?? 20)); setEditing(true); }}
          className="text-xs font-mono text-primary hover:underline"
        >
          {cap?.weeklySessionCapacity ?? 20} sessões/sem
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: dash, isLoading, error, dataUpdatedAt } = useGetDashboard360({
    query: { refetchInterval: 60_000, queryKey: ['/api/dashboard/360'] },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-700">
        <header className="mb-10">
          <h1 className="font-serif text-4xl text-foreground">Dashboard 360</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">OVERVIEW & STATUS</p>
        </header>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-border bg-card p-5 h-40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !dash) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-10">
          <h1 className="font-serif text-4xl text-foreground">Dashboard 360</h1>
        </header>
        <div className="text-destructive text-sm border border-destructive/30 bg-card p-6">
          Erro ao carregar o painel. Tente recarregar a página.
        </div>
      </div>
    );
  }

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Safe destructuring with fallbacks for all optional fields from generated schema
  const caixa = dash.caixa ?? {};
  const receita = dash.receita ?? {};
  const alunos = dash.alunos ?? {};
  const comercial = dash.comercial ?? {};
  const capacidade = dash.capacidade ?? {};
  const equipe = dash.equipe ?? {};

  const monthBalance = caixa.monthBalance ?? 0;
  const monthRevenue = caixa.monthRevenue ?? 0;
  const monthExpense = caixa.monthExpense ?? 0;
  const projectedInflow30d = caixa.projectedInflow30d ?? 0;

  const receitaMonthRevenue = receita.monthRevenue ?? 0;
  const receitaMonthGoal = receita.monthGoal ?? 0;
  const revenueGoalPct = receita.revenueGoalPct ?? null;
  const ytdRevenue = receita.ytdRevenue ?? 0;
  const annualGoal = receita.annualGoal ?? 0;
  const annualGoalPct = receita.annualGoalPct ?? null;

  const activeCount = alunos.activeCount ?? 0;
  const atRisk = alunos.atRisk ?? 0;
  const planEndingSoon = alunos.planEndingSoon ?? 0;

  const leadsPerStage = (comercial.leadsPerStage ?? []);
  const monthClosings = comercial.monthClosings ?? 0;
  const closingGoal = comercial.closingGoal ?? null;

  const sessionsThisWeek = capacidade.sessionsThisWeek ?? 0;
  const maxCapacity = capacidade.maxCapacity ?? 20;
  const utilizationPct = capacidade.utilizationPct ?? 0;

  const pendingTasks = equipe.pendingTasks ?? 0;
  const overdueTasks = equipe.overdueTasks ?? 0;
  const collaborators = equipe.collaborators ?? [];

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Dashboard 360</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">
            VISÃO GERAL — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </p>
        </div>
        {updatedAt && (
          <span className="text-[10px] font-mono text-muted-foreground/50">Atualizado às {updatedAt}</span>
        )}
      </header>

      <div className="grid grid-cols-3 gap-4 flex-1">
        {/* ─── CAIXA ─── */}
        <KpiCard title="Caixa" href="/financeiro">
          <div className="space-y-2">
            <div className="text-2xl font-serif font-bold text-foreground">{fmt(monthBalance)}</div>
            <div className="text-[10px] font-mono text-muted-foreground">SALDO DO MÊS</div>
            <div className="border-t border-border/50 pt-2 space-y-1">
              <StatRow label="Receita realizada" value={<span className="text-green-500">{fmt(monthRevenue)}</span>} />
              <StatRow label="Despesas" value={<span className="text-destructive/80">{fmt(monthExpense)}</span>} />
              <StatRow label="Projeção +30 dias" value={fmt(projectedInflow30d)} />
            </div>
          </div>
        </KpiCard>

        {/* ─── RECEITA ─── */}
        <KpiCard title="Receita vs. Meta" href="/financeiro/metas">
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <Pct value={revenueGoalPct} />
              <span className="text-xs text-muted-foreground">da meta mensal</span>
            </div>
            <MiniBar
              pct={revenueGoalPct ?? 0}
              colorClass={(revenueGoalPct ?? 0) >= 100 ? 'bg-green-600' : 'bg-primary'}
            />
            <div className="border-t border-border/50 pt-2 space-y-1">
              <StatRow label="Mês atual" value={fmt(receitaMonthRevenue)} />
              <StatRow label="Meta mensal" value={fmt(receitaMonthGoal)} />
              <StatRow
                label="YTD / Meta anual"
                value={
                  <span>
                    {fmt(ytdRevenue)}
                    {annualGoalPct !== null && (
                      <span className="text-muted-foreground ml-1 text-xs">({annualGoalPct}%)</span>
                    )}
                  </span>
                }
              />
            </div>
          </div>
        </KpiCard>

        {/* ─── ALUNOS ─── */}
        <KpiCard title="Alunos" href="/alunos">
          <div className="space-y-3">
            <div className="text-3xl font-serif font-bold text-foreground">{activeCount}</div>
            <div className="text-[10px] font-mono text-muted-foreground">ALUNOS ATIVOS</div>
            <div className="border-t border-border/50 pt-2 space-y-1">
              <StatRow
                label="Em risco (trilha atrasada)"
                value={<span className={atRisk > 0 ? 'text-yellow-500' : 'text-green-500'}>{atRisk}</span>}
              />
              <StatRow
                label="Plano expira em 30 dias"
                value={<span className={planEndingSoon > 0 ? 'text-yellow-500' : 'text-muted-foreground'}>{planEndingSoon}</span>}
              />
            </div>
          </div>
        </KpiCard>

        {/* ─── COMERCIAL ─── */}
        <KpiCard title="Comercial" href="/comercial">
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-bold text-foreground">{monthClosings}</span>
              {closingGoal !== null && (
                <span className="text-xs text-muted-foreground">/ {closingGoal} fechamentos</span>
              )}
            </div>
            {closingGoal !== null && closingGoal > 0 && (
              <MiniBar
                pct={Math.round((monthClosings / closingGoal) * 100)}
                colorClass={monthClosings >= closingGoal ? 'bg-green-600' : 'bg-primary'}
              />
            )}
            <div className="border-t border-border/50 pt-2 space-y-1">
              {leadsPerStage
                .filter((s) => s.stage !== 'perdido' && (s.count ?? 0) > 0)
                .map((s, i) => (
                  <StatRow
                    key={s.stage ?? i}
                    label={s.stage ? (STAGE_LABELS[s.stage] ?? s.stage) : '—'}
                    value={s.count ?? 0}
                  />
                ))}
            </div>
          </div>
        </KpiCard>

        {/* ─── CAPACIDADE ─── */}
        {/* Not wrapped in KpiCard/Link because it contains an inline editor; link added separately */}
        <Link href="/equipe">
          <div className="border border-border bg-card p-5 hover:border-primary/40 transition-colors cursor-pointer group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Capacidade</div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif font-bold text-foreground">{sessionsThisWeek}</span>
                <span className="text-xs text-muted-foreground">sessões esta semana</span>
              </div>
              <MiniBar
                pct={utilizationPct}
                colorClass={utilizationPct >= 90 ? 'bg-destructive' : utilizationPct >= 70 ? 'bg-yellow-500' : 'bg-primary'}
              />
              <div className="text-[10px] font-mono text-right text-muted-foreground">{utilizationPct}% utilizado</div>
              {/* stopPropagation prevents the inline editor clicks from navigating away */}
              <div onClick={(e) => e.preventDefault()}>
                <CapacityWidget />
              </div>
            </div>
            <div className="absolute bottom-3 right-3 text-[10px] font-mono text-muted-foreground/40 group-hover:text-primary/40 transition-colors">VER MAIS &rarr;</div>
          </div>
        </Link>

        {/* ─── EQUIPE ─── */}
        <KpiCard title="Equipe" href="/equipe">
          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <span className={`text-2xl font-serif font-bold ${overdueTasks > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {overdueTasks}
              </span>
              <span className="text-xs text-muted-foreground">tarefas atrasadas</span>
            </div>
            <div className="border-t border-border/50 pt-2 space-y-1">
              <StatRow label="Tarefas pendentes" value={pendingTasks} />
              {collaborators.map((c, i) => (
                <div key={c.userId ?? i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{c.name ?? `#${c.userId}`}</span>
                  <span className="font-mono text-foreground">
                    {c.pendingTasks ?? 0} pend.
                    {(c.overdueTasks ?? 0) > 0 && (
                      <span className="text-destructive ml-1">/ {c.overdueTasks} atr.</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </KpiCard>
      </div>
    </div>
  );
}
