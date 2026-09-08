import { useState } from "react";
import { formatMoney, formatPercent } from "@/lib/format";
import { useGetComparatives, useGetRevenueGoal } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function getChangePct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 1 : 0;
  return (current - previous) / previous;
}

function MetricCard({ title, current, previous, inverseColors = false }: { title: string, current: number, previous: number, inverseColors?: boolean }) {
  const pct = getChangePct(current, previous);
  const isPositive = pct > 0;
  const isNeutral = pct === 0;
  
  // For expenses, going down is good (positive meaning), going up is bad.
  const isGood = inverseColors ? !isPositive : isPositive;

  return (
    <div className="bg-card border border-border p-6 flex flex-col gap-3">
      <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">{title}</span>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-mono text-foreground">{formatMoney(current)}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {isNeutral ? (
          <span className="text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3"/> 0%</span>
        ) : (
          <span className={`flex items-center gap-1 font-medium ${isGood ? 'text-emerald-500' : 'text-rose-500'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(pct * 100).toFixed(1)}%
          </span>
        )}
        <span className="text-muted-foreground text-xs">vs {formatMoney(previous)}</span>
      </div>
    </div>
  );
}

export function ComparativosTab() {
  const currentYearStr = String(new Date().getFullYear());
  const currentMonthStr = String(new Date().getMonth() + 1);
  
  const [year, setYear] = useState(currentYearStr);
  const [month, setMonth] = useState(currentMonthStr);
  
  const { data: comp, isLoading } = useGetComparatives({ year: parseInt(year), month: parseInt(month) });
  const { data: goal } = useGetRevenueGoal(parseInt(year));

  const chartData = comp ? [
    {
      name: "Mês Anterior",
      Receita: comp.previousMonth.revenue / 100,
      Despesa: comp.previousMonth.expense / 100,
      Resultado: comp.previousMonth.net / 100,
    },
    {
      name: "Mês Atual",
      Receita: comp.currentMonth.revenue / 100,
      Despesa: comp.currentMonth.expense / 100,
      Resultado: comp.currentMonth.net / 100,
    },
    {
      name: "Mesmo Mês Ano Ant.",
      Receita: comp.sameMonthLastYear.revenue / 100,
      Despesa: comp.sameMonthLastYear.expense / 100,
      Resultado: comp.sameMonthLastYear.net / 100,
    }
  ] : [];

  const ytdData = comp ? [
    {
      name: "YTD Anterior",
      Receita: comp.previousYtd.revenue / 100,
      Despesa: comp.previousYtd.expense / 100,
      Resultado: comp.previousYtd.net / 100,
    },
    {
      name: "YTD Atual",
      Receita: comp.currentYtd.revenue / 100,
      Despesa: comp.currentYtd.expense / 100,
      Resultado: comp.currentYtd.net / 100,
    }
  ] : [];

  const ytdRevenue = comp?.currentYtd.revenue || 0;
  const annualGoal = goal?.annualTarget || 0;
  const goalProgress = annualGoal > 0 ? ytdRevenue / annualGoal : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif text-foreground">Comparativos</h2>
        <div className="flex items-center gap-4">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[120px] border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <SelectItem key={m} value={String(m)}>{m.toString().padStart(2, '0')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px] border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[parseInt(currentYearStr) - 1, parseInt(currentYearStr), parseInt(currentYearStr) + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">Carregando comparativos...</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard 
              title="Receita (Mês)" 
              current={comp?.currentMonth.revenue || 0} 
              previous={comp?.previousMonth.revenue || 0} 
            />
            <MetricCard 
              title="Despesa (Mês)" 
              current={comp?.currentMonth.expense || 0} 
              previous={comp?.previousMonth.expense || 0} 
              inverseColors={true}
            />
            <MetricCard 
              title="Resultado (Mês)" 
              current={comp?.currentMonth.net || 0} 
              previous={comp?.previousMonth.net || 0} 
            />
            <div className="bg-card border border-border p-6 flex flex-col gap-3">
              <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Receita YTD vs Meta</span>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-mono text-primary">{formatMoney(ytdRevenue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground text-xs">Meta: {formatMoney(annualGoal)}</span>
                <span className="font-medium text-primary">{formatPercent(goalProgress * 100)}</span>
              </div>
              <div className="h-1.5 w-full bg-background rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(goalProgress * 100, 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[2fr_1fr] gap-6">
            <div className="bg-card border border-border p-6 flex flex-col gap-6">
              <h3 className="font-serif text-lg text-foreground">Análise Mensal</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222019" vertical={false} />
                    <XAxis dataKey="name" stroke="#8A7F6E" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#8A7F6E" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                    <Tooltip 
                      cursor={{ fill: '#222019', opacity: 0.4 }}
                      contentStyle={{ backgroundColor: '#131110', borderColor: '#222019', color: '#F3ECDD', fontFamily: 'IBM Plex Mono' }}
                    />
                    <Legend />
                    <Bar dataKey="Receita" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Despesa" fill="#f43f5e" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Resultado" fill="#D69A21" radius={[2, 2, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border p-6 flex flex-col gap-6">
              <h3 className="font-serif text-lg text-foreground">Evolução YTD</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ytdData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222019" vertical={false} />
                    <XAxis dataKey="name" stroke="#8A7F6E" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#222019', opacity: 0.4 }}
                      contentStyle={{ backgroundColor: '#131110', borderColor: '#222019', color: '#F3ECDD', fontFamily: 'IBM Plex Mono' }}
                    />
                    <Legend />
                    <Bar dataKey="Receita" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Despesa" fill="#f43f5e" radius={[2, 2, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
