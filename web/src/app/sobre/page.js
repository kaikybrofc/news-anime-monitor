export const metadata = {
  title: "Sobre | OmniZap Anime Radar",
};

export default function SobrePage() {
  return (
    <section className="stack">
      <h1>Sobre</h1>
      <p className="lead">
        Projeto focado em monitoramento de noticias anime com consolidacao,
        deduplicacao e enriquecimento de dados.
      </p>
      <article className="info-card">
        <h2>Escopo atual</h2>
        <p>
          Fontes suportadas: AnimeNew, Anime Corner e Anime News Network.
          Historico de aparicao e score ja fazem parte do pipeline.
        </p>
      </article>
    </section>
  );
}
