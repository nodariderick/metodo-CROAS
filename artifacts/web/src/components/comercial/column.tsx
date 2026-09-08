import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Lead } from '@workspace/api-client-react';
import { SortableLeadCard } from './lead-card';

interface ColumnProps {
  column: { id: string; title: string };
  leads: Lead[];
  onCardClick: (id: number) => void;
}

export function Column({ column, leads, onCardClick }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const isFechado = column.id === 'fechado';
  const isPerdido = column.id === 'perdido';

  return (
    <div className="flex flex-col w-[320px] shrink-0 h-full max-h-full">
      <div className={`
        flex items-center justify-between p-3 mb-3 border-b-2 bg-card
        ${isFechado ? 'border-b-green-600/50' : isPerdido ? 'border-b-destructive/50' : 'border-b-primary'}
      `}>
        <h3 className={`font-serif text-lg tracking-wide ${isFechado ? 'text-green-500' : isPerdido ? 'text-destructive' : 'text-foreground'}`}>
          {column.title}
        </h3>
        <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-0.5 border border-border">
          {leads.length}
        </span>
      </div>
      
      <div 
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-1 space-y-3 pb-8 min-h-[150px] bg-background/30 rounded border border-border/50"
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <SortableLeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead.id)} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground/50 uppercase tracking-widest font-mono">
            Vazio
          </div>
        )}
      </div>
    </div>
  );
}
