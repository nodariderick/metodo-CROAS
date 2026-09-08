import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useListPlans } from '@workspace/api-client-react';
import { formatMoney } from './lead-card';

export function PlanSelectDialog({ 
  open, 
  onOpenChange, 
  onConfirm 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onConfirm: (planId: number) => void;
}) {
  const { data: plans = [], isLoading } = useListPlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const handleConfirm = () => {
    if (selectedPlanId) {
      onConfirm(Number(selectedPlanId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none bg-background border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-primary">Fechar Lead</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Para mover este lead para "Fechado ✓" e convertê-lo em um aluno, selecione o plano que ele adquiriu:
          </p>
          
          {isLoading ? (
            <div className="text-sm font-mono text-muted-foreground">Carregando planos...</div>
          ) : (
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="rounded-none bg-card">
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {plans.map(plan => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.name} ({plan.stageCount} etapas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none">Cancelar</Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedPlanId} 
            className="rounded-none bg-primary text-primary-foreground"
          >
            Confirmar Fechamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
