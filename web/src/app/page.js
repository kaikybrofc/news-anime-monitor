import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { SafeImage } from "@/components/safe-image";
import { ArticleCard } from "@/components/article-card";
import { fetchMonitor } from "@/lib/api";
import { formatNumber, getArticleDetailPath, getArticleImageUrl, getArticleTitle } from "@/lib/formatters";
import { toAbsoluteSiteUrl } from "@/lib/site-url";

function pickTop(entries = []) {
  if (!Array.isArray(entries) || !entries.length) return null;
  return entries.reduce((best, current) => {
    if (!best) return current;
    return Number(current?.mentions || 0) > Number(best?.mentions || 0) ? current : best;
  }, null);
}

function buildMap(entries = [], keyField = "slug") {
  const map = new Map();
  entries.forEach((entry) => {
    const key = String(entry?.[keyField] || "").trim();
    if (!key) return;
    map.set(key, Number(entry?.mentions || 0));
  });
  return map;
}

function buildDailyBrief(trends24h = {}, trends72h = {}) {
  const upCandidate = pickTop(trends24h?.topFranchises || []);
  const upLabel = upCandidate?.name || "sem destaque";
  const upMentions = Number(upCandidate?.mentions || 0);

  const currentMap = buildMap(trends24h?.topFranchises || [], "slug");
  const previousMap = buildMap(trends72h?.topFranchises || [], "slug");

  let downLabel = "sem recuo claro";
  let downDelta = 0;

  previousMap.forEach((prevMentions, key) => {
    const nowMentions = currentMap.get(key) || 0;
    const delta = nowMentions - prevMentions;
    if (delta < downDelta) {
      downDelta = delta;
      const item = (trends72h?.topFranchises || []).find((entry) => entry?.slug === key);
      downLabel = item?.name || key;
    }
  });

  const previousTopics = new Set(
    (trends72h?.topTopics || [])
      .map((item) => String(item?.topicKey || "").trim())
      .filter(Boolean)
  );
  const emergent = (trends24h?.topTopics || []).find((item) => {
    const key = String(item?.topicKey || "").trim();
    return key && !previousTopics.has(key);
  });

  return [
    `Subiu: ${upLabel} lidera com ${upMentions} menções nas últimas 24h.`,
    `Caiu: ${downLabel}${downDelta < 0 ? ` perdeu ${Math.abs(downDelta)} menções no recorte curto.` : " sem queda relevante no recorte curto."}`,
    `Emergiu: ${emergent?.label || emergent?.topicKey || "nenhum novo tópico forte"}${emergent ? " apareceu entre os temas quentes de 24h." : "."}`,
  ];
}

