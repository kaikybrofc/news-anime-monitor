import Link from "next/link";

export const metadata = {
  title: "Sobre | OmniZap Anime Radar",
  description:
    "Conheça a proposta, a inteligência editorial e a evolução do OmniZap Anime Radar para monitoramento de notícias de anime.",
};

const valuePillars = [
  {
    title: "Missão",
    text: "Transformar o fluxo acelerado de notícias de anime em leitura priorizada, contextualizada e útil para quem acompanha o setor em tempo real.",
  },
  {
    title: "Valor para quem acompanha",
    text: "Menos ruído, menos repetição e mais clareza para descobrir o que realmente importa entre anúncios, trailers, estreias e movimentos de franquias.",
  },
  {
    title: "Valor para produtos editoriais",
    text: "Uma base de dados pronta para alimentar portais, rankings, páginas temáticas, dashboards e experiências de descoberta via API.",
  },
];

const pipelineSteps = [
  {
    label: "Ingestão contínua",
    text: "Coleta múltiplas fontes em ciclos recorrentes para manter o radar sempre atualizado.",
  },
  {
    label: "Deduplicação",
    text: "Reduz o ruído identificando coberturas repetidas e agrupando sinais equivalentes.",
  },
  {
    label: "Normalização",
    text: "Padroniza datas, entidades, categorias e estrutura editorial para leitura consistente.",
  },
  {
    label: "Enriquecimento",
    text: "Adiciona contexto útil para busca, relacionamento entre conteúdos e navegação temática.",
  },
  {
    label: "Scoring editorial",
    text: "Classifica relevância com base em texto, metadados, recorrência e força do assunto no ecossistema.",
  },
  {
    label: "Distribuição",
    text: "Entrega os dados em páginas, rankings, tendências e endpoints para consumo externo.",
  },
];

const coveragePoints = [
  "Anúncios oficiais de estúdios, distribuidoras, editoras e plataformas.",
  "Trailers, teasers, visuais e materiais promocionais relevantes.",
  "Atualizações recorrentes de franquias com alta tração no público anime.",
  "Movimentos editoriais com potencial de tendência, repercussão ou virada de interesse.",
  "Cobertura contínua de fontes consolidadas para ampliar contexto e reduzir pontos cegos.",
];

const editorialCriteria = [
  "Relevância do tema para o público anime e para a conversa editorial do momento.",
  "Frescor temporal para destacar o que acabou de surgir ou voltou a ganhar força.",
  "Recorrência entre fontes, sinais e desdobramentos de uma mesma pauta.",
  "Peso de franquias, personagens, estúdios e entidades envolvidas.",
  "Qualidade do contexto disponível para transformar notícia em leitura orientada.",
  "Redução de ruído com controle de duplicidade e priorização de informação útil.",
];

const roadmapItems = [
  {
    title: "Mais cobertura",
    text: "Expandir o número de fontes e ampliar o alcance de sinais relevantes no ecossistema anime.",
  },
  {
    title: "Mais inteligência temática",
    text: "Aprofundar relações por franquia, personagem, estúdio, tag e entidades SEO.",
  },
  {
    title: "API mais robusta",
    text: "Evoluir o consumo programático para experiências externas, integrações e produtos derivados.",
  },
  {
    title: "Leitura editorial mais rica",
    text: "Refinar ranking, tendências e contexto para destacar impacto e não apenas volume.",
  },
];

const proofPoints = ["Monitoramento contínuo", "Priorização editorial", "Cobertura multiplataforma"];

