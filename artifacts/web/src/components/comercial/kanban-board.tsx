import { useState, useMemo } from 'react';
import { 
  useListLeads, 
  useMoveLeadStage, 
  getListLeadsQueryKey 
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  DndContext, 
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Column } from './column';
import { LeadCard } from './lead-card';
import { LeadDrawer } from './lead-drawer';
import { LeadDialog } from './lead-dialog';
import { PlanSelectDialog } from './plan-select-dialog';

const COLUMNS = [
  { id: 'lead', title: 'Lead' },
  { id: 'call_agendada', title: 'Call Agendada' },
  { id: 'call_realizada', title: 'Call Realizada' },
  { id: 'proposta', title: 'Proposta' },
  { id: 'fechado', title: 'Fechado ✓' },
  { id: 'perdido', title: 'Perdido' }
] as const;

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('all');
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  
  // Modals/Drawers
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  
  // Plan select dialog
  const [pendingClose, setPendingClose] = useState<{leadId: number} | null>(null);

  const { data: leads = [], isLoading } = useListLeads();
  const moveLead = useMoveLeadStage();

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = lead.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesOrigin = originFilter === 'all' || lead.origin === originFilter;
      return matchesSearch && matchesOrigin;
    });
  }, [leads, searchTerm, originFilter]);

  const activeLead = useMemo(
    () => leads.find(l => l.id === activeLeadId),
    [activeLeadId, leads]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveLeadId(Number(active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLeadId(null);
    const { active, over } = event;
    
    if (!over) return;
    
    const leadId = Number(active.id);
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // determine column from over.id
    // over.id could be a column id or another card's id
    const overId = String(over.id);
    let newStage = overId as any;
    
    if (!COLUMNS.find(c => c.id === overId)) {
      // it was dropped on another card
      const overLead = leads.find(l => String(l.id) === overId);
      if (overLead) {
        newStage = overLead.stage;
      } else {
        return; // shouldn't happen
      }
    }
    
    if (lead.stage === newStage) return;

    if (newStage === 'fechado') {
      setPendingClose({ leadId });
      return;
    }

    // Optimistic update
    queryClient.setQueryData(getListLeadsQueryKey(), (old: any) => {
      if (!old) return old;
      return old.map((l: any) => l.id === leadId ? { ...l, stage: newStage } : l);
    });

    moveLead.mutate(
      { id: leadId, data: { stage: newStage } },
      {
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        }
      }
    );
  }

  function handleConfirmClose(planId: number) {
    if (!pendingClose) return;
    
    moveLead.mutate(
      { id: pendingClose.leadId, data: { stage: 'fechado', planId } },
      {
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          setPendingClose(null);
        }
      }
    );
  }

  if (isLoading) {
    return <div className="h-full flex items-center justify-center text-muted-foreground font-mono">Carregando pipeline...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 mb-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[300px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lead..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card rounded-none"
            />
          </div>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-[180px] bg-card rounded-none">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="indicacao">Indicação</SelectItem>
              <SelectItem value="parceria">Parceria</SelectItem>
              <SelectItem value="palestra">Palestra</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsNewLeadOpen(true)} className="bg-primary hover:bg-accent text-primary-foreground font-medium rounded-none">
          <Plus className="w-4 h-4 mr-2" /> Novo Lead
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 flex gap-4 min-h-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {COLUMNS.map(col => (
            <Column 
              key={col.id} 
              column={col} 
              leads={filteredLeads.filter(l => l.stage === col.id)} 
              onCardClick={setSelectedLeadId}
            />
          ))}
          <DragOverlay>
            {activeLead ? (
              <div className="rotate-3 opacity-90 scale-105 cursor-grabbing shadow-xl">
                <LeadCard lead={activeLead} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <LeadDialog open={isNewLeadOpen} onOpenChange={setIsNewLeadOpen} />
      {selectedLeadId && (
        <LeadDrawer 
          leadId={selectedLeadId} 
          open={!!selectedLeadId} 
          onOpenChange={(op) => !op && setSelectedLeadId(null)} 
        />
      )}
      <PlanSelectDialog 
        open={!!pendingClose} 
        onOpenChange={(op) => !op && setPendingClose(null)}
        onConfirm={handleConfirmClose}
      />
    </div>
  );
}
