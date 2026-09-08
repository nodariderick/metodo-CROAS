import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGetCashFlow } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";

export function FluxoCaixaTab() {
  const [months, setMonths] = useState("3");
  const { data: cashFlow, isLoading } = useGetCashFlow({ months: parseInt(months) });

  const chartData = cashFlow?.entries.map(e => ({
    date: format(parseISO(e.date), 'dd/MMM'),
    realized: e.type === 'realized' ? e.net / 100 : null,
    projected: e.type === 'projected' ? e.net / 100 : null,
    raw: e
  })) || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif text-foreground">Fluxo de Caixa</h2>
        <Select value={months} onValueChange={setMonths}>
          <SelectTrigger className="w-[180px] border-border bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 mês à frente</SelectItem>
            <SelectItem value="3">3 meses à frente</SelectItem>
            <SelectItem value="6">6 meses à frente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border p-6 flex flex-col gap-2">
          <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Realizado</span>
          <span className="text-3xl font-mono text-foreground">{formatMoney(cashFlow?.totalRealized || 0)}</span>
        </div>
        <div className="bg-card border border-border p-6 flex flex-col gap-2">
          <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Projetado</span>
          <span className="text-3xl font-mono text-muted-foreground">{formatMoney(cashFlow?.totalProjected || 0)}</span>
        </div>
        <div className="bg-card border border-border p-6 flex flex-col gap-2">
          <span className="text-sm text-primary uppercase tracking-wider font-medium">Saldo Estimado</span>
          <span className="text-3xl font-mono text-primary">{formatMoney(cashFlow?.runningBalance || 0)}</span>
        </div>
      </div>

      <div className="bg-card border border-border p-6 h-[400px]">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">Carregando gráfico...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D69A21" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#D69A21" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8A7F6E" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8A7F6E" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222019" vertical={false} />
              <XAxis dataKey="date" stroke="#8A7F6E" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#8A7F6E" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#131110', borderColor: '#222019', color: '#F3ECDD', fontFamily: 'IBM Plex Mono' }}
                itemStyle={{ color: '#D69A21' }}
              />
              <Area type="monotone" dataKey="realized" stroke="#D69A21" strokeWidth={2} fillOpacity={1} fill="url(#colorRealized)" />
              <Area type="monotone" dataKey="projected" stroke="#8A7F6E" strokeDasharray="5 5" strokeWidth={2} fillOpacity={1} fill="url(#colorProjected)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Data</TableHead>
              <TableHead>Receita</TableHead>
              <TableHead>Despesa</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>
            ) : cashFlow?.entries.length === 0 ? (
               <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem movimentações no período</TableCell></TableRow>
            ) : (
              cashFlow?.entries.map((entry, idx) => (
                <TableRow key={idx} className="border-border">
                  <TableCell className="font-mono text-sm">{format(parseISO(entry.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="font-mono text-emerald-500">{formatMoney(entry.revenue)}</TableCell>
                  <TableCell className="font-mono text-rose-500">{formatMoney(entry.expense)}</TableCell>
                  <TableCell className={`font-mono ${entry.net >= 0 ? 'text-primary' : 'text-rose-500'}`}>
                    {entry.net > 0 ? '+' : ''}{formatMoney(entry.net)}
                  </TableCell>
                  <TableCell>
                    {entry.type === 'realized' ? (
                      <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted">Realizado</Badge>
                    ) : (
                      <Badge variant="outline" className="border-border text-muted-foreground border-dashed">Projetado</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
