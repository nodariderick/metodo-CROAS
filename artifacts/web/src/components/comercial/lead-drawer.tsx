import { useState, useRef, useEffect } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import { 
  useGetLead, 
  useUpdateLead, 
  useDeleteLead, 
  useListUsers,
  useMoveLeadStage,
  useListPlans,
  getGetLeadQueryKey,
  getListLeadsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMoney } from './lead-card';
import { format } from 'date-fns';
import { PlanSelectDialog } from './plan-select-dialog';
import { toast } from 'sonner';

const STAGES = [
  { id: 'lead', label: 'Lead' },
  { id: 'call_agendada', label: 'Call Agendada' },
  { id: 'call_realizada', label: 'Call Realizada' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'fechado', label: 'Fechado ✓' },
  { id: 'perdido', label: 'Perdido' }
] as const;

export function LeadDrawer({ leadId, open, onOpenChange }: { leadId: number, open: boolean, onOpenChange: (op: boolean) => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: lead, isLoading } = useGetLead(leadId, { query: { enabled: !!leadId, queryKey: ['/api/leads', leadId] } });
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const moveLead = useMoveLeadStage();
  const { data: users = [] } = useListUsers({ role: 'COLLABORATOR' });
  const masterUsers = useListUsers({ role: 'MASTER' }).data || [];
  const allUsers = [...users, ...masterUsers];

  const [pendingClose, setPendingClose] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    notes: '',
    nextFollowUpAt: '',
    proposalValue: '',
    assignedToId: 'none'
  });

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (lead && initializedForId.current !== leadId) {
      initializedForId.current = leadId;
      setFormData({
        email: lead.email || '',
        phone: lead.phone || '',
        notes: lead.notes || '',
        nextFollowUpAt: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 16) : '',
        proposalValue: lead.proposalValue ? (lead.proposalValue / 100).toString() : '',
        assignedToId: lead.assignedToId ? String(lead.assignedToId) : 'none'
      });
    }
  }, [lead, leadId]);

  const handleSave = () => {
    updateLead.mutate({
      id: leadId,
      data: {
        email: formData.email || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
        nextFollowUpAt: formData.nextFollowUpAt ? new Date(formData.nextFollowUpAt).toISOString() : null,
        proposalValue: formData.proposalValue ? Math.round(Number(formData.proposalValue) * 100) : null,
        assignedToId: formData.assignedToId !== 'none' ? Number(formData.assignedToId) : null,
      }
    }, {
      onSuccess: () => {
        toast.success('Lead atualizado com sucesso');
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      }
    });
  };

  const handleStageChange = (newStage: string) => {
    if (newStage === 'fechado') {
      setPendingClose(true);
      return;
    }
    
    moveLead.mutate({ id: leadId, data: { stage: newStage as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        toast.success(`Estágio alterado para ${STAGES.find(s => s.id === newStage)?.label}`);
      }
    });
  };

  const handleConfirmClose = (planId: number) => {
    moveLead.mutate({ id: leadId, data: { stage: 'fechado', planId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        setPendingClose(false);
        toast.success('Lead fechado e convertido em aluno!');
      }
    });
  };

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja deletar este lead? Esta ação não pode ser desfeita.')) {
      deleteLead.mutate({ id: leadId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          onOpenChange(false);
          toast.success('Lead deletado.');
        }
      });
    }
  };

  if (isLoading || !lead) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto bg-background border-l-border rounded-none sm:max-w-none">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-3xl text-primary">{lead.fullName}</SheetTitle>
            <SheetDescription className="flex items-center gap-2 mt-2">
              <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs uppercase font-mono tracking-wider">
                {STAGES.find(s => s.id === lead.stage)?.label || lead.stage}
              </span>
              <span className="bg-muted text-muted-foreground border border-border px-2 py-0.5 text-xs uppercase font-mono tracking-wider">
                {lead.origin}
              </span>
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            {/* Timeline visual */}
            <div className="flex justify-between items-center relative py-4">
              <div className="absolute left-0 right-0 h-0.5 bg-border top-1/2 -translate-y-1/2 z-0" />
              {STAGES.filter(s => s.id !== 'perdido').map((stage, i) => {
                const currentIdx = STAGES.findIndex(s => s.id === lead.stage);
                const isPast = i < currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <div key={stage.id} className="relative z-10 flex flex-col items-center gap-1 group">
                    <div className={`
                      w-4 h-4 rounded-full border-2 
                      ${isPast ? 'bg-primary border-primary' : isCurrent ? 'bg-background border-primary shadow-[0_0_8px_rgba(214,154,33,0.5)]' : 'bg-background border-border'}
                    `} title={stage.label} />
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Mover Lead</h3>
                <Select value={lead.stage} onValueChange={handleStageChange}>
                  <SelectTrigger className="w-[200px] rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {STAGES.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input 
                  value={formData.email} 
                  onChange={e => setFormData({ ...formData, email: e.target.value })} 
                  className="rounded-none bg-card" 
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input 
                  value={formData.phone} 
                  onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                  className="rounded-none bg-card" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor da Proposta (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.proposalValue} 
                    onChange={e => setFormData({ ...formData, proposalValue: e.target.value })} 
                    className="rounded-none bg-card font-mono" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Próximo Follow-up</Label>
                  <Input 
                    type="datetime-local" 
                    value={formData.nextFollowUpAt} 
                    onChange={e => setFormData({ ...formData, nextFollowUpAt: e.target.value })} 
                    className="rounded-none bg-card font-mono text-sm" 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={formData.assignedToId} onValueChange={v => setFormData({ ...formData, assignedToId: v })}>
                  <SelectTrigger className="rounded-none bg-card">
                    <SelectValue placeholder="Sem dono" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="none">Sem dono</SelectItem>
                    {allUsers.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Anotações</Label>
                <Textarea 
                  value={formData.notes} 
                  onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                  className="rounded-none bg-card min-h-[120px]" 
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} className="rounded-none">Salvar Alterações</Button>
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-4">
              <h3 className="font-semibold text-lg">Histórico</h3>
              <div className="text-sm space-y-2 text-muted-foreground">
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span>Criado em</span>
                  <span className="font-mono">{format(new Date(lead.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span>Último Contato</span>
                  <span className="font-mono">{lead.lastContactAt ? format(new Date(lead.lastContactAt), 'dd/MM/yyyy HH:mm') : 'N/A'}</span>
                </div>
              </div>
            </div>

            {user?.role === 'MASTER' && (
              <div className="pt-8 flex justify-end">
                <Button variant="destructive" variant-outline="true" onClick={handleDelete} className="rounded-none bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground">
                  Deletar Lead
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PlanSelectDialog 
        open={pendingClose} 
        onOpenChange={setPendingClose} 
        onConfirm={handleConfirmClose} 
      />
    </>
  );
}