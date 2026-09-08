import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConciliacaoTab } from "./financeiro/conciliacao-tab";
import { FluxoCaixaTab } from "./financeiro/fluxo-caixa-tab";
import { DreTab } from "./financeiro/dre-tab";
import { ComparativosTab } from "./financeiro/comparativos-tab";
import { RecebiveisTab } from "./financeiro/recebiveis-tab";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";

export default function Financeiro() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif text-primary tracking-wide">Financeiro</h1>
        <Link href="/financeiro/metas">
          <Button variant="outline" className="border-border text-primary hover:bg-primary/10">
            <Target className="w-4 h-4 mr-2" />
            Metas de Receita
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="conciliacao" className="w-full">
        <TabsList className="bg-card border border-border h-12 w-full justify-start rounded-none px-2 mb-6">
          <TabsTrigger value="conciliacao" className="data-[state=active]:bg-background data-[state=active]:text-primary font-medium tracking-wide">Conciliação</TabsTrigger>
          <TabsTrigger value="fluxo" className="data-[state=active]:bg-background data-[state=active]:text-primary font-medium tracking-wide">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="dre" className="data-[state=active]:bg-background data-[state=active]:text-primary font-medium tracking-wide">DRE</TabsTrigger>
          <TabsTrigger value="comparativos" className="data-[state=active]:bg-background data-[state=active]:text-primary font-medium tracking-wide">Comparativos</TabsTrigger>
          <TabsTrigger value="recebiveis" className="data-[state=active]:bg-background data-[state=active]:text-primary font-medium tracking-wide">Recebíveis</TabsTrigger>
        </TabsList>
        <div className="min-h-[500px]">
          <TabsContent value="conciliacao" className="m-0 border-none p-0 outline-none">
            <ConciliacaoTab />
          </TabsContent>
          <TabsContent value="fluxo" className="m-0 border-none p-0 outline-none">
            <FluxoCaixaTab />
          </TabsContent>
          <TabsContent value="dre" className="m-0 border-none p-0 outline-none">
            <DreTab />
          </TabsContent>
          <TabsContent value="comparativos" className="m-0 border-none p-0 outline-none">
            <ComparativosTab />
          </TabsContent>
          <TabsContent value="recebiveis" className="m-0 border-none p-0 outline-none">
            <RecebiveisTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
