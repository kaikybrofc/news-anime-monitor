import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { UnifiedSearch } from "@/components/unified-search";
import { fetchMonitor } from "@/lib/api";
import { getArticleDetailPath, getArticleTitle } from "@/lib/formatters";
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
      target: `${toAbsoluteSiteUrl("/noticias")}?q={search_term_string}`,
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

  return (
    <div className="page-shell">
      <script type="application/ld+json" suppressHydrationWarning>
        {JSON.stringify([websiteSchema, collectionSchema, organizationSchema])}
      </script>

      <section className="relative z-[20] md:z-[220] animate-fade-in-up">
        <UnifiedSearch className="mx-auto w-full max-w-4xl" />
      </section>

      <section className="info-card animate-fade-in-up">
        <div className="section-heading mb-3">
          <span className="page-kicker">Resumo do Dia</span>
          <h2>Leitura rápida em 3 sinais</h2>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-[var(--muted-foreground)]">
          {dailyBrief.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative z-10 flex flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="section-heading">
            <span className="page-kicker">Últimas leituras</span>
            <h2>As histórias mais recentes que entraram no radar</h2>
            <p className="section-copy">Uma seleção do fluxo mais novo já organizada para leitura rápida e contexto imediato.</p>
          </div>
          <Link href="/noticias" className="btn btn-secondary w-fit !px-6 !py-2 text-sm">
            Ver coleção completa
          </Link>
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

    </div>
  );
}
