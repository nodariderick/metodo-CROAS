import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/comercial/kanban-board';
import { FollowUpsList } from '@/components/comercial/follow-ups-list';
import { GoalsTracker } from '@/components/comercial/goals-tracker';
import { FunnelCharts } from '@/components/comercial/funnel-charts';
import { useListLeads } from '@workspace/api-client-react';

export default function Comercial() {
  const [activeTab, setActiveTab] = useState('pipeline');
  
  // Follow-ups today count for badge
  const { data: followUpsToday } = useListLeads({ followUpToday: true });
  const followUpsCount = followUpsToday?.length || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-serif text-primary mb-2">Comercial</h1>
        <p className="text-muted-foreground">Gestão de leads, metas e conversões.</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-card border border-border w-fit shrink-0 mb-4 rounded-none">
          <TabsTrigger value="pipeline" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="follow-ups" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2">
            Follow-ups Hoje
            {followUpsCount > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                {followUpsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="metas" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            Metas
          </TabsTrigger>
          <TabsTrigger value="funil" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            Funil
          </TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-hidden relative">
          <TabsContent value="pipeline" className="h-full m-0 absolute inset-0 overflow-hidden data-[state=inactive]:hidden">
            <KanbanBoard />
          </TabsContent>
          <TabsContent value="follow-ups" className="h-full m-0 absolute inset-0 overflow-y-auto data-[state=inactive]:hidden">
            <FollowUpsList />
          </TabsContent>
          <TabsContent value="metas" className="h-full m-0 absolute inset-0 overflow-y-auto data-[state=inactive]:hidden">
            <GoalsTracker />
          </TabsContent>
          <TabsContent value="funil" className="h-full m-0 absolute inset-0 overflow-y-auto data-[state=inactive]:hidden">
            <FunnelCharts />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
