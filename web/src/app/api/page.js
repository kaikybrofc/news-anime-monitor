export const metadata = {
  title: "Documentação da API | Anime Radar",
  description: "Acesse os dados processados pelo Anime Radar através de nossa API REST pública.",
};

export default function ApiPage() {
  const endpoints = [
    { method: "GET", path: "/articles", desc: "Lista notícias com filtros de busca, fonte e score." },
    { method: "GET", path: "/articles/:id", desc: "Retorna o detalhe completo de um artigo específico." },
    { method: "GET", path: "/trends", desc: "Retorna as tendências de franquias, fontes e tópicos." },
    { method: "GET", path: "/sources", desc: "Lista todas as fontes monitoradas pelo sistema." },
    { method: "GET", path: "/franchises", desc: "Lista as franquias mapeadas na base de dados." }
  ];

  return (
    <div className="flex flex-col gap-12 animate-fade-in">
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-rose-500 rounded-full" />
          <h1 className="!text-4xl">Documentação da API</h1>
        </div>
        <p className="lead max-w-2xl text-slate-300">
          Integre o poder do Anime Radar em sua aplicação. Nossa API REST fornece acesso 
          estruturado a todo o conteúdo processado pela pipeline.
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fade-in-up delay-100">
        <div className="lg:col-span-2 flex flex-col gap-8">
          <div className="info-card !p-8 border-slate-800 bg-slate-900/40">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Endpoints Disponíveis</h2>
            <div className="flex flex-col gap-4">
              {endpoints.map((ep) => (
                <div key={ep.path} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-4 group hover:border-rose-500/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black bg-rose-500/10 text-rose-500 px-2 py-1 rounded border border-rose-500/20">{ep.method}</span>
                    <code className="text-sm font-bold text-slate-300 group-hover:text-rose-400 transition-colors">{ep.path}</code>
                  </div>
                  <p className="text-sm text-slate-500 flex-1">{ep.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="info-card !p-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Exemplo de Requisição</h2>
            <div className="bg-slate-950 rounded-2xl p-6 font-mono text-sm overflow-x-auto border border-slate-800 shadow-2xl">
              <p className="text-emerald-400 mb-4">// Buscar últimas notícias com score &gt; 50</p>
              <pre className="text-slate-300">
{`curl -X GET "https://api.animeradar.com/v1/articles?limit=5&scoreMin=50" \\
     -H "Content-Type: application/json"`}
              </pre>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          <div className="info-card flex flex-col gap-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">Informações Técnicas</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Formato</span>
                <span className="text-sm font-semibold text-slate-200">JSON (UTF-8)</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Autenticação</span>
                <span className="text-sm font-semibold text-rose-400">Pública (v1)</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Rate Limit</span>
                <span className="text-sm font-semibold text-slate-200">60 req / min</span>
              </div>
            </div>
          </div>

          <div className="info-card bg-emerald-500/5 border-emerald-500/20">
            <h3 className="text-sm font-bold text-emerald-500 mb-2">Ambiente de Teste</h3>
            <p className="text-xs text-emerald-700 leading-normal mb-4">
              Você pode testar nossa API diretamente via Swagger em nosso ambiente de sandbox.
            </p>
            <button className="btn btn-secondary !text-xs !py-2 w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
              Abrir Sandbox
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}
