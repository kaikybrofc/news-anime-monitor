import Link from "next/link";
import { clampInt, fetchMonitor, readQueryInt } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/formatters";

export const metadata = {
  title: "Franquias | OmniZap Anime Radar",
  description:
    "Página de franquias com menções, score médio e recorte recente de cobertura das notícias de anime.",
  alternates: {
    canonical: "/franquias",
  },
};

export const dynamic = "force-dynamic";

export default async function FranquiasPage({ searchParams }) {
  const top = clampInt(readQueryInt(searchParams, "top", 30), 1, 100, 30);

  let payload = null;
  let errorMessage = "";

  try {
    payload = await fetchMonitor("/trends", { top });
  } catch (error) {
    errorMessage = error.message;
  }

  const topFranchises = payload?.topFranchises || [];

  return (
    <section className="stack">
      <h1>Franquias</h1>
      <p className="lead">
        Visão agregada por franquia com recorte das tendências recentes.
      </p>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2>Falha ao carregar franquias</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <div className="grid-cards">
        {topFranchises.length ? (
          topFranchises.map((franchise) => (
            <Link
              key={franchise.slug}
              className="info-card link-card"
              href={`/franquias/${franchise.slug}`}
            >
              <h2>{franchise.name}</h2>
              <p>
                {formatNumber(franchise.mentions)} menções ·{" "}
                {formatNumber(franchise.sourceCount)} fontes
              </p>
              <p>Score médio: {formatNumber(franchise.avgScore)}</p>
              <p>Última aparição: {formatDateTime(franchise.lastSeenAt)}</p>
            </Link>
          ))
        ) : (
          <article className="info-card">
            <h2>Sem franquias no momento</h2>
            <p>As franquias em alta aparecerão aqui quando houver dados.</p>
          </article>
        )}
      </div>
    </section>
  );
}
