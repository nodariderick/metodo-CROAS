import { useListActivityLog } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Activity() {
  const { data: activities, isLoading } = useListActivityLog();

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <header className="mb-10">
        <h1 className="font-serif text-4xl text-foreground">Registro de Atividade</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm uppercase">Activity Log / Audit Trail</p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl border border-border bg-card">
          <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-background/50">
            <h2 className="font-medium text-sm tracking-wide">Timeline</h2>
            <div className="font-mono text-xs text-muted-foreground">
              {activities?.length || 0} REGISTROS
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="space-y-6">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex gap-4 animate-pulse opacity-50">
                    <div className="w-16 h-4 bg-muted mt-1"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted w-1/2"></div>
                      <div className="h-3 bg-muted w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent space-y-8">
                {activities.map((activity, i) => {
                  const date = new Date(activity.createdAt);
                  return (
                    <div key={activity.id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-in slide-in-from-bottom-2 duration-500`} style={{ animationFillMode: 'both', animationDelay: `${i * 50}ms` }}>
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 text-primary">
                        {activity.userAvatarUrl ? (
                          <img src={activity.userAvatarUrl} alt={activity.userName || ''} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="font-serif text-xs font-bold">{activity.userName?.charAt(0).toUpperCase() || '?'}</span>
                        )}
                      </div>
                      
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] border border-border bg-background p-4 flex flex-col hover:border-primary/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm text-foreground">{activity.userName || 'Sistema'}</span>
                          <time className="font-mono text-xs text-muted-foreground">
                            {format(date, 'HH:mm:ss', { locale: ptBR })}
                          </time>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {activity.action} <span className="text-foreground">{activity.entityLabel || activity.entityType}</span>
                        </div>
                        {activity.metadata && (
                          <div className="mt-3 pt-3 border-t border-border font-mono text-[10px] text-muted-foreground/70 break-all bg-card/50 p-2">
                            {activity.metadata}
                          </div>
                        )}
                        <div className="mt-3 font-mono text-[10px] text-primary/70 uppercase tracking-widest">
                          {format(date, 'dd MMM yyyy', { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground font-mono text-sm">
                Nenhum registro encontrado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
