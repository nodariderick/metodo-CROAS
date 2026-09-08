import { useState } from "react";
import { formatMoney, formatPercent } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { 
  useGetDre, 
  useListFinancialCategories,
  useCreateFinancialCategory,
  useDeleteFinancialCategory,
  getListFinancialCategoriesQueryKey
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Plus, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function DreTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(currentMonth));
  const [view, setView] = useState<"monthly" | "ytd">("monthly");
  
  const { data: dre, isLoading } = useGetDre({ 
    year: parseInt(year), 
    month: parseInt(month), 
    view 
  });

  // Categorias Mgmt
  const { data: categories } = useListFinancialCategories();
  const createCat = useCreateFinancialCategory();
  const deleteCat = useDeleteFinancialCategory();
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState("expense");
  const [newCatColor, setNewCatColor] = useState("#8A7F6E");

  const handleCreateCategory = async () => {
    if (!newCatName) return;
    try {
      await createCat.mutateAsync({
        data: { name: newCatName, type: newCatType as any, color: newCatColor }
      });
      queryClient.invalidateQueries({ queryKey: getListFinancialCategoriesQueryKey() });
      setNewCatName("");
      toast.success("Categoria criada.");
    } catch (e) {
      toast.error("Falha ao criar categoria.");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await deleteCat.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListFinancialCategoriesQueryKey() });
      toast.success("Categoria excluída.");
    } catch (e) {
      toast.error("Erro ao excluir categoria.");
    }
  };

  const sortedRevenue = [...(dre?.revenueLines || [])].sort((a, b) => b.amount - a.amount);
  const sortedExpense = [...(dre?.expenseLines || [])].sort((a, b) => b.amount - a.amount);

  const chartData = [
    {
      name: "Resultado",
      Receita: (dre?.totalRevenue || 0) / 100,
      Despesa: (dre?.totalExpense || 0) / 100,
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif text-foreground">DRE — Demonstrativo de Resultados</h2>
        <div className="flex items-center gap-4">
          <Select value={view} onValueChange={(v: any) => setView(v)}>
            <SelectTrigger className="w-[120px] border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="ytd">YTD (Acumulado)</SelectItem>
            </SelectContent>
          </Select>

          {view === 'monthly' && (
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
          )}

          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px] border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {user?.role === 'MASTER' && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-border">
                  <Settings className="w-4 h-4 mr-2" /> Categorias
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle className="font-serif">Gerenciar Categorias</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-2 py-4 flex flex-col gap-6">
                  <div className="flex flex-col gap-4 p-4 border border-border bg-background">
                    <h3 className="text-sm font-medium">Nova Categoria</h3>
                    <div className="grid grid-cols-[1fr_80px] gap-2">
                      <Input placeholder="Nome" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="border-border" />
                      <Input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="border-border p-1 h-10 w-full" />
                    </div>
                    <Select value={newCatType} onValueChange={setNewCatType}>
                      <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Receita</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleCreateCategory} disabled={createCat.isPending} className="bg-primary text-primary-foreground hover:bg-accent">
                      <Plus className="w-4 h-4 mr-2" /> Adicionar
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Receitas</h3>
                    {categories?.filter(c => c.type === 'revenue').map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 border border-border bg-background">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || '#ccc' }} />
                          <span className="text-sm">{c.name}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(c.id)} className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Despesas</h3>
                    {categories?.filter(c => c.type === 'expense').map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 border border-border bg-background">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || '#ccc' }} />
                          <span className="text-sm">{c.name}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(c.id)} className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">Carregando DRE...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border p-6 flex flex-col gap-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Receita Total</span>
              <span className="text-3xl font-mono text-emerald-500">{formatMoney(dre?.totalRevenue || 0)}</span>
            </div>
            <div className="bg-card border border-border p-6 flex flex-col gap-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
              <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Despesa Total</span>
              <span className="text-3xl font-mono text-rose-500">{formatMoney(dre?.totalExpense || 0)}</span>
            </div>
            <div className="bg-card border border-border p-6 flex flex-col gap-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
              <span className="text-sm text-primary uppercase tracking-wider font-medium">Margem Bruta</span>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-mono text-primary">{formatMoney(dre?.grossMargin || 0)}</span>
                <span className="text-sm text-primary/80 font-mono bg-primary/10 px-2 py-0.5 rounded">
                  {formatPercent(dre?.marginPercent || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border border-border p-6 flex flex-col gap-6">
              <h3 className="font-serif text-lg text-emerald-500 border-b border-border pb-4">Receitas por Categoria</h3>
              <div className="flex flex-col gap-4">
                {sortedRevenue.length === 0 && <span className="text-muted-foreground text-sm">Nenhuma receita no período.</span>}
                {sortedRevenue.map(line => {
                  const pct = dre?.totalRevenue ? (line.amount / dre.totalRevenue) * 100 : 0;
                  return (
                    <div key={line.categoryId} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: line.categoryColor || '#10b981' }} />
                          <span>{line.categoryName}</span>
                        </div>
                        <span className="font-mono">{formatMoney(line.amount)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: line.categoryColor || '#10b981' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-card border border-border p-6 flex flex-col gap-6">
              <h3 className="font-serif text-lg text-rose-500 border-b border-border pb-4">Despesas por Categoria</h3>
              <div className="flex flex-col gap-4">
                {sortedExpense.length === 0 && <span className="text-muted-foreground text-sm">Nenhuma despesa no período.</span>}
                {sortedExpense.map(line => {
                  const pct = dre?.totalExpense ? (line.amount / dre.totalExpense) * 100 : 0;
                  return (
                    <div key={line.categoryId} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: line.categoryColor || '#f43f5e' }} />
                          <span>{line.categoryName}</span>
                        </div>
                        <span className="font-mono">{formatMoney(line.amount)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: line.categoryColor || '#f43f5e' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border p-6 h-[300px]">
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
                <Bar dataKey="Receita" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={60} />
                <Bar dataKey="Despesa" fill="#f43f5e" radius={[2, 2, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
