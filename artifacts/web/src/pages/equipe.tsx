import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskBoard } from '@/components/equipe/task-board';
import { GoalsPanel } from '@/components/equipe/goals-panel';
import { PerformancePanel } from '@/components/equipe/performance-panel';
import { useListTeamTasks } from '@workspace/api-client-react';

export default function Equipe() {
  const [activeTab, setActiveTab] = useState('tarefas');

  const { data: tasks } = useListTeamTasks();
  const overdue = tasks?.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)).length ?? 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-serif text-primary mb-2">Equipe</h1>
        <p className="text-muted-foreground">Tarefas, metas e desempenho dos colaboradores.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-card border border-border w-fit shrink-0 mb-4 rounded-none">
          <TabsTrigger value="tarefas" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2">
            Tarefas
            {overdue > 0 && (
              <span className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                {overdue}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="metas" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            Metas
          </TabsTrigger>
          <TabsTrigger value="desempenho" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            Desempenho
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden relative">
          <TabsContent value="tarefas" className="h-full m-0 absolute inset-0 overflow-y-auto data-[state=inactive]:hidden">
            <TaskBoard />
          </TabsContent>
          <TabsContent value="metas" className="h-full m-0 absolute inset-0 overflow-y-auto data-[state=inactive]:hidden">
            <GoalsPanel />
          </TabsContent>
          <TabsContent value="desempenho" className="h-full m-0 absolute inset-0 overflow-y-auto data-[state=inactive]:hidden">
            <PerformancePanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
