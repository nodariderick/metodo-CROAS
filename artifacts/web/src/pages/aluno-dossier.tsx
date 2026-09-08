import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, Edit2, Calendar, FileText, CheckCircle2, Circle, Clock, 
  Trash2, Download, Upload, Plus, AlertCircle, FileIcon
} from 'lucide-react';
import {
  useGetStudent,
  useUpdateStudent,
  useListStudentStages,
  useUpdateStudentStage,
  useListStudentSessions,
  useCreateStudentSession,
  useUpdateStudentSession,
  useDeleteStudentSession,
  useListStudentTasks,
  useCreateStudentTask,
  useUpdateStudentTask,
  useDeleteStudentTask,
  useListStudentForms,
  useCreateStudentForm,
  useListStudentFiles,
  useRegisterStudentFile,
  useDeleteStudentFile,
  useRequestUploadUrl,
  getGetStudentQueryKey,
  getListStudentStagesQueryKey,
  getListStudentSessionsQueryKey,
  getListStudentTasksQueryKey,
  getListStudentFormsQueryKey,
  getListStudentFilesQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from 'recharts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function AlunoDossier() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const studentId = Number(params.id);
  const initialTab = new URLSearchParams(window.location.search).get('tab') === 'sessoes' ? 'sessoes' : 'trilha';

  const { data: student, isLoading: isStudentLoading } = useGetStudent(studentId, {
    query: { enabled: !!studentId, queryKey: getGetStudentQueryKey(studentId) }
  });

  const updateStudent = useUpdateStudent();

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editInfoData, setEditInfoData] = useState({ phone: '', notes: '', planEndsAt: '' });

  if (isStudentLoading || !student) {
    return <div className="p-8 text-center text-muted-foreground">Carregando dossiê...</div>;
  }

  const handleSaveInfo = async () => {
    try {
      await updateStudent.mutateAsync({
        id: studentId,
        data: {
          phone: editInfoData.phone,
          notes: editInfoData.notes,
          planEndsAt: editInfoData.planEndsAt ? new Date(editInfoData.planEndsAt).toISOString() : null,
        }
      });
      queryClient.invalidateQueries({ queryKey: getGetStudentQueryKey(studentId) });
      setIsEditingInfo(false);
      toast({ title: 'Informações atualizadas' });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/alunos')} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-serif text-primary tracking-wide">{student.fullName}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary" className="font-mono">{student.planName}</Badge>
            <Badge variant="outline" className={
              student.trailStatus === 'on_track' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
              student.trailStatus === 'delayed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
              'bg-primary/10 text-primary border-primary/20'
            }>
              {student.trailStatus === 'on_track' ? 'Em dia' : student.trailStatus === 'delayed' ? 'Atrasado' : 'Adiantado'}
            </Badge>
            {student.planEndsAt && (() => {
              const daysLeft = Math.ceil((new Date(student.planEndsAt).getTime() - Date.now()) / 86400000);
              if (daysLeft < 0) return (
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                  <AlertCircle className="w-3 h-3 mr-1" /> Plano expirado
                </Badge>
              );
              if (daysLeft <= 30) return (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                  <AlertCircle className="w-3 h-3 mr-1" /> Plano expira em {daysLeft}d
                </Badge>
              );
              return null;
            })()}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Sidebar */}
        <Card className="w-full lg:w-[320px] shrink-0 border-border bg-card/50 backdrop-blur-sm sticky top-8">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <CardTitle className="text-lg font-serif">Informações</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => {
              setEditInfoData({ phone: student.phone || '', notes: student.notes || '', planEndsAt: student.planEndsAt ? student.planEndsAt.slice(0, 10) : '' });
              setIsEditingInfo(!isEditingInfo);
            }}>
              <Edit2 className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {isEditingInfo ? (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>WhatsApp</Label>
                  <Input value={editInfoData.phone} onChange={e => setEditInfoData({ ...editInfoData, phone: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Plano Expira em</Label>
                  <Input type="date" value={editInfoData.planEndsAt} onChange={e => setEditInfoData({ ...editInfoData, planEndsAt: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Observações</Label>
                  <Textarea value={editInfoData.notes} onChange={e => setEditInfoData({ ...editInfoData, notes: e.target.value })} className="min-h-[100px]" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsEditingInfo(false)}>Cancelar</Button>
                  <Button size="sm" className="flex-1" onClick={handleSaveInfo}>Salvar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">E-mail</div>
                  <div>{student.email || '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">WhatsApp</div>
                  <div>{student.phone || '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Data de Início</div>
                  <div className="font-mono">{student.startDate ? format(new Date(student.startDate), 'dd/MM/yyyy') : '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Plano Expira em</div>
                  {student.planEndsAt ? (() => {
                    const expiryDate = new Date(student.planEndsAt);
                    const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / 86400000);
                    const isUrgent = daysLeft >= 0 && daysLeft <= 30;
                    const isExpired = daysLeft < 0;
                    return (
                      <div className={`font-mono flex items-center gap-1 ${isExpired ? 'text-red-500' : isUrgent ? 'text-amber-500' : ''}`}>
                        {isExpired && <AlertCircle className="w-3 h-3" />}
                        {isUrgent && !isExpired && <AlertCircle className="w-3 h-3" />}
                        {format(expiryDate, 'dd/MM/yyyy')}
                        {isExpired && <span className="text-xs ml-1">(expirado)</span>}
                        {isUrgent && !isExpired && <span className="text-xs ml-1">({daysLeft}d)</span>}
                      </div>
                    );
                  })() : <div className="text-muted-foreground">-</div>}
                </div>
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Próxima Sessão</div>
                  <div className="font-mono text-primary">{student.nextSessionAt ? format(new Date(student.nextSessionAt), 'dd/MM/yyyy HH:mm') : '-'}</div>
                </div>
                {student.notes && (
                  <div>
                    <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Observações</div>
                    <div className="bg-background/50 p-3 rounded text-muted-foreground italic border border-border">
                      {student.notes}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Main Area */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue={initialTab} className="w-full">
            <TabsList className="bg-card border border-border w-full justify-start h-auto p-1 mb-6 flex-wrap">
              <TabsTrigger value="trilha" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Trilha</TabsTrigger>
              <TabsTrigger value="sessoes" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Sessões</TabsTrigger>
              <TabsTrigger value="tarefas" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Tarefas</TabsTrigger>
              <TabsTrigger value="forms" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Formulários</TabsTrigger>
              <TabsTrigger value="arquivos" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Arquivos</TabsTrigger>
            </TabsList>

            <TabsContent value="trilha" className="m-0">
              <TabTrilha studentId={studentId} student={student} />
            </TabsContent>

            <TabsContent value="sessoes" className="m-0">
              <TabSessoes studentId={studentId} />
            </TabsContent>

            <TabsContent value="tarefas" className="m-0">
              <TabTarefas studentId={studentId} />
            </TabsContent>

            <TabsContent value="forms" className="m-0">
              <TabForms studentId={studentId} />
            </TabsContent>

            <TabsContent value="arquivos" className="m-0">
              <TabArquivos studentId={studentId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// -- TAB TRILHA --
function TabTrilha({ studentId, student }: { studentId: number, student: any }) {
  const { data: stages } = useListStudentStages(studentId, { query: { enabled: !!studentId, queryKey: getListStudentStagesQueryKey(studentId) } });
  const updateStage = useUpdateStudentStage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});

  if (!stages) return null;

  const completed = stages.filter(s => s.status === 'complete').length;
  const progress = Math.round((completed / Math.max(stages.length, 1)) * 100);

  const handleSave = async (stageIndex: number) => {
    try {
      await updateStage.mutateAsync({
        studentId,
        stageIndex,
        data: {
          status: editData.status,
          dueDate: editData.dueDate ? new Date(editData.dueDate).toISOString() : null,
          description: editData.description
        }
      });
      queryClient.invalidateQueries({ queryKey: getListStudentStagesQueryKey(studentId) });
      setEditingIndex(null);
      toast({ title: 'Etapa atualizada' });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const statusColors: any = {
    pending: 'bg-muted/20 text-muted-foreground border-border',
    in_progress: 'bg-primary/20 text-primary border-primary/30',
    complete: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
    delayed: 'bg-red-500/20 text-red-500 border-red-500/30'
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card/50">
        <CardContent className="pt-6">
          <div className="flex justify-between items-end mb-2">
            <div className="text-sm font-medium">Progresso Geral</div>
            <div className="text-2xl font-serif text-primary">{progress}%</div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {stages.map((stage) => {
          const isEditing = editingIndex === stage.stageIndex;
          return (
            <Card key={stage.id} className="border-border bg-card/50 overflow-hidden">
              <div className="p-4 flex gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border text-xs font-mono font-bold ${statusColors[stage.status]}`}>
                  {stage.stageIndex + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-medium text-foreground">{stage.title}</h4>
                      {!isEditing && stage.dueDate && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Prazo: {format(new Date(stage.dueDate), 'dd/MM/yyyy')}
                        </div>
                      )}
                    </div>
                    {!isEditing && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingIndex(stage.stageIndex);
                        setEditData({
                          status: stage.status,
                          dueDate: stage.dueDate ? format(new Date(stage.dueDate), 'yyyy-MM-dd') : '',
                          description: stage.description || ''
                        });
                      }}>
                        Editar
                      </Button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-4 space-y-4 bg-background/50 p-4 rounded border border-border">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Status</Label>
                          <Select value={editData.status} onValueChange={v => setEditData({...editData, status: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="in_progress">Em Andamento</SelectItem>
                              <SelectItem value="complete">Concluída</SelectItem>
                              <SelectItem value="delayed">Atrasada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Prazo</Label>
                          <Input type="date" value={editData.dueDate} onChange={e => setEditData({...editData, dueDate: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Descrição / Notas</Label>
                        <Textarea value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingIndex(null)}>Cancelar</Button>
                        <Button size="sm" onClick={() => handleSave(stage.stageIndex)}>Salvar</Button>
                      </div>
                    </div>
                  ) : (
                    stage.description && (
                      <p className="text-sm text-muted-foreground mt-3 bg-background/30 p-3 rounded">
                        {stage.description}
                      </p>
                    )
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// -- TAB SESSÕES --
type NewSessionMode = 'schedule' | 'log';

const EMPTY_NEW = { mode: 'schedule' as NewSessionMode, scheduledAt: '', conductedAt: '', summary: '', actionPlan: '', notes: '' };

function TabSessoes({ studentId }: { studentId: number }) {
  const { data: sessions } = useListStudentSessions(studentId, { query: { enabled: !!studentId, queryKey: getListStudentSessionsQueryKey(studentId) } });
  const createSession = useCreateStudentSession();
  const updateSession = useUpdateStudentSession();
  const deleteSession = useDeleteStudentSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newData, setNewData] = useState(EMPTY_NEW);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});

  const handleCreate = async () => {
    try {
      const payload: any = {};
      if (newData.scheduledAt) payload.scheduledAt = new Date(newData.scheduledAt).toISOString();
      if (newData.conductedAt) payload.conductedAt = new Date(newData.conductedAt).toISOString();
      if (newData.summary) payload.summary = newData.summary;
      if (newData.actionPlan) payload.actionPlan = newData.actionPlan;
      if (newData.notes) payload.notes = newData.notes;

      await createSession.mutateAsync({ studentId, data: payload });
      queryClient.invalidateQueries({ queryKey: getListStudentSessionsQueryKey(studentId) });
      setIsNewOpen(false);
      setNewData(EMPTY_NEW);
      toast({ title: newData.mode === 'log' ? 'Sessão registrada' : 'Sessão agendada' });
    } catch {
      toast({ title: 'Erro ao salvar sessão', variant: 'destructive' });
    }
  };

  const isCreateValid = newData.mode === 'schedule' ? !!newData.scheduledAt : !!newData.conductedAt;

  const handleSave = async (sessionId: number) => {
    try {
      await updateSession.mutateAsync({
        studentId,
        sessionId,
        data: {
          summary: editData.summary,
          actionPlan: editData.actionPlan,
          notes: editData.notes,
          conductedAt: editData.conductedAt ? new Date(editData.conductedAt).toISOString() : null,
          scheduledAt: editData.scheduledAt ? new Date(editData.scheduledAt).toISOString() : null,
        }
      });
      queryClient.invalidateQueries({ queryKey: getListStudentSessionsQueryKey(studentId) });
      setEditingId(null);
      toast({ title: 'Sessão atualizada' });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleDelete = async (sessionId: number) => {
    if (!confirm('Deseja realmente excluir esta sessão?')) return;
    try {
      await deleteSession.mutateAsync({ studentId, sessionId });
      queryClient.invalidateQueries({ queryKey: getListStudentSessionsQueryKey(studentId) });
      toast({ title: 'Sessão excluída' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isNewOpen} onOpenChange={(open) => { setIsNewOpen(open); if (!open) setNewData(EMPTY_NEW); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-accent">
              <Plus className="w-4 h-4 mr-2" />
              Nova Sessão
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">Nova Sessão</DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-5">
              {/* Mode toggle */}
              <div className="flex gap-1 bg-background/60 p-1 rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setNewData({ ...newData, mode: 'schedule' })}
                  className={`flex-1 py-1.5 text-xs font-mono rounded transition-colors ${newData.mode === 'schedule' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  AGENDAR FUTURA
                </button>
                <button
                  type="button"
                  onClick={() => setNewData({ ...newData, mode: 'log' })}
                  className={`flex-1 py-1.5 text-xs font-mono rounded transition-colors ${newData.mode === 'log' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  REGISTRAR REALIZADA
                </button>
              </div>

              {newData.mode === 'schedule' ? (
                <div className="grid gap-2">
                  <Label>Data e Hora Agendada <span className="text-destructive">*</span></Label>
                  <Input type="datetime-local" value={newData.scheduledAt} onChange={e => setNewData({ ...newData, scheduledAt: e.target.value })} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Data Agendada</Label>
                      <Input type="datetime-local" value={newData.scheduledAt} onChange={e => setNewData({ ...newData, scheduledAt: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Data Realizada <span className="text-destructive">*</span></Label>
                      <Input type="datetime-local" value={newData.conductedAt} onChange={e => setNewData({ ...newData, conductedAt: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Resumo / Tópicos Abordados</Label>
                    <Textarea placeholder="O que foi trabalhado nesta sessão..." value={newData.summary} onChange={e => setNewData({ ...newData, summary: e.target.value })} className="min-h-[70px]" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Plano de Ação</Label>
                    <Textarea placeholder="Próximos passos acordados..." value={newData.actionPlan} onChange={e => setNewData({ ...newData, actionPlan: e.target.value })} className="min-h-[70px]" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Anotações Privadas</Label>
                    <Textarea placeholder="Observações internas..." value={newData.notes} onChange={e => setNewData({ ...newData, notes: e.target.value })} className="min-h-[60px]" />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!isCreateValid || createSession.isPending}>
                {createSession.isPending ? 'Salvando...' : newData.mode === 'log' ? 'Registrar' : 'Agendar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!sessions?.length ? (
        <div className="p-8 text-center text-muted-foreground border border-border rounded-lg bg-card/50">
          Nenhuma sessão registrada.
        </div>
      ) : (
        sessions.map(session => {
          const isEditing = editingId === session.id;
          return (
            <Card key={session.id} className="border-border bg-card/50">
              <div className="p-4 border-b border-border flex justify-between items-center bg-background/30">
                <div className="flex items-center gap-4">
                  <div className="font-serif text-lg text-primary">Sessão {session.sessionNumber}</div>
                  {session.conductedAt ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Realizada em {format(new Date(session.conductedAt), 'dd/MM/yy')}</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Agendada: {session.scheduledAt ? format(new Date(session.scheduledAt), 'dd/MM/yy HH:mm') : '-'}</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isEditing && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingId(session.id);
                        setEditData({
                          summary: session.summary || '',
                          actionPlan: session.actionPlan || '',
                          notes: session.notes || '',
                          scheduledAt: session.scheduledAt ? format(new Date(session.scheduledAt), "yyyy-MM-dd'T'HH:mm") : '',
                          conductedAt: session.conductedAt ? format(new Date(session.conductedAt), "yyyy-MM-dd'T'HH:mm") : ''
                        });
                      }}>Editar</Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(session.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <CardContent className="p-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Data Agendada</Label>
                        <Input type="datetime-local" value={editData.scheduledAt} onChange={e => setEditData({...editData, scheduledAt: e.target.value})} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Data Realizada</Label>
                        <Input type="datetime-local" value={editData.conductedAt} onChange={e => setEditData({...editData, conductedAt: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Resumo / Tópicos Abordados</Label>
                      <Textarea value={editData.summary} onChange={e => setEditData({...editData, summary: e.target.value})} className="min-h-[80px]" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Plano de Ação</Label>
                      <Textarea value={editData.actionPlan} onChange={e => setEditData({...editData, actionPlan: e.target.value})} className="min-h-[80px]" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Anotações Privadas</Label>
                      <Textarea value={editData.notes} onChange={e => setEditData({...editData, notes: e.target.value})} className="min-h-[80px]" />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                      <Button onClick={() => handleSave(session.id)}>Salvar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {session.summary && (
                      <div>
                        <h5 className="text-sm font-medium mb-1 flex items-center"><FileText className="w-4 h-4 mr-2 text-primary" /> Resumo</h5>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-6">{session.summary}</p>
                      </div>
                    )}
                    {session.actionPlan && (
                      <div>
                        <h5 className="text-sm font-medium mb-1 flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Plano de Ação</h5>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-6">{session.actionPlan}</p>
                      </div>
                    )}
                    {!session.summary && !session.actionPlan && (
                      <div className="text-sm text-muted-foreground italic">Nenhum registro preenchido para esta sessão.</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

// -- TAB TAREFAS --
function TabTarefas({ studentId }: { studentId: number }) {
  const { data: tasks } = useListStudentTasks(studentId, undefined, { query: { enabled: !!studentId, queryKey: getListStudentTasksQueryKey(studentId) } });
  const createTask = useCreateStudentTask();
  const updateTask = useUpdateStudentTask();
  const deleteTask = useDeleteStudentTask();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '' });

  const handleCreate = async () => {
    try {
      await createTask.mutateAsync({
        studentId,
        data: {
          title: newTask.title,
          description: newTask.description || null,
          dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : null
        }
      });
      queryClient.invalidateQueries({ queryKey: getListStudentTasksQueryKey(studentId) });
      setIsNewOpen(false);
      setNewTask({ title: '', description: '', dueDate: '' });
      toast({ title: 'Tarefa criada' });
    } catch {
      toast({ title: 'Erro ao criar tarefa', variant: 'destructive' });
    }
  };

  const handleToggle = async (taskId: number, currentCompletedAt: string | null) => {
    try {
      await updateTask.mutateAsync({
        studentId,
        taskId,
        data: { completedAt: currentCompletedAt ? null : new Date().toISOString() }
      });
      queryClient.invalidateQueries({ queryKey: getListStudentTasksQueryKey(studentId) });
    } catch {
      toast({ title: 'Erro ao atualizar tarefa', variant: 'destructive' });
    }
  };

  const handleDelete = async (taskId: number) => {
    try {
      await deleteTask.mutateAsync({ studentId, taskId });
      queryClient.invalidateQueries({ queryKey: getListStudentTasksQueryKey(studentId) });
      toast({ title: 'Tarefa excluída' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  if (!tasks) return null;

  const openTasks = tasks.filter(t => !t.completedAt);
  const closedTasks = tasks.filter(t => !!t.completedAt);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card/50 p-4 border border-border rounded-lg">
        <div>
          <h3 className="font-serif text-lg">Quadro de Tarefas</h3>
          <p className="text-sm text-muted-foreground">Acompanhe as ações acordadas</p>
        </div>
        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card">
            <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>Título (obrigatório)</Label>
                <Input value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Prazo</Label>
                <Input type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!newTask.title}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-sm text-primary uppercase tracking-wider">Abertas ({openTasks.length})</h4>
        {openTasks.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">Nenhuma tarefa aberta.</div>
        ) : (
          openTasks.map(task => (
            <div key={task.id} className="flex gap-4 p-4 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors group">
              <Checkbox 
                checked={false} 
                onCheckedChange={() => handleToggle(task.id, task.completedAt ?? null)} 
                className="mt-1 border-primary data-[state=checked]:bg-primary"
              />
              <div className="flex-1">
                <div className="font-medium">{task.title}</div>
                {task.description && <div className="text-sm text-muted-foreground mt-1">{task.description}</div>}
                {task.dueDate && (
                  <Badge variant="outline" className={`mt-2 font-mono text-xs ${new Date(task.dueDate) < new Date() ? 'text-destructive border-destructive/30 bg-destructive/10' : ''}`}>
                    Prazo: {format(new Date(task.dueDate), 'dd/MM/yyyy')}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(task.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {closedTasks.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-border">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Concluídas ({closedTasks.length})</h4>
          {closedTasks.map(task => (
            <div key={task.id} className="flex gap-4 p-4 rounded-lg border border-border bg-background/50 opacity-60 hover:opacity-100 transition-opacity">
              <Checkbox 
                checked={true} 
                onCheckedChange={() => handleToggle(task.id, task.completedAt ?? null)} 
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium line-through text-muted-foreground">{task.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- TAB FORMS --
function TabForms({ studentId }: { studentId: number }) {
  const { data: forms } = useListStudentForms(studentId, undefined, { query: { enabled: !!studentId, queryKey: getListStudentFormsQueryKey(studentId) } });
  const createForm = useCreateStudentForm();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ formType: 'anamnese', responseData: '', areaScores: '' });

  const handleCreate = async () => {
    try {
      await createForm.mutateAsync({
        studentId,
        data: {
          formType: newForm.formType as any,
          responseData: newForm.responseData,
          areaScores: newForm.formType === 'anamnese' ? newForm.areaScores : null
        }
      });
      queryClient.invalidateQueries({ queryKey: getListStudentFormsQueryKey(studentId) });
      setIsNewOpen(false);
      setNewForm({ formType: 'anamnese', responseData: '', areaScores: '' });
      toast({ title: 'Resposta registrada' });
    } catch {
      toast({ title: 'Erro ao registrar', variant: 'destructive' });
    }
  };

  if (!forms) return null;

  // Process Radar Chart Data
  const anamneseForms = forms.filter(f => f.formType === 'anamnese' && f.areaScores);
  let chartData: any[] = [];
  
  if (anamneseForms.length > 0) {
    // Sort oldest first
    const sorted = [...anamneseForms].sort((a, b) => new Date(a.respondedAt).getTime() - new Date(b.respondedAt).getTime());
    const first = sorted[0];
    const latest = sorted.length > 1 ? sorted[sorted.length - 1] : null;

    try {
      const firstScores = JSON.parse(first.areaScores!);
      const latestScores = latest ? JSON.parse(latest.areaScores!) : null;
      
      const areas = ['saude', 'carreira', 'financas', 'relacionamentos', 'familia', 'espiritualidade', 'lazer', 'desenvolvimento', 'contribuicao'];
      const labels: Record<string, string> = {
        saude: 'Saúde', carreira: 'Carreira', financas: 'Finanças', relacionamentos: 'Relacionamentos',
        familia: 'Família', espiritualidade: 'Espiritualidade', lazer: 'Lazer', desenvolvimento: 'Desenvolvimento', contribuicao: 'Contribuição'
      };

      chartData = areas.map(area => ({
        subject: labels[area],
        Inicial: firstScores[area] || 0,
        Atual: latestScores ? (latestScores[area] || 0) : undefined
      }));
    } catch (e) {
      console.error('Failed to parse area scores', e);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogTrigger asChild>
            <Button>Adicionar Resposta</Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card">
            <DialogHeader><DialogTitle>Nova Resposta</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>Tipo de Formulário</Label>
                <Select value={newForm.formType} onValueChange={v => setNewForm({...newForm, formType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anamnese">Anamnese / Roda da Vida</SelectItem>
                    <SelectItem value="objectives">Objetivos</SelectItem>
                    <SelectItem value="smart_goals">Metas SMART</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Respostas (JSON ou Texto)</Label>
                <Textarea className="font-mono text-xs h-32" value={newForm.responseData} onChange={e => setNewForm({...newForm, responseData: e.target.value})} />
              </div>
              {newForm.formType === 'anamnese' && (
                <div className="grid gap-2">
                  <Label>Notas das Áreas (JSON)</Label>
                  <div className="text-xs text-muted-foreground">Ex: {"{ \"saude\": 8, \"carreira\": 6 }"}</div>
                  <Textarea className="font-mono text-xs h-24" value={newForm.areaScores} onChange={e => setNewForm({...newForm, areaScores: e.target.value})} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {chartData.length > 0 && (
        <Card className="border-border bg-[#131110]">
          <CardHeader>
            <CardTitle className="text-center font-serif text-primary">Evolução - Roda da Vida</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid stroke="hsl(var(--muted))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Radar name="Inicial" dataKey="Inicial" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} />
                {chartData[0].Atual !== undefined && (
                  <Radar name="Atual" dataKey="Atual" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                )}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Accordion type="single" collapsible className="w-full space-y-2">
        {forms.map(form => (
          <AccordionItem value={form.id.toString()} key={form.id} className="border border-border bg-card/50 rounded-lg px-4 data-[state=open]:bg-card">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex gap-4 items-center text-left">
                <Badge variant="outline" className="uppercase tracking-wider">{form.formType.replace('_', ' ')}</Badge>
                <span className="text-sm text-muted-foreground font-mono">{format(new Date(form.respondedAt), 'dd/MM/yyyy HH:mm')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <div className="bg-background/80 p-4 rounded font-mono text-xs whitespace-pre-wrap overflow-auto max-h-[300px] border border-border">
                {form.responseData || 'Sem dados de resposta.'}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

// -- TAB ARQUIVOS --
function TabArquivos({ studentId }: { studentId: number }) {
  const { data: files } = useListStudentFiles(studentId, undefined, { query: { enabled: !!studentId, queryKey: getListStudentFilesQueryKey(studentId) } });
  const requestUpload = useRequestUploadUrl();
  const registerFile = useRegisterStudentFile();
  const deleteFile = useDeleteStudentFile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState('other');
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { uploadURL, objectPath } = await requestUpload.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type }
      });

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      await registerFile.mutateAsync({
        studentId,
        data: {
          fileName: file.name,
          fileType: uploadType as any,
          storageKey: objectPath,
          fileSize: file.size
        }
      });

      queryClient.invalidateQueries({ queryKey: getListStudentFilesQueryKey(studentId) });
      toast({ title: 'Arquivo enviado com sucesso' });
    } catch {
      toast({ title: 'Erro ao enviar arquivo', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (fileId: number) => {
    if (!confirm('Deseja excluir este arquivo?')) return;
    try {
      await deleteFile.mutateAsync({ studentId, fileId });
      queryClient.invalidateQueries({ queryKey: getListStudentFilesQueryKey(studentId) });
      toast({ title: 'Arquivo excluído' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card/50 border-dashed">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-2">Upload de Documento</h3>
          <div className="flex items-center gap-4 mb-4">
            <Select value={uploadType} onValueChange={setUploadType}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Tipo de Arquivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contract">Contrato</SelectItem>
                <SelectItem value="transcript">Transcrição</SelectItem>
                <SelectItem value="mindmap">Mapa Mental</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="relative cursor-pointer" disabled={isUploading}>
            {isUploading ? 'Enviando...' : 'Selecionar Arquivo'}
            <input 
              type="file" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {files?.map(file => (
          <div key={file.id} className="flex items-center justify-between p-4 border border-border bg-card/30 rounded-lg hover:bg-card/80 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded bg-background flex items-center justify-center border border-border">
                <FileIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium text-sm">{file.fileName}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] h-4 uppercase">{file.fileType}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">{format(new Date(file.uploadedAt), 'dd/MM/yy HH:mm')}</span>
                  {file.fileSize && <span className="text-xs text-muted-foreground font-mono">({Math.round(file.fileSize / 1024)} KB)</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {file.downloadUrl && (
                <Button variant="ghost" size="icon" onClick={() => window.open(file.downloadUrl!, '_blank')}>
                  <Download className="w-4 h-4 text-primary" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => handleDelete(file.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {files?.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">Nenhum arquivo anexado.</div>
        )}
      </div>
    </div>
  );
}
