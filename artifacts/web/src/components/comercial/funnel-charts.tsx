import { useState } from 'react';
import { 
  useGetConversionFunnel, 
  useGetConversionByOrigin 
} from '@workspace/api-client-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FunnelCharts() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { data: funnelData = [], isLoading: isLoadingFunnel } = useGetConversionFunnel({ year, month });
  const { data: originData = [], isLoading: isLoadingOrigin } = useGetConversionByOrigin({ year, month });

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm font-mono">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground capitalize">{entry.name}:</span>
              <span className="text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={handlePrevMonth} className="rounded-none border-border bg-card">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-serif text-2xl min-w-[200px] text-center">
            {monthNames[month - 1]} <span className="text-muted-foreground">{year}</span>
          </h2>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className="rounded-none border-border bg-card">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 flex-1 min-h-[400px]">
        {/* Funnel Chart */}
        <div className="bg-card border border-border p-6 flex flex-col">
          <h3 className="font-serif text-xl text-primary mb-6">Funil de Vendas</h3>
          {isLoadingFunnel ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono">Carregando...</div>
          ) : funnelData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">Sem dados para este período</div>
          ) : (
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={funnelData}
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#222019" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#8A7F6E" tick={{ fill: '#8A7F6E', fontSize: 12, fontFamily: 'monospace' }} />
                  <YAxis dataKey="stage" type="category" stroke="#8A7F6E" tick={{ fill: '#F3ECDD', fontSize: 12 }} width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Leads" fill="#D69A21" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Origin Chart */}
        <div className="bg-card border border-border p-6 flex flex-col">
          <h3 className="font-serif text-xl text-primary mb-6">Conversão por Origem</h3>
          {isLoadingOrigin ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono">Carregando...</div>
          ) : originData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">Sem dados para este período</div>
          ) : (
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={originData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#222019" vertical={false} />
                  <XAxis dataKey="origin" stroke="#8A7F6E" tick={{ fill: '#F3ECDD', fontSize: 12 }} />
                  <YAxis stroke="#8A7F6E" tick={{ fill: '#8A7F6E', fontSize: 12, fontFamily: 'monospace' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} />
                  <Bar dataKey="total" name="Total de Leads" fill="#473f32" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="closed" name="Fechados (Ganho)" fill="#D69A21" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
