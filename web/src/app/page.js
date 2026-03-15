import Link from "next/link";

const highlights = [
  "Agregacao de multiplas fontes com filtros por origem.",
  "Pipeline com dedupe, score e historico de aparicao.",
  "Pronto para portal editorial e API publica.",
];

export default function HomePage() {
  return (
    <section className="stack">
      <div className="hero-card">
        <p className="eyebrow">OmniZap Anime Radar</p>
        <h1>Noticias e inteligencia anime em uma unica camada.</h1>
        <p>
          Este frontend e a base do portal: navegacao pronta, layout responsivo e
          estrutura para evoluir paginas editoriais e tecnicas.
        </p>
        <div className="hero-actions">
          <Link href="/noticias" className="btn btn-primary">
            Ver noticias
          </Link>
          <Link href="/api" className="btn btn-secondary">
            Explorar API
          </Link>
        </div>
      </div>

      <div className="grid-cards">
        {highlights.map((item) => (
          <article key={item} className="info-card">
            <p>{item}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
