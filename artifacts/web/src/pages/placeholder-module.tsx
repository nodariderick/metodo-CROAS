export default function PlaceholderModule({ title }: { title: string }) {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700">
      <header className="mb-10">
        <h1 className="font-serif text-4xl text-foreground">{title}</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm uppercase">Módulo Operacional</p>
      </header>

      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full border border-border bg-card p-10 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          
          <div className="w-16 h-16 mx-auto border border-primary/30 flex items-center justify-center mb-6 text-primary">
            <span className="font-mono text-xl">{'//'}</span>
          </div>
          
          <h2 className="font-serif text-2xl text-foreground mb-4">Módulo em Construção</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            A infraestrutura para {title.toLowerCase()} está sendo desenvolvida com precisão.
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-background">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <span className="font-mono text-xs text-primary uppercase tracking-widest">ETA: EM BREVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