export default function SobrePage() {
  return (
    <div className="page-shell animate-fade-in">
      <section className="editorial-hero">
        <div className="flex flex-col gap-8">
          <div className="flex max-w-4xl flex-col gap-4">
            <span className="eyebrow animate-fade-in-up">Inteligência editorial para o ecossistema anime</span>
            <h1 className="animate-fade-in-up delay-100">
              O Anime Radar filtra o ruído e destaca o que realmente move o mundo anime.
            </h1>
            <p className="lead animate-fade-in-up delay-200">
              Mais do que agregar links, o projeto organiza sinais, classifica relevância e transforma notícias dispersas em uma experiência de descoberta mais clara, rápida e útil.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 animate-fade-in-up delay-300">
            <Link href="/api" className="btn btn-primary !px-8 !py-4 text-base">
              Explorar API
            </Link>
            <Link href="/contato" className="btn btn-secondary !px-8 !py-4 text-base">
              Falar com o projeto
            </Link>
          </div>

          <div className="flex flex-wrap gap-3 animate-fade-in-up delay-300">
            {proofPoints.map((item) => (
              <span key={item} className="status-badge">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6 animate-fade-in-up delay-100">
        <div className="section-heading">
          <span className="page-kicker">Proposta de valor</span>
          <h2>Por que o projeto existe</h2>
          <p className="section-copy">
            O volume de publicações sobre anime cresce o tempo todo, mas volume sem priorização gera atraso, duplicidade e leitura fragmentada. O Anime Radar existe para transformar esse cenário em contexto acionável.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {valuePillars.map((item, index) => (
            <article key={item.title} className="info-card flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: `${0.1 * (index + 1)}s` }}>
              <h3>{item.title}</h3>
              <p className="text-sm text-[var(--muted-foreground)]">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6 animate-fade-in-up delay-200">
        <div className="section-heading">
          <span className="page-kicker">Pipeline</span>
          <h2>Como a inteligência editorial funciona</h2>
          <p className="section-copy">
            A pipeline do Anime Radar converte fluxo bruto em informação navegável. Cada etapa ajuda a remover ruído, consolidar contexto e destacar o que merece atenção primeiro.
          </p>
        </div>

        <article className="info-card flex flex-col gap-6 !p-8">
          <p className="max-w-3xl text-base text-[var(--muted-foreground)]">
            O núcleo do sistema combina processamento contínuo, enriquecimento de dados e priorização por relevância para sustentar tanto o portal quanto usos futuros via API e produtos derivados.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pipelineSteps.map((item, index) => (
              <div key={item.label} className="info-card !p-5 flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: `${0.08 * (index + 1)}s` }}>
                <span className="page-kicker">Etapa {String(index + 1).padStart(2, "0")}</span>
                <h3 className="text-base">{item.label}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">{item.text}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel-grid animate-fade-in-up delay-300">
        <article className="info-card flex flex-col gap-5">
          <div className="section-heading">
            <span className="page-kicker">Cobertura</span>
            <h2>O que entra no radar</h2>
          </div>

          <div className="flex flex-col gap-3">
            {coveragePoints.map((item) => (
              <div key={item} className="line-item">
                <p className="text-sm text-[var(--muted-foreground)]">{item}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="info-card flex flex-col gap-5 bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]">
          <div className="section-heading">
            <span className="page-kicker">Critérios editoriais</span>
            <h2>Como definimos relevância</h2>
          </div>

          <div className="flex flex-col gap-3">
            {editorialCriteria.map((item) => (
              <div key={item} className="line-item">
                <p className="text-sm text-[var(--muted-foreground)]">{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="flex flex-col gap-6 animate-fade-in-up delay-300">
        <div className="section-heading">
          <span className="page-kicker">Roadmap</span>
          <h2>Para onde o Anime Radar está evoluindo</h2>
          <p className="section-copy">
            O projeto continua avançando para se tornar uma camada de inteligência cada vez mais reutilizável para leitura, análise e distribuição de notícias do universo anime.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {roadmapItems.map((item, index) => (
            <article key={item.title} className="info-card flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: `${0.08 * (index + 1)}s` }}>
              <h3>{item.title}</h3>
              <p className="text-sm text-[var(--muted-foreground)]">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="animate-fade-in-up delay-300">
        <article className="info-card split-card !p-8 md:!p-10 bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className="page-kicker">Próximo passo</span>
            <h2 className="!text-3xl">Quer explorar os dados ou acompanhar a evolução do projeto?</h2>
            <p className="text-[var(--muted-foreground)]">
              A página da API mostra os endpoints disponíveis e a rota de contato centraliza sugestões, suporte e oportunidades de colaboração.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link href="/api" className="btn btn-primary">
              Ver documentação da API
            </Link>
            <Link href="/contato" className="btn btn-secondary">
              Ir para contato
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
