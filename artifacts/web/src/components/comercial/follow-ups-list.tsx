import { useState } from 'react';
import { useListLeads, useUpdateLead, getListLeadsQueryKey, Lead } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';

const originLabels = {
  instagram: 'Instagram',
  indicacao: 'Indicação',
  parceria: 'Parceria',
  palestra: 'Palestra',
  outro: 'Outro'
} as const;

const stageLabels = {
  lead: 'Lead',
  call_agendada: 'Call Agendada',
  call_realizada: 'Call Realizada',
  proposta: 'Proposta',
  fechado: 'Fechado',
  perdido: 'Perdido'
} as const;

export function FollowUpsList() {
  const queryClient = useQueryClient();
  const { data: leads = [], isLoading } = useListLeads({ followUpToday: true });
  const updateLead = useUpdateLead();
  
  const [registeringContactFor, setRegisteringContactFor] = useState<Lead | null>(null);
  const [notes, setNotes] = useState('');
  const [nextDate, setNextDate] = useState('');

  // Sort earliest first
  const sortedLeads = [...leads].sort((a, b) => {
    if (!a.nextFollowUpAt) return 1;
    if (!b.nextFollowUpAt) return -1;
    return new Date(a.nextFollowUpAt).getTime() - new Date(b.nextFollowUpAt).getTime();
  });

  const handleOpenRegister = (lead: Lead) => {
    setRegisteringContactFor(lead);
    setNotes(lead.notes || '');
    // default next date to tomorrow same time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNextDate(tomorrow.toISOString().slice(0, 16));
  };

  const handleSaveContact = () => {
    if (!registeringContactFor) return;
    
    updateLead.mutate({
      id: registeringContactFor.id,
      data: {
        lastContactAt: new Date().toISOString(),
        notes: notes,
        nextFollowUpAt: nextDate ? new Date(nextDate).toISOString() : null
      }
    }, {
      onSuccess: () => {
        toast.success('Contato registrado com sucesso');
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        setRegisteringContactFor(null);
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground font-mono">Carregando follow-ups...</div>;
  }

  if (sortedLeads.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center border border-dashed border-border/50 bg-card/30 min-h-[300px]">
        <Clock className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="font-serif text-xl text-foreground">Tudo em dia!</h3>
        <p className="text-muted-foreground mt-2">Nenhum follow-up pendente para hoje.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {sortedLeads.map(lead => (
        <div key={lead.id} className="bg-card border border-border p-4 flex items-start gap-4">
          <div className="w-24 shrink-0 flex flex-col items-center justify-center bg-background border border-border py-2 text-primary font-mono text-sm">
            <span>{lead.nextFollowUpAt ? format(new Date(lead.nextFollowUpAt), 'HH:mm') : '--:--'}</span>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg truncate">{lead.fullName}</h3>
              <span className="text-[10px] px-1.5 py-0.5 uppercase tracking-wider font-mono border border-border bg-background">
                {stageLabels[lead.stage as keyof typeof stageLabels] || lead.stage}
              </span>
              {lead.origin && (
                <span className="text-[10px] px-1.5 py-0.5 uppercase tracking-wider font-mono border border-border text-muted-foreground">
                  {originLabels[lead.origin as keyof typeof originLabels] || lead.origin}
                </span>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground line-clamp-2 max-w-3xl mb-3 flex items-start gap-2">
              <FileText className="w-4 h-4 shrink-0 mt-0.5 opacity-50" />
              <span>{lead.notes || 'Sem anotações.'}</span>
            </div>
            
            <div className="flex items-center gap-4">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="text-xs font-mono flex items-center gap-1.5 text-primary hover:underline">
                  <Phone className="w-3 h-3" />
                  {lead.phone}
                </a>
              )}
            </div>
          </div>
          
          <div className="shrink-0">
            <Button onClick={() => handleOpenRegister(lead)} className="rounded-none bg-secondary text-secondary-foreground hover:bg-primary/20 hover:text-primary transition-colors">
              Registrar Contato
            </Button>
          </div>
        </div>
      ))}

      <Dialog open={!!registeringContactFor} onOpenChange={(op) => !op && setRegisteringContactFor(null)}>
        <DialogContent className="rounded-none bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">Registrar Contato</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-sm">
              Lead: <strong className="text-foreground">{registeringContactFor?.fullName}</strong>
            </div>
            
            <div className="space-y-2">
              <Label>Anotações (Atualize se necessário)</Label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                className="min-h-[120px] rounded-none bg-card"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Próximo Follow-up</Label>
              <Input 
                type="datetime-local" 
                value={nextDate} 
                onChange={(e) => setNextDate(e.target.value)} 
                className="rounded-none bg-card font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisteringContactFor(null)} className="rounded-none">Cancelar</Button>
            <Button onClick={handleSaveContact} disabled={updateLead.isPending} className="rounded-none bg-primary text-primary-foreground">
              {updateLead.isPending ? 'Salvando...' : 'Salvar e Reagendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
