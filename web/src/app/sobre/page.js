export const metadata = {
  title: "Sobre | OmniZap Anime Radar",
};

export default function SobrePage() {
  return (
    <section className="stack">
      <h1>Sobre</h1>
      <p className="lead">
        Projeto focado no monitoramento de notícias de anime, com consolidação,
        deduplicação e enriquecimento de dados.
      </p>
      <article className="info-card">
        <h2>Escopo atual</h2>
        <p>
          Fontes suportadas: AnimeNew, Anime Corner e Anime News Network.
          Histórico de aparição e score já fazem parte do pipeline.
        </p>
      </article>
    </section>
  );
}
