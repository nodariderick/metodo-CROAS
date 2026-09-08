import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead } from '@workspace/api-client-react';
import { format, isToday, isPast } from 'date-fns';
import { Clock } from 'lucide-react';

const originColors = {
  instagram: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  indicacao: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  parceria: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  palestra: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  outro: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
} as const;

const originLabels = {
  instagram: 'Instagram',
  indicacao: 'Indicação',
  parceria: 'Parceria',
  palestra: 'Palestra',
  outro: 'Outro'
} as const;

export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function LeadCard({ lead, onClick }: { lead: Lead; onClick?: () => void }) {
  const nextFollowUp = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
  const needsFollowUp = nextFollowUp && (isToday(nextFollowUp) || isPast(nextFollowUp));

  return (
    <div 
      onClick={onClick}
      className={`
        bg-card border p-4 cursor-pointer hover:border-primary/50 transition-colors
        ${needsFollowUp ? 'border-l-4 border-l-primary' : 'border-border'}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-sm truncate pr-2">{lead.fullName}</h4>
        {lead.origin && (
          <span className={`text-[10px] px-1.5 py-0.5 uppercase tracking-wider font-mono border ${originColors[lead.origin as keyof typeof originColors] || originColors.outro}`}>
            {originLabels[lead.origin as keyof typeof originLabels] || lead.origin}
          </span>
        )}
      </div>
      
      <div className="flex flex-col gap-1.5 mt-4">
        {lead.proposalValue != null && lead.proposalValue > 0 && (
          <div className="text-sm font-mono text-primary">
            {formatMoney(lead.proposalValue)}
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
          {lead.assignedToName ? (
            <span className="truncate max-w-[120px]">{lead.assignedToName}</span>
          ) : (
            <span>Sem dono</span>
          )}
          
          {nextFollowUp && (
            <div className={`flex items-center gap-1 font-mono ${needsFollowUp ? 'text-destructive' : ''}`}>
              <Clock className="w-3 h-3" />
              {format(nextFollowUp, 'dd/MM')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SortableLeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} onClick={onClick} />
    </div>
  );
}
