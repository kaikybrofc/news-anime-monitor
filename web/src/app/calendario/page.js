import Link from "next/link";
import { PageKicker } from "@/components/page-kicker";
import { SafeImage } from "@/components/safe-image";
import { CalendarCarouselCenter } from "@/components/calendar-carousel-center";
import { CalendarCarouselControls } from "@/components/calendar-carousel-controls";
import { clampInt, fetchMonitor, readQueryInt, readQueryString } from "@/lib/api";
import { formatNumber, summarizeTextBySentence } from "@/lib/formatters";

export const metadata = {
  title: "Calendario Otaku | OmniZap Anime Radar",
  description:
    "Calendario editorial com estreias, episodios, filmes, jogos e eventos detectados automaticamente pelo monitor.",
  alternates: {
    canonical: "/calendario",
  },
};

export const dynamic = "force-dynamic";

const TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "premiere", label: "Estreias" },
  { value: "episode", label: "Episodios" },
  { value: "movie", label: "Filmes" },
  { value: "game", label: "Jogos" },
  { value: "event", label: "Eventos" },
  { value: "announcement", label: "Anuncios" },
];

const CONFIDENCE_OPTIONS = [
  { value: "", label: "Qualquer confianca" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media+" },
  { value: "low", label: "Baixa+" },
];

function formatCalendarDay(dayKey = "") {
  const parsed = new Date(`${dayKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return dayKey || "sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function confidenceLabel(value = "") {
  if (value === "high") return "Alta";
  if (value === "medium") return "Media";
  if (value === "low") return "Baixa";
  return "Nao definida";
}

function getUtcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function compareDayKeys(dayA = "", dayB = "") {
  const parsedA = new Date(`${dayA}T00:00:00.000Z`);
  const parsedB = new Date(`${dayB}T00:00:00.000Z`);
  if (Number.isNaN(parsedA.getTime()) || Number.isNaN(parsedB.getTime())) return 0;
  return parsedA.getTime() - parsedB.getTime();
}

function diffDaysFrom(dayKey = "", referenceKey = "") {
  const parsedDay = new Date(`${dayKey}T00:00:00.000Z`);
  const parsedReference = new Date(`${referenceKey}T00:00:00.000Z`);
  if (Number.isNaN(parsedDay.getTime()) || Number.isNaN(parsedReference.getTime())) return null;
  return Math.round((parsedDay.getTime() - parsedReference.getTime()) / 86400000);
}

function relativeDayLabel(dayKey = "", todayKey = "") {
  const diff = diffDaysFrom(dayKey, todayKey);
  if (diff === null) return "Data indefinida";
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanha";
  if (diff === -1) return "Ontem";
  if (diff > 1) return `Em ${formatNumber(diff)} dias`;
  return `${formatNumber(Math.abs(diff))} dias atras`;
}

function getCalendarEventImage(event = {}) {
  const raw = String(event?.image || event?.article?.image || "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:image/svg+xml")) return "";
  return raw;
}

function buildQueryHref(basePath, params = {}, overrides = {}) {
  const merged = {
    ...params,
    ...overrides,
  };
  const search = new URLSearchParams();
  Object.entries(merged).forEach(([key, value]) => {
    const text = String(value || "").trim();
    if (!text) return;
    search.set(key, text);
  });
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export default async function CalendarioPage(props) {
  const resolvedProps = await props;
  const searchParams = await resolvedProps?.searchParams;

  const daysAhead = clampInt(readQueryInt(searchParams, "daysAhead", 45), 1, 180, 45);
  const daysBack = clampInt(readQueryInt(searchParams, "daysBack", 7), 0, 60, 7);
  const windowHours = clampInt(readQueryInt(searchParams, "windowHours", 24 * 45), 24, 24 * 120, 24 * 45);
  const limitPerDay = clampInt(readQueryInt(searchParams, "limitPerDay", 12), 3, 40, 12);

  const type = readQueryString(searchParams, "type", "").trim().toLowerCase();
  const confidence = readQueryString(searchParams, "confidence", "").trim().toLowerCase();
  const sourceId = readQueryString(searchParams, "source", "").trim().toLowerCase();
  const franchise = readQueryString(searchParams, "franchise", "").trim().toLowerCase();
  const from = readQueryString(searchParams, "from", "").trim();
  const to = readQueryString(searchParams, "to", "").trim();

  const currentParams = {
    daysAhead,
    daysBack,
    windowHours,
    limitPerDay,
    type,
    confidence,
    source: sourceId,
    franchise,
    from,
    to,
  };

  let payload = {
    generatedAt: "",
    totals: { days: 0, events: 0 },
    days: [],
  };
  let errorMessage = "";

  try {
    payload = await fetchMonitor("/calendar", currentParams);
  } catch (error) {
    errorMessage = error.message;
  }

  const todayKey = getUtcDayKey();
  const sortedDays = [...(payload?.days || [])].sort((a, b) => compareDayKeys(a?.day || "", b?.day || ""));

  const pastDays = [];
  const todayDays = [];
  const futureDays = [];

  sortedDays.forEach((dayBlock) => {
    const compareWithToday = compareDayKeys(dayBlock?.day || "", todayKey);
    if (compareWithToday < 0) {
      pastDays.push(dayBlock);
      return;
    }
    if (compareWithToday > 0) {
      futureDays.push(dayBlock);
      return;
    }
    todayDays.push(dayBlock);
  });

  const timelineDays = [
    ...pastDays.map((dayBlock) => ({ ...dayBlock, bucket: "past" })),
    ...todayDays.map((dayBlock) => ({ ...dayBlock, bucket: "today" })),
    ...futureDays.map((dayBlock) => ({ ...dayBlock, bucket: "future" })),
  ];

  return (
    <div className="page-shell">
      <section className="page-intro animate-fade-in">
        <div className="section-heading">
          <PageKicker>Planejamento editorial</PageKicker>
          <h1>Calendario Otaku</h1>
          <p className="lead">
            Um painel para acompanhar datas relevantes de estreias, episodios, filmes, jogos e eventos usando sinais extraidos automaticamente das noticias monitoradas.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card animate-fade-in">
          <h2 className="text-[var(--title)]">Falha ao carregar calendario</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <section className="calendar-timeline-shell animate-fade-in-up delay-100">
        <article className="calendar-now-banner">
          <div>
            <span className="tag">Referencia de hoje</span>
            <h2>{formatCalendarDay(todayKey)}</h2>
            <p>Use essa marca para separar rapidamente o que ja passou do que ainda vem pela frente.</p>
          </div>
          <div className="calendar-now-actions">
            <span className="trend-badge">Hoje</span>
            <CalendarCarouselControls />
          </div>
        </article>

        {timelineDays.length ? (
          <div className="calendar-carousel" data-calendar-carousel>
            <CalendarCarouselCenter />
            <div className="calendar-carousel-spacer" aria-hidden="true" />
            {timelineDays.map((dayBlock, index) => (
              <article
                key={dayBlock.day || `day-${index}`}
                className={`list-panel calendar-carousel-item ${dayBlock.bucket === "today" ? "is-today" : ""}`}
                data-day-bucket={dayBlock.bucket || "future"}
              >
                <div className="calendar-carousel-chip-row">
                  <span className={`calendar-carousel-dot ${dayBlock.bucket || "future"}`} />
                  <span className="trend-badge">{dayBlock.bucket === "past" ? "Passado" : dayBlock.bucket === "today" ? "Hoje" : "Futuro"}</span>
                  <span className="tag">{formatNumber(dayBlock.total || 0)} evento(s)</span>
                </div>

                <div className="calendar-day-panel">
                  <div className="calendar-day-header">
                    <div>
                      <h2 className="text-base capitalize">{formatCalendarDay(dayBlock.day)}</h2>
                      <p className="text-xs text-[var(--muted)]">{relativeDayLabel(dayBlock.day, todayKey)}</p>
                    </div>
                  </div>

                  <div className="list-stack">
                    {(dayBlock.items || []).map((event) => (
                      <Link
                        key={`${event.articleId}-${event.day}`}
                        href={event.newsSlug ? `/noticias/${event.newsSlug}` : "/noticias"}
                        className="line-link calendar-event-link"
                      >
                        <div className="calendar-event-layout">
                          <div className="calendar-event-thumb">
                            <SafeImage
                              src={getCalendarEventImage(event)}
                              alt={event.title || "Imagem da noticia"}
                              fill
                              sizes="(max-width: 640px) 84px, 96px"
                              className="object-cover"
                              fallbackClassName="calendar-event-thumb"
                            />
                          </div>

                          <div className="calendar-event-copy">
                            <div className="calendar-event-title-row">
                              <strong className="line-clamp-2">{event.title || "Evento sem titulo"}</strong>
                              <span className="trend-badge whitespace-nowrap">{event.typeLabel}</span>
                            </div>
                            <span>
                              {event.sourceName} · confianca {confidenceLabel(event.confidence)} · score{" "}
                              {formatNumber(event.score || 0)}
                            </span>
                            {event.franchise?.slug ? (
                              <span>Franquia: {event.franchise.name || event.franchise.slug}</span>
                            ) : null}
                            {event.summary ? <span>{summarizeTextBySentence(event.summary, 180)}</span> : null}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            ))}
            <div className="calendar-carousel-spacer" aria-hidden="true" />
          </div>
        ) : (
          <article className="empty-state">
            <h2 className="mb-2 !text-2xl">Sem eventos no recorte atual</h2>
            <p>Tente ampliar os dias futuros ou reduzir o filtro de confianca para aumentar a cobertura.</p>
          </article>
        )}
      </section>

      <section className="metric-strip animate-fade-in-up delay-50">
        <article className="data-card">
          <span className="data-card-label">Dias com agenda</span>
          <p className="kpi-number">{formatNumber(payload?.totals?.days || 0)}</p>
          <p className="data-card-note">Dias agrupados no recorte atual.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Eventos detectados</span>
          <p className="kpi-number">{formatNumber(payload?.totals?.events || 0)}</p>
          <p className="data-card-note">Itens consolidados por artigo.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Janela futura</span>
          <p className="kpi-number">{formatNumber(daysAhead)}d</p>
          <p className="data-card-note">Alcance de agenda para frente.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Confianca minima</span>
          <p className="kpi-number">{confidenceLabel(confidence)}</p>
          <p className="data-card-note">Com base na data detectada.</p>
        </article>
      </section>

      <section className="calendar-lane-grid animate-fade-in-up delay-75">
        <article className="data-card">
          <span className="data-card-label">Eventos passados</span>
          <p className="kpi-number">{formatNumber(pastDays.reduce((total, day) => total + (day?.total || 0), 0))}</p>
          <p className="data-card-note">Linha do tempo antes de {formatCalendarDay(todayKey)}.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Hoje</span>
          <p className="kpi-number">{formatNumber(todayDays.reduce((total, day) => total + (day?.total || 0), 0))}</p>
          <p className="data-card-note">Eventos marcados para o dia atual.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Eventos futuros</span>
          <p className="kpi-number">{formatNumber(futureDays.reduce((total, day) => total + (day?.total || 0), 0))}</p>
          <p className="data-card-note">Agenda prevista para os proximos dias.</p>
        </article>
      </section>

      <section className="info-card animate-fade-in-up delay-75">
        <div className="section-heading">
          <PageKicker>Filtros rapidos</PageKicker>
          <h2>Refine o calendario</h2>
          <p className="section-copy">
            Ajuste tipo de evento, confianca e horizonte temporal para focar no que faz sentido para sua pauta.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((option) => (
            <Link
              key={`type-${option.value || "all"}`}
              href={buildQueryHref("/calendario", currentParams, { type: option.value })}
              className={`tag ${type === option.value ? "trend-badge" : ""}`}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CONFIDENCE_OPTIONS.map((option) => (
            <Link
              key={`conf-${option.value || "all"}`}
              href={buildQueryHref("/calendario", currentParams, { confidence: option.value })}
              className={`tag ${confidence === option.value ? "trend-badge" : ""}`}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[30, 45, 60, 90].map((value) => (
            <Link
              key={`ahead-${value}`}
              href={buildQueryHref("/calendario", currentParams, { daysAhead: value })}
              className={`tag ${daysAhead === value ? "trend-badge" : ""}`}
            >
              +{value} dias
            </Link>
          ))}
        </div>

        <div className="mt-4 meta-stack">
          <span>
            Filtros ativos: tipo <strong>{type || "todos"}</strong>, confianca{" "}
            <strong>{confidenceLabel(confidence)}</strong>, fonte{" "}
            <strong>{sourceId || "todas"}</strong>, franquia <strong>{franchise || "todas"}</strong>.
          </span>
          <span>
            Atualizado em: <strong>{payload?.generatedAt ? new Date(payload.generatedAt).toLocaleString("pt-BR") : "sem dado"}</strong>
          </span>
        </div>
      </section>
    </div>
  );
}
