import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { 
  useListFinancialTransactions, 
  useListFinancialCategories,
  useCreateFinancialTransaction,
  useDeleteFinancialTransaction,
  useReconcileTransaction,
  getListFinancialTransactionsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Plus, CheckCircle, Trash2, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export function ConciliacaoTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");
  
  const { data: transactions, isLoading } = useListFinancialTransactions({
    status: status !== "all" ? status as any : undefined,
    type: type !== "all" ? type as any : undefined,
  });

  const { data: categories } = useListFinancialCategories();
  
  // Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState("csv");
  const [isImporting, setIsImporting] = useState(false);

  // Manual Entry State
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualData, setManualData] = useState({
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    type: "expense",
    categoryId: "",
    notes: ""
  });
  
  const createTx = useCreateFinancialTransaction();
  const deleteTx = useDeleteFinancialTransaction();
  const reconcileTx = useReconcileTransaction();

  // Reconcile Drawer State
  const [reconcileTxId, setReconcileTxId] = useState<number | null>(null);
  const [reconcileCat, setReconcileCat] = useState("");
  const [reconcileNotes, setReconcileNotes] = useState("");
  const activeTx = transactions?.find(t => t.id === reconcileTxId);

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', fileType);
      
      const res = await fetch('/api/finance/transactions/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Falha na importação');
      
      toast.success(`${data.imported} importadas, ${data.errors} erros.`);
      queryClient.invalidateQueries({ queryKey: getListFinancialTransactionsQueryKey() });
      setIsImportOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Falha na importação");
    } finally {
      setIsImporting(false);
      setFile(null);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualData.amount || !manualData.description || !manualData.categoryId) return;
    const cents = Math.round(parseFloat(manualData.amount.replace(',', '.')) * 100);
    try {
      await createTx.mutateAsync({
        data: {
          amount: cents,
          transactionDate: manualData.date,
          description: manualData.description,
          type: manualData.type as 'revenue'|'expense',
          categoryId: parseInt(manualData.categoryId),
          notes: manualData.notes
        }
      });
      queryClient.invalidateQueries({ queryKey: getListFinancialTransactionsQueryKey() });
      setIsManualOpen(false);
      toast.success("Lançamento criado.");
    } catch (err) {
      toast.error("Falha ao criar lançamento.");
    }
  };

  const handleReconcile = async () => {
    if (!reconcileTxId || !reconcileCat) return;
    try {
      await reconcileTx.mutateAsync({
        id: reconcileTxId,
        data: {
          categoryId: parseInt(reconcileCat),
          notes: reconcileNotes
        }
      });
      queryClient.invalidateQueries({ queryKey: getListFinancialTransactionsQueryKey() });
      setReconcileTxId(null);
      toast.success("Transação conciliada.");
    } catch (err) {
      toast.error("Falha ao conciliar.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta transação?')) return;
    try {
      await deleteTx.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListFinancialTransactionsQueryKey() });
      if (reconcileTxId === id) setReconcileTxId(null);
      toast.success("Transação excluída.");
    } catch (err) {
      toast.error("Falha ao excluir transação.");
    }
  };

  const openReconcile = (tx: any) => {
    setReconcileTxId(tx.id);
    setReconcileNotes(tx.notes || "");
    
    // Auto-select suggested category if available
    let catId = tx.categoryId ? String(tx.categoryId) : "";
    if (!catId && tx.suggestedCategoryName && categories) {
      const match = categories.find(c => c.name.toLowerCase() === tx.suggestedCategoryName?.toLowerCase());
      if (match) catId = String(match.id);
    }
    setReconcileCat(catId);
  };

  const filteredTxs = transactions?.filter(t => 
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif text-foreground">Conciliação Bancária</h2>
        <div className="flex gap-3">
          {user?.role === 'MASTER' && (
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-border">
                  <Upload className="w-4 h-4 mr-2" /> Importar Extrato
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-serif">Importar Transações</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Arquivo (.csv, .ofx)</label>
                    <Input type="file" accept=".csv,.ofx" onChange={e => setFile(e.target.files?.[0] || null)} className="border-border" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={fileType} onValueChange={setFileType}>
                      <SelectTrigger className="border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="ofx">OFX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleImport} disabled={!file || isImporting} className="bg-primary text-primary-foreground hover:bg-accent mt-2">
                    {isImporting ? 'Importando...' : 'Importar'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-accent">
                <Plus className="w-4 h-4 mr-2" /> Lançamento Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-serif">Novo Lançamento</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Data</label>
                    <Input type="date" value={manualData.date} onChange={e => setManualData({...manualData, date: e.target.value})} className="border-border" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Valor (R$)</label>
                    <Input placeholder="150,00" value={manualData.amount} onChange={e => setManualData({...manualData, amount: e.target.value})} className="border-border" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Input value={manualData.description} onChange={e => setManualData({...manualData, description: e.target.value})} className="border-border" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={manualData.type} onValueChange={v => setManualData({...manualData, type: v})}>
                      <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Receita</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Categoria</label>
                    <Select value={manualData.categoryId} onValueChange={v => setManualData({...manualData, categoryId: v})}>
                      <SelectTrigger className="border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {categories?.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Observações</label>
                  <Input value={manualData.notes} onChange={e => setManualData({...manualData, notes: e.target.value})} className="border-border" />
                </div>
                <Button onClick={handleManualSubmit} disabled={createTx.isPending} className="bg-primary text-primary-foreground hover:bg-accent mt-2">
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-card p-4 border border-border">
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input 
            placeholder="Buscar..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 border-border bg-background" 
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px] border-border bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="pending_reconciliation">A conciliar</SelectItem>
            <SelectItem value="reconciled">Conciliado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[180px] border-border bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="revenue">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
            ) : filteredTxs?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada</TableCell></TableRow>
            ) : (
              filteredTxs?.map(tx => (
                <TableRow key={tx.id} className="border-border">
                  <TableCell className="font-mono text-sm">{format(parseISO(tx.transactionDate), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{tx.description}</div>
                    {tx.type === 'revenue' ? 
                      <span className="text-xs text-emerald-500 uppercase">Receita</span> : 
                      <span className="text-xs text-rose-500 uppercase">Despesa</span>}
                  </TableCell>
                  <TableCell>
                    {tx.categoryId ? (
                      <Badge variant="outline" className="border-border text-muted-foreground flex items-center gap-1 w-fit">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tx.categoryColor || '#ccc' }} />
                        {tx.categoryName}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Sem categoria</span>
                    )}
                  </TableCell>
                  <TableCell className={`font-mono ${tx.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {tx.type === 'revenue' ? '+' : '-'}{formatMoney(tx.amount)}
                  </TableCell>
                  <TableCell>
                    {tx.status === 'reconciled' ? (
                      <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted">Conciliada</Badge>
                    ) : (
                      <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30">A conciliar</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {tx.status === 'pending_reconciliation' && user?.role === 'MASTER' && (
                      <Button size="sm" variant="ghost" onClick={() => openReconcile(tx)} className="text-primary hover:text-accent hover:bg-primary/10">
                        Aprovar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!reconcileTxId} onOpenChange={(open) => !open && setReconcileTxId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-serif">Conciliar Transação</DialogTitle>
          </DialogHeader>
          {activeTx && (
            <div className="grid gap-6 py-4">
              <div className="bg-background border border-border p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-lg">{activeTx.description}</div>
                  <div className={`font-mono text-lg ${activeTx.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {activeTx.type === 'revenue' ? '+' : '-'}{formatMoney(activeTx.amount)}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground font-mono">{format(parseISO(activeTx.transactionDate), 'dd/MM/yyyy')}</div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium flex justify-between">
                  Categoria
                  {activeTx.suggestedCategoryName && !reconcileCat && (
                    <span className="text-xs text-primary">Sugestão: {activeTx.suggestedCategoryName}</span>
                  )}
                </label>
                <Select value={reconcileCat} onValueChange={setReconcileCat}>
                  <SelectTrigger className="border-border"><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Observações</label>
                <Input value={reconcileNotes} onChange={e => setReconcileNotes(e.target.value)} className="border-border" />
              </div>

              <div className="flex justify-between mt-4">
                <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(activeTx.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </Button>
                <Button onClick={handleReconcile} disabled={!reconcileCat || reconcileTx.isPending} className="bg-primary text-primary-foreground hover:bg-accent">
                  <CheckCircle className="w-4 h-4 mr-2" /> Conciliar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
