import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateLead, useListUsers, getListLeadsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function LeadDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (op: boolean) => void }) {
  const queryClient = useQueryClient();
  const createLead = useCreateLead();
  const { data: users = [] } = useListUsers({ role: 'COLLABORATOR' });
  const masterUsers = useListUsers({ role: 'MASTER' }).data || [];
  const allUsers = [...users, ...masterUsers];

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    origin: 'instagram',
    stage: 'lead',
    assignedToId: 'none',
    proposalValue: '',
    nextFollowUpAt: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName) {
      toast.error('Nome é obrigatório');
      return;
    }

    createLead.mutate({
      data: {
        fullName: formData.fullName,
        email: formData.email || null,
        phone: formData.phone || null,
        origin: formData.origin as any,
        stage: formData.stage as any,
        assignedToId: formData.assignedToId !== 'none' ? Number(formData.assignedToId) : null,
        proposalValue: formData.proposalValue ? Math.round(Number(formData.proposalValue) * 100) : null,
        nextFollowUpAt: formData.nextFollowUpAt ? new Date(formData.nextFollowUpAt).toISOString() : null,
        notes: formData.notes || null,
      }
    }, {
      onSuccess: () => {
        toast.success('Lead criado com sucesso!');
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        onOpenChange(false);
        setFormData({
          fullName: '', email: '', phone: '', origin: 'instagram', stage: 'lead', assignedToId: 'none', proposalValue: '', nextFollowUpAt: '', notes: ''
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none bg-background border-border sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-primary">Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome Completo *</Label>
            <Input 
              value={formData.fullName} 
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
              className="rounded-none bg-card"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input 
                type="email"
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={formData.origin} onValueChange={v => setFormData({ ...formData, origin: v })}>
                <SelectTrigger className="rounded-none bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="parceria">Parceria</SelectItem>
                  <SelectItem value="palestra">Palestra</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estágio Inicial</Label>
              <Select value={formData.stage} onValueChange={v => setFormData({ ...formData, stage: v })}>
                <SelectTrigger className="rounded-none bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="call_agendada">Call Agendada</SelectItem>
                  <SelectItem value="call_realizada">Call Realizada</SelectItem>
                  <SelectItem value="proposta">Proposta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Proposto (R$)</Label>
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
            <Label>Anotações Iniciais</Label>
            <Textarea 
              value={formData.notes} 
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="rounded-none bg-card min-h-[80px]"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-none">Cancelar</Button>
            <Button type="submit" disabled={createLead.isPending} className="rounded-none bg-primary text-primary-foreground">
              {createLead.isPending ? 'Criando...' : 'Criar Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}