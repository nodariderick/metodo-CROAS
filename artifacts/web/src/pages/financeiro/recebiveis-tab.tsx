import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { 
  useListReceivables, 
  useCreateReceivable,
  useUpdateReceivable,
  useDeleteReceivable,
  getListReceivablesQueryKey,
  useListStudents
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, CheckCircle, Trash2, Calendar } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export function RecebiveisTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  
  const { data: receivables, isLoading } = useListReceivables({
    overdue: filter === "vencidos" ? true : undefined,
    unpaid: filter === "pendentes" ? true : undefined,
  });

  const { data: students } = useListStudents();

  // Create
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newData, setNewData] = useState({
    studentId: "",
    description: "",
    amount: "",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    notes: ""
  });

  // Pay / Edit
  const [activeId, setActiveId] = useState<number | null>(null);
  const activeRec = receivables?.find(r => r.id === activeId);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const createRec = useCreateReceivable();
  const updateRec = useUpdateReceivable();
  const deleteRec = useDeleteReceivable();

  const handleCreate = async () => {
    if (!newData.studentId || !newData.description || !newData.amount) return;
    const cents = Math.round(parseFloat(newData.amount.replace(',', '.')) * 100);
    try {
      await createRec.mutateAsync({
        data: {
          studentId: parseInt(newData.studentId),
          description: newData.description,
          amount: cents,
          dueDate: newData.dueDate,
          notes: newData.notes
        }
      });
      queryClient.invalidateQueries({ queryKey: getListReceivablesQueryKey() });
      setIsNewOpen(false);
      setNewData({ studentId: "", description: "", amount: "", dueDate: format(new Date(), "yyyy-MM-dd"), notes: "" });
      toast.success("Recebível criado.");
    } catch (e) {
      toast.error("Falha ao criar recebível.");
    }
  };

  const handlePay = async () => {
    if (!activeId || !payAmount || !activeRec) return;
    const cents = Math.round(parseFloat(payAmount.replace(',', '.')) * 100);
    try {
      await updateRec.mutateAsync({
        id: activeId,
        data: {
          paidAt: new Date(payDate).toISOString(),
          paidAmount: cents,
          dueDate: activeRec.dueDate,
          description: activeRec.description,
          amount: activeRec.amount,
          notes: activeRec.notes
        }
      });
      queryClient.invalidateQueries({ queryKey: getListReceivablesQueryKey() });
      setActiveId(null);
      toast.success("Marcado como pago.");
    } catch (e) {
      toast.error("Falha ao registrar pagamento.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir recebível?')) return;
    try {
      await deleteRec.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListReceivablesQueryKey() });
      setActiveId(null);
      toast.success("Excluído.");
    } catch (e) {
      toast.error("Falha ao excluir.");
    }
  };

  const filtered = receivables?.filter(r => {
    if (filter === "pagos" && !r.paidAt) return false;
    const sName = r.studentName?.toLowerCase() || "";
    const desc = r.description.toLowerCase();
    const q = search.toLowerCase();
    return sName.includes(q) || desc.includes(q);
  });

  const totalOutstanding = receivables?.filter(r => !r.paidAt).reduce((sum, r) => sum + r.amount, 0) || 0;
  const overdueCount = receivables?.filter(r => r.isOverdue && !r.paidAt).length || 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif text-foreground">Contas a Receber</h2>
        <div className="flex items-center gap-4">
          <div className="flex gap-4 mr-4 text-sm">
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground uppercase text-[10px] tracking-widest font-medium">A Receber</span>
              <span className="font-mono text-primary">{formatMoney(totalOutstanding)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground uppercase text-[10px] tracking-widest font-medium">Vencidos</span>
              <span className="font-mono text-rose-500">{overdueCount}</span>
            </div>
          </div>

          {user?.role === 'MASTER' && (
            <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-accent">
                  <Plus className="w-4 h-4 mr-2" /> Novo Recebível
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-serif">Criar Recebível</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Aluno</label>
                    <Select value={newData.studentId} onValueChange={v => setNewData({...newData, studentId: v})}>
                      <SelectTrigger className="border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {students?.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Descrição</label>
                    <Input value={newData.description} onChange={e => setNewData({...newData, description: e.target.value})} className="border-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Valor (R$)</label>
                      <Input placeholder="150,00" value={newData.amount} onChange={e => setNewData({...newData, amount: e.target.value})} className="border-border" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Vencimento</label>
                      <Input type="date" value={newData.dueDate} onChange={e => setNewData({...newData, dueDate: e.target.value})} className="border-border" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Observações</label>
                    <Input value={newData.notes} onChange={e => setNewData({...newData, notes: e.target.value})} className="border-border" />
                  </div>
                  <Button onClick={handleCreate} disabled={createRec.isPending} className="bg-primary text-primary-foreground hover:bg-accent mt-2">
                    Criar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-card p-4 border border-border">
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input 
            placeholder="Buscar aluno ou desc..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 border-border bg-background" 
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px] border-border bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendentes">Pendentes</SelectItem>
            <SelectItem value="vencidos">Vencidos</SelectItem>
            <SelectItem value="pagos">Pagos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Aluno</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum recebível encontrado</TableCell></TableRow>
            ) : (
              filtered?.map(r => (
                <TableRow 
                  key={r.id} 
                  className={`border-border cursor-pointer hover:bg-muted/50 transition-colors ${r.isOverdue && !r.paidAt ? 'border-l-2 border-l-rose-500' : ''}`}
                  onClick={() => {
                    setActiveId(r.id);
                    setPayAmount(String(r.amount / 100)); // Default full amount
                  }}
                >
                  <TableCell className="font-medium text-foreground">{r.studentName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.description}</TableCell>
                  <TableCell className="font-mono text-sm">{format(parseISO(r.dueDate), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="font-mono">{formatMoney(r.amount)}</TableCell>
                  <TableCell>
                    {r.paidAt ? (
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/30">Pago</Badge>
                    ) : r.isOverdue ? (
                      <Badge className="bg-rose-500/20 text-rose-500 border-rose-500/30 hover:bg-rose-500/30">Vencido</Badge>
                    ) : (
                      <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30">Pendente</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!activeId} onOpenChange={(open) => !open && setActiveId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-serif">Detalhes do Recebível</DialogTitle>
          </DialogHeader>
          {activeRec && (
            <div className="grid gap-6 py-4">
              <div className="bg-background border border-border p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-lg">{activeRec.description}</div>
                  <div className="font-mono text-lg text-foreground">
                    {formatMoney(activeRec.amount)}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Aluno: {activeRec.studentName}</div>
                <div className="text-sm text-muted-foreground font-mono flex items-center gap-2 mt-2">
                  <Calendar className="w-3 h-3" /> Vencimento: {format(parseISO(activeRec.dueDate), 'dd/MM/yyyy')}
                </div>
                {activeRec.paidAt && (
                  <div className="text-sm text-emerald-500 font-mono mt-1">
                    Pago em {format(parseISO(activeRec.paidAt), 'dd/MM/yyyy')} ({formatMoney(activeRec.paidAmount || 0)})
                  </div>
                )}
                {activeRec.notes && (
                  <div className="text-sm text-muted-foreground italic mt-2">Obs: {activeRec.notes}</div>
                )}
              </div>

              {!activeRec.paidAt && user?.role === 'MASTER' && (
                <div className="flex flex-col gap-4 border-t border-border pt-4 mt-2">
                  <h4 className="text-sm font-medium">Baixar Pagamento</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-muted-foreground">Data Pagamento</label>
                      <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="border-border" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-muted-foreground">Valor Pago (R$)</label>
                      <Input value={payAmount} onChange={e => setPayAmount(e.target.value)} className="border-border" />
                    </div>
                  </div>
                  <Button onClick={handlePay} disabled={updateRec.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full mt-2">
                    <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Pago
                  </Button>
                </div>
              )}

              {user?.role === 'MASTER' && (
                <div className="flex justify-end mt-4">
                  <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(activeRec.id)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
