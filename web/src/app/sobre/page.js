export const metadata = {
  title: "Sobre o Projeto | Anime Radar",
  description: "Conheça o Anime Radar, um sistema de monitoramento inteligente para o ecossistema anime.",
};

export default function SobrePage() {
  return (
    <div className="flex flex-col gap-12 max-w-4xl animate-fade-in">
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
          <h1 className="!text-4xl md:!text-5xl">Sobre o Anime Radar</h1>
        </div>
        <p className="lead !text-xl text-slate-300">
          Um portal de inteligência editorial focado em extrair relevância do caos informacional do mundo anime.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up delay-100">
        <div className="info-card flex flex-col gap-4">
          <h2 className="text-xl font-bold text-rose-500">Nossa Missão</h2>
          <p className="text-sm leading-relaxed text-slate-400">
            Nascemos da necessidade de um radar centralizado que não apenas agregue links, mas que entenda o conteúdo. 
            Nossa pipeline utiliza heurísticas e inteligência de dados para pontuar a relevância de cada artigo 
            e identificar tendências antes que elas se tornem virais.
          </p>
        </div>
        <div className="info-card flex flex-col gap-4 bg-slate-800/20 border-slate-700/50">
          <h2 className="text-xl font-bold text-sky-500">O que monitoramos?</h2>
          <ul className="text-sm leading-relaxed text-slate-400 list-disc list-inside flex flex-col gap-2">
            <li>Anúncios oficiais de estúdios e editoras</li>
            <li>Trailers e teasers em canais oficiais</li>
            <li>Rumores de fontes verificadas</li>
            <li>Tendências de franquias em redes sociais</li>
            <li>Agenda de lançamentos de episódios e filmes</li>
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-6 animate-fade-in-up delay-200">
        <h2 className="text-2xl font-bold text-slate-100">Tecnologia</h2>
        <div className="info-card !p-8 border-slate-800 bg-slate-900/40">
          <p className="text-base text-slate-400 leading-relaxed mb-6">
            O coração do Anime Radar é uma pipeline de processamento em Node.js que realiza as seguintes etapas:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Ingestão", icon: "📥", text: "Coleta dados de múltiplas fontes simultaneamente." },
              { label: "Deduplicação", icon: "✨", text: "Evita ruído ao identificar artigos repetidos entre fontes." },
              { label: "Scoring", icon: "📊", text: "Calcula relevância baseado em metadados e texto." },
              { label: "Normalização", icon: "🛠️", text: "Padroniza franquias, categorias e datas." },
              { label: "Enrichment", icon: "🚀", text: "Adiciona metadados contextuais para busca avançada." },
              { label: "Storage", icon: "💾", text: "Mantém histórico completo para análise de tendências." }
            ].map(item => (
              <div key={item.label} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
                <span className="text-2xl">{item.icon}</span>
                <h3 className="text-sm font-bold text-slate-100">{item.label}</h3>
                <p className="text-xs text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="info-card bg-rose-500/5 border-rose-500/20 animate-fade-in-up delay-300">
        <h2 className="text-xl font-bold text-rose-500 mb-2">Visão do Futuro</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Continuamos evoluindo para ser a camada de inteligência base para portais editoriais, 
          oferecendo nossa API pública para que outros desenvolvedores possam criar experiências incríveis 
          com os dados que processamos.
        </p>
      </section>
    </div>
  );
}
