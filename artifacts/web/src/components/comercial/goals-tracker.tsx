import { useState } from 'react';
import { 
  useGetCommercialGoal, 
  useSetCommercialGoal, 
  useListLeads,
  getGetCommercialGoalQueryKey 
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { formatMoney } from './lead-card';
import { ChevronLeft, ChevronRight, Edit2, TrendingUp, Target, DollarSign, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

export function GoalsTracker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  
  const { data: goal, isLoading } = useGetCommercialGoal(year, month);
  const setGoal = useSetCommercialGoal();
  
  // To calculate projected based on pipeline
  const { data: leads = [] } = useListLeads();
  const propostaLeads = leads.filter(l => l.stage === 'proposta');
  const projectedRevenue = propostaLeads.reduce((acc, lead) => acc + (lead.proposalValue || 0), 0) * 0.6; // 60% conversion assumed
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState({ targetDeals: '', targetRevenue: '' });

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  const handleOpenEdit = () => {
    setEditData({
      targetDeals: goal?.targetDeals ? String(goal.targetDeals) : '0',
      targetRevenue: goal?.targetRevenue ? (goal.targetRevenue / 100).toString() : '0'
    });
    setIsEditOpen(true);
  };

  const handleSaveGoal = () => {
    setGoal.mutate({
      year, 
      month, 
      data: {
        targetDeals: parseInt(editData.targetDeals, 10) || 0,
        targetRevenue: Math.round(parseFloat(editData.targetRevenue || '0') * 100)
      }
    }, {
      onSuccess: () => {
        toast.success('Metas atualizadas com sucesso');
        queryClient.invalidateQueries({ queryKey: getGetCommercialGoalQueryKey(year, month) });
        setIsEditOpen(false);
      }
    });
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  if (isLoading && !goal) {
    return <div className="p-8 text-center text-muted-foreground font-mono">Carregando metas...</div>;
  }

  const targetDeals = goal?.targetDeals || 0;
  const closedDeals = goal?.closedDeals || 0;
  const dealsProgress = targetDeals > 0 ? Math.min(100, Math.round((closedDeals / targetDeals) * 100)) : 0;

  const targetRevenue = goal?.targetRevenue || 0;
  const closedRevenue = goal?.closedRevenue || 0;
  const revenueProgress = targetRevenue > 0 ? Math.min(100, Math.round((closedRevenue / targetRevenue) * 100)) : 0;

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={handlePrevMonth} className="rounded-none border-border bg-card">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-serif text-2xl min-w-[200px] text-center">
            {monthNames[month - 1]} <span className="text-muted-foreground">{year}</span>
          </h2>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className="rounded-none border-border bg-card">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        {user?.role === 'MASTER' && (
          <Button onClick={handleOpenEdit} variant="outline" className="rounded-none border-primary text-primary hover:bg-primary/10">
            <Edit2 className="w-4 h-4 mr-2" /> Editar Metas
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deals Card */}
        <div className="bg-card border border-border p-6 flex flex-col">
          <div className="flex items-center gap-3 text-muted-foreground mb-6">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-semibold uppercase tracking-wider text-sm">Metas de Fechamentos</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Realizado</p>
              <p className="font-mono text-4xl text-foreground">{closedDeals}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Meta</p>
              <p className="font-mono text-4xl text-muted-foreground">{targetDeals}</p>
            </div>
          </div>
          
          <div className="mt-auto">
            <div className="flex justify-between text-xs font-mono mb-2">
              <span>Progresso</span>
              <span className="text-primary">{dealsProgress}%</span>
            </div>
            <Progress value={dealsProgress} className="h-2 rounded-none bg-background [&>div]:bg-primary" />
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-card border border-border p-6 flex flex-col">
          <div className="flex items-center gap-3 text-muted-foreground mb-6">
            <DollarSign className="w-5 h-5 text-primary" />
            <h3 className="font-semibold uppercase tracking-wider text-sm">Metas de Receita</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Realizado</p>
              <p className="font-mono text-2xl sm:text-3xl text-foreground">{formatMoney(closedRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Meta</p>
              <p className="font-mono text-2xl sm:text-3xl text-muted-foreground">{formatMoney(targetRevenue)}</p>
            </div>
          </div>
          
          <div className="mt-auto">
            <div className="flex justify-between text-xs font-mono mb-2">
              <span>Progresso</span>
              <span className="text-primary">{revenueProgress}%</span>
            </div>
            <Progress value={revenueProgress} className="h-2 rounded-none bg-background [&>div]:bg-primary" />
          </div>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 p-6 flex items-start gap-4">
        <TrendingUp className="w-6 h-6 text-primary shrink-0 mt-1" />
        <div>
          <h4 className="font-semibold text-primary mb-1">Projeção de Pipeline (Mês Atual)</h4>
          <p className="text-sm text-muted-foreground">
            Baseado nos {propostaLeads.length} leads atualmente em fase de "Proposta" e considerando uma conversão conservadora de 60%, 
            espera-se uma receita adicional de <strong className="font-mono text-foreground">{formatMoney(projectedRevenue)}</strong>.
          </p>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-none bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">Editar Metas</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Meta de Fechamentos (quantidade)</Label>
              <Input 
                type="number" 
                value={editData.targetDeals} 
                onChange={e => setEditData({ ...editData, targetDeals: e.target.value })}
                className="rounded-none bg-card font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Meta de Receita (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={editData.targetRevenue} 
                onChange={e => setEditData({ ...editData, targetRevenue: e.target.value })}
                className="rounded-none bg-card font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-none">Cancelar</Button>
            <Button onClick={handleSaveGoal} disabled={setGoal.isPending} className="rounded-none bg-primary text-primary-foreground">
              {setGoal.isPending ? 'Salvando...' : 'Salvar Metas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
