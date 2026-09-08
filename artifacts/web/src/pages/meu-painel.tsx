import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircle2, Clock, Calendar, FileText, AlertCircle, FileIcon,
  Download, Activity as ActivityIcon, ChevronRight
} from 'lucide-react';
import { 
  useGetMyPortal,
  getGetMyPortalQueryKey
} from '@workspace/api-client-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function MeuPainel() {
  const { data: portal, isLoading } = useGetMyPortal({
    query: { queryKey: getGetMyPortalQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="text-primary font-serif tracking-widest text-sm uppercase">Carregando seu painel</div>
      </div>
    );
  }

  if (!portal || !portal.student) {
    return (
      <div className="text-center p-12 bg-card border border-border rounded-lg max-w-2xl mx-auto mt-12 shadow-2xl shadow-primary/5">
        <h2 className="text-2xl font-serif text-primary mb-2">Painel Indisponível</h2>
        <p className="text-muted-foreground">Você ainda não possui um plano de mentoria ativo vinculado a este perfil.</p>
      </div>
    );
  }

  const { student, stages, sessions, tasks, forms, files } = portal;

  const openTasks = tasks.filter(t => !t.completedAt);
  const nextSession = student.nextSessionAt ? new Date(student.nextSessionAt) : null;

  // Process Radar Chart Data (Only latest)
  let chartData: any[] = [];
  const anamneseForms = forms.filter(f => f.formType === 'anamnese' && f.areaScores);
  if (anamneseForms.length > 0) {
    const latest = [...anamneseForms].sort((a, b) => new Date(b.respondedAt).getTime() - new Date(a.respondedAt).getTime())[0];
    try {
      const scores = JSON.parse(latest.areaScores!);
      const areas = ['saude', 'carreira', 'financas', 'relacionamentos', 'familia', 'espiritualidade', 'lazer', 'desenvolvimento', 'contribuicao'];
      const labels: Record<string, string> = {
        saude: 'Saúde', carreira: 'Carreira', financas: 'Finanças', relacionamentos: 'Relacionamentos',
        familia: 'Família', espiritualidade: 'Espiritualidade', lazer: 'Lazer', desenvolvimento: 'Desenvolvimento', contribuicao: 'Contribuição'
      };
      chartData = areas.map(area => ({
        subject: labels[area],
        value: scores[area] || 0,
      }));
    } catch (e) {
      console.error('Failed to parse area scores', e);
    }
  }

  const completedStages = stages.filter(s => s.status === 'complete').length;
  const progressPercent = Math.round((completedStages / Math.max(stages.length, 1)) * 100);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="pb-6 border-b border-border">
        <h1 className="text-4xl font-serif text-primary tracking-wide mb-2">Meu Painel</h1>
        <p className="text-xl text-foreground font-light">Olá, {student.fullName.split(' ')[0]}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border shadow-none">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ActivityIcon className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">{progressPercent}%</Badge>
            </div>
            <div className="text-2xl font-serif mb-1">Etapa {student.currentStageIndex}</div>
            <div className="text-sm text-muted-foreground">De {student.totalStages} no total</div>
            <Progress value={progressPercent} className="h-1 mt-4 opacity-50" />
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border shadow-none">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <div className="text-2xl font-serif mb-1 text-blue-400">
              {nextSession ? format(nextSession, 'dd/MM') : '--/--'}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              Próxima sessão
              {nextSession && <span className="font-mono text-xs opacity-70 ml-1">às {format(nextSession, 'HH:mm')}</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border shadow-none">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <div className="text-2xl font-serif mb-1 text-amber-500">{openTasks.length}</div>
            <div className="text-sm text-muted-foreground">Tarefas em aberto</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border shadow-none">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <div className="text-2xl font-serif mb-1 text-emerald-500">{files.length}</div>
            <div className="text-sm text-muted-foreground">Arquivos da trilha</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Timeline */}
          <Card className="border-border bg-card/30">
            <CardHeader>
              <CardTitle className="font-serif text-xl text-primary">Sua Trilha</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative border-l border-border ml-3 space-y-6 pb-4">
                {stages.map((stage, idx) => {
                  const isCurrent = stage.status === 'in_progress' || (stage.status === 'pending' && idx === student.currentStageIndex - 1);
                  return (
                    <div key={stage.id} className="relative pl-8">
                      <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${
                        stage.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                        isCurrent ? 'bg-primary shadow-[0_0_10px_rgba(214,154,33,0.5)]' :
                        'bg-muted-foreground/30'
                      }`} />
                      <div className={`font-medium ${isCurrent ? 'text-primary' : stage.status === 'complete' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {stage.title}
                      </div>
                      {stage.description && (
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{stage.description}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Last Session */}
          <Card className="border-border bg-card/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
              <CardTitle className="font-serif text-xl">Última Sessão</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {sessions.filter(s => s.conductedAt).length > 0 ? (() => {
                const last = [...sessions].filter(s => s.conductedAt).sort((a,b) => new Date(b.conductedAt!).getTime() - new Date(a.conductedAt!).getTime())[0];
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Clock className="w-4 h-4" />
                      Realizada em {format(new Date(last.conductedAt!), 'dd/MM/yyyy')}
                    </div>
                    {last.summary && (
                      <div>
                        <h4 className="text-sm font-medium mb-1 text-primary">Resumo</h4>
                        <p className="text-sm text-muted-foreground">{last.summary}</p>
                      </div>
                    )}
                    {last.actionPlan && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-1 text-primary">Plano de Ação</h4>
                        <p className="text-sm text-muted-foreground">{last.actionPlan}</p>
                      </div>
                    )}
                  </div>
                )
              })() : (
                <p className="text-sm text-muted-foreground italic">Nenhuma sessão realizada ainda.</p>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Sidebar Column */}
        <div className="space-y-8">
          
          {/* Radar Chart */}
          {chartData.length > 0 && (
            <Card className="border-border bg-card/30">
              <CardHeader>
                <CardTitle className="font-serif text-lg text-primary text-center">Roda da Vida</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] w-full p-0 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <Radar name="Atual" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Open Tasks */}
          <Card className="border-border bg-card/30">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Tarefas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {openTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhuma tarefa pendente no momento.</p>
              ) : (
                openTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex gap-3 items-start group">
                    <div className="mt-0.5 shrink-0">
                      <div className="w-4 h-4 rounded border border-border flex items-center justify-center" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{task.title}</div>
                      {task.dueDate && (
                        <div className={`text-xs mt-0.5 flex items-center gap-1 ${new Date(task.dueDate) < new Date() ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {new Date(task.dueDate) < new Date() && <AlertCircle className="w-3 h-3" />}
                          {format(new Date(task.dueDate), 'dd/MM/yy')}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Files */}
          <Card className="border-border bg-card/30">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Arquivos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum arquivo disponível.</p>
              ) : (
                files.map(file => (
                  <a 
                    key={file.id} 
                    href={file.downloadUrl || '#'} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-between p-2 hover:bg-white/[0.02] rounded-md transition-colors border border-transparent hover:border-border group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="text-sm truncate text-muted-foreground group-hover:text-foreground transition-colors">{file.fileName}</div>
                    </div>
                    <Download className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0 ml-2" />
                  </a>
                ))
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