export const metadata = {
  title: "Anime Radar | Inteligência em Notícias",
  description:
    "Acompanhe notícias de anime em tempo real com contexto editorial, tendências por franquia e leitura guiada para fãs em 2026.",
  alternates: {
    canonical: "/",
  },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let latestPayload = {
    total: 0,
    items: [],
  };
  let errorMessage = "";
  let dailyBrief = [];

  try {
    latestPayload = await fetchMonitor("/articles", { limit: 8, offset: 0 });
  } catch (error) {
    errorMessage = error.message;
  }

  try {
    const [trends24h, trends72h] = await Promise.all([
      fetchMonitor("/trends", { top: 12, windowHours: 24, includeEditorial: 1 }),
      fetchMonitor("/trends", { top: 12, windowHours: 72, includeEditorial: 1 }),
    ]);
    dailyBrief = buildDailyBrief(trends24h, trends72h);
  } catch {
    dailyBrief = [
      "Subiu: monitorando sinais do último ciclo.",
      "Caiu: ainda sem dados suficientes para o comparativo.",
      "Emergiu: novos temas devem aparecer no próximo refresh.",
    ];
  }

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "OmniZap Anime Radar",
    url: toAbsoluteSiteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${toAbsoluteSiteUrl("/busca")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Últimas Notícias de Anime",
    url: toAbsoluteSiteUrl("/"),
    isPartOf: {
      "@type": "WebSite",
      name: "OmniZap Anime Radar",
      url: toAbsoluteSiteUrl("/"),
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: (latestPayload.items || []).slice(0, 8).map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: toAbsoluteSiteUrl(getArticleDetailPath(article)),
        name: getArticleTitle(article),
      })),
    },
  };
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Anime Radar",
    url: toAbsoluteSiteUrl("/"),
    logo: toAbsoluteSiteUrl("/brand/logo-64.png"),
  };

  const dailyHighlights = (latestPayload.items || []).slice(0, 3).map((article, index) => ({
    id: article?.id || `daily-highlight-${index}`,
    title: getArticleTitle(article),
    href: getArticleDetailPath(article),
    image: getArticleImageUrl(article),
    line: dailyBrief[index] || "Sinal editorial do ciclo atual.",
  }));
  const spotlight = dailyHighlights[0] || null;
  const quickSignals = [
    `${formatNumber(latestPayload.total || latestPayload.items?.length || 0)} notícias no radar`,
    `${formatNumber(dailyHighlights.length || dailyBrief.length || 0)} sinais para leitura rápida`,
    "Experiência ajustada para celular",
  ];

  return (
    <div className="page-shell">
      <script type="application/ld+json" suppressHydrationWarning>
        {JSON.stringify([websiteSchema, collectionSchema, organizationSchema])}
      </script>

      <section className="hero-card daily-brief-section animate-fade-in-up">
        <div className="daily-brief-header">
          <div className="section-heading daily-brief-heading">
            <span className="page-kicker">Resumo do Dia</span>
            <h1>O que vale sua atenção agora no radar de anime.</h1>
            <p className="lead">
              Uma abertura pensada para prender a atenção do visitante com leitura rápida, destaques visuais e acesso imediato às notícias mais quentes do ciclo.
            </p>
          </div>

          <div className="daily-brief-actions">
            <div className="badge-row">
              {quickSignals.map((signal) => (
                <span key={signal} className="trend-badge home-hero-badge">
                  {signal}
                </span>
              ))}
            </div>
          </div>
        </div>

        {dailyHighlights.length ? (
          <div className="daily-brief-grid">
            {dailyHighlights[0] ? (
              <Link key={dailyHighlights[0].id} href={dailyHighlights[0].href} className="daily-brief-card daily-brief-card-featured">
                <div className="daily-brief-media daily-brief-media-featured">
                  <SafeImage
                    src={dailyHighlights[0].image}
                    alt={dailyHighlights[0].title || "Imagem da notícia"}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    fallbackClassName="daily-brief-media daily-brief-media-featured"
                  />
                </div>
                <div className="daily-brief-body daily-brief-body-featured">
                  <span className="tag daily-brief-tag">Destaque principal</span>
                  <h3>{dailyHighlights[0].title}</h3>
                  <p>{dailyHighlights[0].line}</p>
                  <span className="daily-brief-cta">
                    Ler notícia
                    <FontAwesomeIcon icon={faArrowRight} />
                  </span>
                </div>
              </Link>
            ) : null}

            <div className="daily-brief-side-stack">
              {dailyHighlights.slice(1).map((item) => (
                <Link key={item.id} href={item.href} className="daily-brief-card daily-brief-card-secondary">
                  <div className="daily-brief-media daily-brief-media-secondary">
                    <SafeImage
                      src={item.image}
                      alt={item.title || "Imagem da notícia"}
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="object-cover"
                      fallbackClassName="daily-brief-media daily-brief-media-secondary"
                    />
                  </div>
                  <div className="daily-brief-body daily-brief-body-secondary">
                    <span className="tag daily-brief-tag">Leitura rápida</span>
                    <h3>{item.title}</h3>
                    <p>{item.line}</p>
                    <span className="daily-brief-cta">
                      Abrir
                      <FontAwesomeIcon icon={faArrowRight} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2 text-sm text-[var(--muted-foreground)]">
            {dailyBrief.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="daily-brief-footer">
          <Link href="/noticias" className="btn btn-primary daily-brief-primary-cta">
            Ver mais notícias
            <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </div>
      </section>

      <section className="relative z-10 flex flex-col gap-8 latest-readings-shell">
        <div className="latest-readings-header">
          <div className="section-heading latest-readings-heading">
            <span className="page-kicker">Últimas leituras</span>
            <h2>As histórias mais recentes que entraram no radar</h2>
            <p className="section-copy">Uma seleção do fluxo mais novo já organizada para leitura rápida e contexto imediato.</p>
          </div>
        </div>

        {errorMessage ? (
          <article className="info-card warning-card animate-fade-in">
            <h3 className="text-[var(--title)]">Falha ao carregar destaque editorial</h3>
            <p>{errorMessage}</p>
          </article>
        ) : null}

        {latestPayload.items?.length ? (
          <div className="article-grid">
            {latestPayload.items.map((article, idx) => (
              <div key={article.id} className="animate-fade-in-up" style={{ animationDelay: `${0.08 * (idx + 1)}s` }}>
                <ArticleCard article={article} prioritizeImage={idx === 0} />
              </div>
            ))}
          </div>
        ) : (
          <article className="empty-state animate-fade-in">
            <p>Nenhuma notícia encontrada no momento.</p>
          </article>
        )}
      </section>

      <section className="home-hero info-card animate-fade-in-up">
        <div className="home-hero-layout">
          <div className="home-hero-copy">
            <span className="eyebrow">Radar editorial mobile-first</span>
            <h2>Continue explorando o radar com uma experiência pensada para celular.</h2>
            <p className="lead">
              Descubra o que ganhou tração, encontre franquias com rapidez e abra as histórias mais relevantes sem sofrer com um layout apertado no celular.
            </p>
          </div>

          <div className="home-hero-side">
            <article className="home-hero-spotlight">
              <span className="page-kicker">Destaque do ciclo</span>
              <h2>{spotlight?.title || "O radar já está acompanhando as próximas movimentações."}</h2>
              <p>{spotlight?.line || dailyBrief[0] || "Abra o monitor para ver o resumo editorial mais recente."}</p>
              <div className="home-hero-spotlight-actions">
                <span className="tag">Leitura guiada</span>
                <Link href={spotlight?.href || "/noticias"} className="btn btn-secondary w-fit !px-5 !py-2 text-xs">
                  {spotlight ? "Abrir destaque" : "Explorar notícias"}
                </Link>
              </div>
            </article>

            <div className="mini-stat-grid home-hero-stat-grid">
              <article className="data-card home-hero-stat-card !p-4">
                <span className="data-card-label">No radar</span>
                <p className="kpi-number !text-[2.2rem]">{formatNumber(latestPayload.total || latestPayload.items?.length || 0)}</p>
                <p className="data-card-note">Itens prontos para descoberta.</p>
              </article>
              <article className="data-card home-hero-stat-card !p-4">
                <span className="data-card-label">Resumo do dia</span>
                <p className="kpi-number !text-[2.2rem]">{formatNumber(dailyHighlights.length || dailyBrief.length || 0)}</p>
                <p className="data-card-note">Sinais editoriais logo na abertura.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
