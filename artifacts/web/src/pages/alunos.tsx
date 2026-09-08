import { useState } from 'react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Plus, MoreHorizontal, UserX, CheckCircle2, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { 
  useListStudents, 
  getListStudentsQueryKey,
  useCreateStudent,
  useListPlans,
  useListUsers,
  useUpdateStudent
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function Alunos() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [planId, setPlanId] = useState<string>('all');
  const [trailStatus, setTrailStatus] = useState<string>('all');
  const [isActive, setIsActive] = useState<string>('true');

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newStudentData, setNewStudentData] = useState({
    fullName: '',
    userId: 'none',
    planId: '',
    startDate: '',
    planEndsAt: '',
    email: '',
    phone: '',
    notes: ''
  });

  const { data: students, isLoading } = useListStudents({
    search: search || undefined,
    planId: planId !== 'all' ? Number(planId) : undefined,
    trailStatus: trailStatus !== 'all' ? (trailStatus as any) : undefined,
    isActive: isActive === 'all' ? undefined : isActive === 'true'
  }, {
    query: {
      queryKey: getListStudentsQueryKey({
        search: search || undefined,
        planId: planId !== 'all' ? Number(planId) : undefined,
        trailStatus: trailStatus !== 'all' ? (trailStatus as any) : undefined,
        isActive: isActive === 'all' ? undefined : isActive === 'true'
      })
    }
  });

  const { data: plans } = useListPlans();
  const { data: users } = useListUsers({ role: 'CLIENT' });

  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();

  const handleCreate = async () => {
    try {
      await createStudent.mutateAsync({
        data: {
          fullName: newStudentData.fullName,
          userId: newStudentData.userId !== 'none' ? Number(newStudentData.userId) : null,
          planId: Number(newStudentData.planId),
          email: newStudentData.email || null,
          phone: newStudentData.phone || null,
          startDate: newStudentData.startDate ? new Date(newStudentData.startDate).toISOString() : null,
          planEndsAt: newStudentData.planEndsAt ? new Date(newStudentData.planEndsAt).toISOString() : null,
          notes: newStudentData.notes || null,
        }
      });
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      setIsNewOpen(false);
      setNewStudentData({ fullName: '', userId: 'none', planId: '', startDate: '', planEndsAt: '', email: '', phone: '', notes: '' });
      toast({ title: 'Aluno criado com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao criar aluno', variant: 'destructive' });
    }
  };

  const handleDeactivate = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateStudent.mutateAsync({ id, data: { isActive: false } });
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: 'Aluno desativado' });
    } catch (error) {
      toast({ title: 'Erro ao desativar', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_track':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Em dia</Badge>;
      case 'delayed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Atrasado</Badge>;
      case 'ahead':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20"><AlertTriangle className="w-3 h-3 mr-1" /> Adiantado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary tracking-wide">Trilha de Alunos</h1>
          <p className="text-muted-foreground mt-1">Gestão de progresso e engajamento</p>
        </div>
        
        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-accent font-medium shadow-[0_0_20px_rgba(214,154,33,0.15)]">
              <Plus className="w-4 h-4 mr-2" />
              Novo Aluno
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] border-border bg-card">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl text-primary">Novo Aluno</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome Completo</Label>
                <Input 
                  value={newStudentData.fullName}
                  onChange={e => setNewStudentData({ ...newStudentData, fullName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Plano</Label>
                  <Select value={newStudentData.planId} onValueChange={v => setNewStudentData({ ...newStudentData, planId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {plans?.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Usuário Vinculado</Label>
                  <Select value={newStudentData.userId} onValueChange={v => setNewStudentData({ ...newStudentData, userId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {users?.map(u => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>E-mail</Label>
                  <Input 
                    type="email"
                    value={newStudentData.email}
                    onChange={e => setNewStudentData({ ...newStudentData, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>WhatsApp</Label>
                  <Input 
                    value={newStudentData.phone}
                    onChange={e => setNewStudentData({ ...newStudentData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Data de Início</Label>
                  <Input 
                    type="date"
                    value={newStudentData.startDate}
                    onChange={e => setNewStudentData({ ...newStudentData, startDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Plano Expira em</Label>
                  <Input 
                    type="date"
                    value={newStudentData.planEndsAt}
                    onChange={e => setNewStudentData({ ...newStudentData, planEndsAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Observações</Label>
                <Textarea 
                  value={newStudentData.notes}
                  onChange={e => setNewStudentData({ ...newStudentData, notes: e.target.value })}
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!newStudentData.fullName || !newStudentData.planId}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou e-mail..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50 border-border"
            />
          </div>
          <div className="flex gap-2">
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="w-[160px] bg-background/50">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Planos</SelectItem>
                {plans?.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={trailStatus} onValueChange={setTrailStatus}>
              <SelectTrigger className="w-[160px] bg-background/50">
                <SelectValue placeholder="Status da Trilha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="on_track">Em Dia</SelectItem>
                <SelectItem value="delayed">Atrasado</SelectItem>
                <SelectItem value="ahead">Adiantado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={isActive} onValueChange={setIsActive}>
              <SelectTrigger className="w-[140px] bg-background/50">
                <SelectValue placeholder="Ativos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Ativos</SelectItem>
                <SelectItem value="false">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : !students || students.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UserX className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-serif text-foreground mb-2">Nenhum aluno encontrado</h3>
            <p className="text-muted-foreground max-w-sm">
              Não encontramos nenhum aluno correspondente aos filtros selecionados.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-background/30">
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="w-[200px]">Progresso</TableHead>
                 <TableHead>Próxima Sessão</TableHead>
                 <TableHead>Sessões</TableHead>
                <TableHead>Tarefas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow 
                  key={student.id}
                  className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setLocation(`/alunos/${student.id}`)}
                >
                  <TableCell>
                    <div className="font-medium text-foreground">{student.fullName}</div>
                    <div className="text-xs text-muted-foreground">{student.email || 'Sem e-mail'}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-xs">{student.planName}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Etapa {student.currentStageIndex}</span>
                        <span className="font-mono text-primary">{Math.round((student.currentStageIndex / Math.max(student.totalStages, 1)) * 100)}%</span>
                      </div>
                      <Progress 
                        value={(student.currentStageIndex / Math.max(student.totalStages, 1)) * 100} 
                        className="h-1.5"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {student.nextSessionAt ? (
                      <div className="flex items-center text-sm">
                        <Clock className="w-3 h-3 mr-2 text-primary" />
                        <span className="font-mono">{format(new Date(student.nextSessionAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não agendada</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left hover:text-primary transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/alunos/${student.id}?tab=sessoes`);
                      }}
                    >
                      <div className="font-mono text-sm">{student.sessionCount}</div>
                      <div className="text-xs text-muted-foreground">
                        {student.lastSessionAt
                          ? `Última: ${format(new Date(student.lastSessionAt), "dd/MM/yyyy", { locale: ptBR })}`
                          : "Nenhuma registrada"}
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    {student.openTaskCount > 0 ? (
                      <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
                        {student.openTaskCount} abertas
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nenhuma</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(student.trailStatus)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => handleDeactivate(student.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Desativar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
