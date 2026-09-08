import { useState, useEffect } from "react";
import { formatMoney, formatPercent } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { 
  useGetRevenueGoal,
  useSetRevenueGoal,
  getGetRevenueGoalQueryKey
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Edit2, Target } from "lucide-react";
import { Link } from "wouter";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function FinanceiroMetas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  
  const { data: goal, isLoading } = useGetRevenueGoal(parseInt(year));
  const setGoal = useSetRevenueGoal();

  // Edit State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [annualTarget, setAnnualTarget] = useState("");
  const [monthlyTargets, setMonthlyTargets] = useState<string[]>(Array(12).fill("0"));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (goal && isEditOpen) {
      setAnnualTarget(String((goal.annualTarget || 0) / 100));
      const mt = goal.monthlyTargets?.length === 12 ? goal.monthlyTargets : Array(12).fill(0);
      setMonthlyTargets(mt.map(m => String(m / 100)));
      setNotes(goal.notes || "");
    } else if (!goal && isEditOpen) {
      setAnnualTarget("0");
      setMonthlyTargets(Array(12).fill("0"));
      setNotes("");
    }
  }, [goal, isEditOpen]);

  const handleSave = async () => {
    try {
      const annCents = Math.round(parseFloat(annualTarget.replace(',', '.')) * 100) || 0;
      const monCents = monthlyTargets.map(m => Math.round(parseFloat(m.replace(',', '.')) * 100) || 0);
      
      await setGoal.mutateAsync({
        year: parseInt(year),
        data: {
          annualTarget: annCents,
          monthlyTargets: monCents,
          notes
        }
      });
      queryClient.invalidateQueries({ queryKey: getGetRevenueGoalQueryKey(parseInt(year)) });
      setIsEditOpen(false);
      toast.success("Metas atualizadas.");
    } catch (e) {
      toast.error("Erro ao salvar metas.");
    }
  };

  const chartData = MONTHS.map((m, i) => ({
    name: m.slice(0, 3),
    Meta: (goal?.monthlyTargets?.[i] || 0) / 100,
    Realizado: (goal?.monthlyActuals?.[i] || 0) / 100,
  }));

  const annualTargetVal = goal?.annualTarget || 0;
  const annualActualVal = goal?.annualActual || 0;
  const projYearEnd = goal?.projectedYearEnd || 0;
  const pctRealized = annualTargetVal > 0 ? annualActualVal / annualTargetVal : 0;

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/financeiro">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-serif text-primary tracking-wide flex items-center gap-3">
          <Target className="w-8 h-8 text-primary/80" />
          Metas de Receita
        </h1>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-4">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[120px] border-border bg-card font-mono text-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {user?.role === 'MASTER' && (
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-accent">
                <Edit2 className="w-4 h-4 mr-2" /> Editar Meta
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="font-serif">Editar Metas {year}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2 py-4 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-primary">Meta Anual (R$)</label>
                  <Input value={annualTarget} onChange={e => setAnnualTarget(e.target.value)} className="border-border text-lg font-mono" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {MONTHS.map((m, i) => (
                    <div key={m} className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">{m}</label>
                      <Input 
                        value={monthlyTargets[i]} 
                        onChange={e => {
                          const newT = [...monthlyTargets];
                          newT[i] = e.target.value;
                          setMonthlyTargets(newT);
                        }} 
                        className="border-border font-mono text-sm" 
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-sm font-medium">Observações</label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} className="border-border" />
                </div>
              </div>
              <div className="pt-4 border-t border-border flex justify-end">
                <Button onClick={handleSave} disabled={setGoal.isPending} className="bg-primary text-primary-foreground hover:bg-accent w-full">
                  Salvar Metas
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">Carregando metas...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-card border border-border p-6 flex flex-col gap-2 relative overflow-hidden">
              <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Meta Anual</span>
              <span className="text-4xl font-mono text-foreground">{formatMoney(annualTargetVal)}</span>
            </div>
            <div className="bg-card border border-primary/30 p-6 flex flex-col gap-2 relative overflow-hidden shadow-[inset_0_0_20px_rgba(214,154,33,0.05)]">
              <span className="text-sm text-primary uppercase tracking-wider font-medium">Realizado Anual</span>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-mono text-primary">{formatMoney(annualActualVal)}</span>
                <span className="text-sm text-primary/80 font-mono">
                  {formatPercent(pctRealized * 100)}
                </span>
              </div>
              <div className="h-1.5 w-full bg-background rounded-full overflow-hidden mt-2">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pctRealized * 100, 100)}%` }} />
              </div>
            </div>
            <div className="bg-card border border-border p-6 flex flex-col gap-2 relative overflow-hidden">
              <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Projeção de Fechamento</span>
              <span className="text-4xl font-mono text-foreground">{formatMoney(projYearEnd)}</span>
            </div>
          </div>

          <div className="bg-card border border-border p-6 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222019" vertical={false} />
                <XAxis dataKey="name" stroke="#8A7F6E" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#8A7F6E" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                <Tooltip 
                  cursor={{ fill: '#222019', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#131110', borderColor: '#222019', color: '#F3ECDD', fontFamily: 'IBM Plex Mono' }}
                />
                <Legend />
                <Bar dataKey="Realizado" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={40} />
                <Line type="monotone" dataKey="Meta" stroke="#D69A21" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#D69A21', strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Mês</TableHead>
                  <TableHead>Meta (R$)</TableHead>
                  <TableHead>Realizado (R$)</TableHead>
                  <TableHead>Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MONTHS.map((m, i) => {
                  const target = goal?.monthlyTargets?.[i] || 0;
                  const actual = goal?.monthlyActuals?.[i] || 0;
                  const pct = target > 0 ? (actual / target) * 100 : 0;
                  
                  let colorClass = "text-muted-foreground";
                  if (target > 0) {
                    if (pct >= 100) colorClass = "text-emerald-500";
                    else if (pct >= 80) colorClass = "text-primary";
                    else colorClass = "text-rose-500";
                  }

                  return (
                    <TableRow key={m} className="border-border">
                      <TableCell className="font-medium text-foreground">{m}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{formatMoney(target)}</TableCell>
                      <TableCell className="font-mono">{formatMoney(actual)}</TableCell>
                      <TableCell className={`font-mono ${colorClass}`}>
                        {target > 0 ? formatPercent(pct) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
