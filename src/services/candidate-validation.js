const cheerio = require("cheerio");
const { getWithRetry } = require("../utils/http.js");
const { normalizeHost } = require("../utils/url-normalization.js");

const RSS_PATHS = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml"];
const SITEMAP_PATHS = ["/sitemap.xml", "/sitemap_index.xml", "/robots.txt"];

const TOPIC_WEIGHTS = {
  anime: ["anime", "manga", "otaku", "japanimation", "anim"],
  games: ["game", "gaming", "videogame", "jrpg", "nintendo", "playstation", "xbox", "steam"],
  tech: ["tech", "ai", "software", "cloud", "startup", "dev"],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeUrl(domain, path = "/") {
  return `https://${normalizeHost(domain)}${path.startsWith("/") ? path : `/${path}`}`;
}

function countMatches(text = "", keywords = []) {
  const normalized = String(text || "").toLowerCase();
  return keywords.reduce((acc, keyword) => acc + (normalized.includes(keyword) ? 1 : 0), 0);
}

function parseDateCandidates(text = "") {
  const matches = String(text || "").match(/\d{4}-\d{2}-\d{2}(?:[tT]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/g) || [];
  return matches.map((entry) => {
    const ts = Date.parse(entry);
    return Number.isNaN(ts) ? 0 : ts;
  }).filter(Boolean);
}

function summarizeTopicConfidence(samples = []) {
  const aggregate = { anime: 0, games: 0, tech: 0 };
  const text = samples.join(" ").toLowerCase();
  const totalSignals = Math.max(1, text.split(/\s+/).length / 40);

  Object.entries(TOPIC_WEIGHTS).forEach(([topic, words]) => {
    aggregate[topic] = clamp(countMatches(text, words) / totalSignals, 0, 1);
  });

  return aggregate;
}

async function fetchText(url, context) {
  try {
    const response = await getWithRetry(url, {
      context,
      timeoutMs: 12000,
      maxAttempts: 2,
    });
    return String(response.data || "");
  } catch {
    return "";
  }
}

async function detectRss(domain) {
  for (const path of RSS_PATHS) {
    const url = safeUrl(domain, path);
    const text = await fetchText(url, `Validation/RSS/${domain}`);
    if (text && /<(rss|feed)[\s>]/i.test(text)) {
      return { rssDetected: true, rssUrl: url, rssXml: text };
    }
  }

  const homeUrl = safeUrl(domain, "/");
  const homeHtml = await fetchText(homeUrl, `Validation/HomeRSS/${domain}`);
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    const link = $("link[rel='alternate'][type*='rss'], link[rel='alternate'][type*='atom']").first();
    const href = String(link.attr("href") || "").trim();
    if (href) {
      const rssUrl = href.startsWith("http") ? href : safeUrl(domain, href);
      return { rssDetected: true, rssUrl, rssXml: "", homeHtml };
    }
  }

  return { rssDetected: false, rssUrl: "", rssXml: "", homeHtml };
}

async function detectSitemap(domain) {
  for (const path of SITEMAP_PATHS) {
    const url = safeUrl(domain, path);
    const text = await fetchText(url, `Validation/Sitemap/${domain}`);
    if (!text) continue;

    if (/robots\.txt/i.test(path)) {
      const match = text.match(/^\s*Sitemap:\s*(\S+)/gim);
      if (match && match.length) {
        const first = String(match[0]).split(/:\s*/i).slice(1).join(":").trim();
        if (first) return { sitemapDetected: true, sitemapUrl: first, sitemapXml: "" };
      }
      continue;
    }

    if (/<(urlset|sitemapindex)[\s>]/i.test(text)) {
      return { sitemapDetected: true, sitemapUrl: url, sitemapXml: text };
    }
  }

  return { sitemapDetected: false, sitemapUrl: "", sitemapXml: "" };
}

function estimateActivity(homeHtml = "", rssXml = "", sitemapXml = "") {
  const allDates = [
    ...parseDateCandidates(homeHtml),
    ...parseDateCandidates(rssXml),
    ...parseDateCandidates(sitemapXml),
  ].sort((a, b) => b - a);

  const now = Date.now();
  const recent7d = allDates.filter((ts) => now - ts <= 7 * 24 * 60 * 60 * 1000).length;
  const recent30d = allDates.filter((ts) => now - ts <= 30 * 24 * 60 * 60 * 1000).length;
  const latest = allDates[0] || 0;

  let score = 0;
  if (latest) {
    const daysSinceLast = (now - latest) / (24 * 60 * 60 * 1000);
    score += clamp(40 - Math.floor(daysSinceLast), 0, 40);
  }
  score += clamp(recent7d * 4, 0, 30);
  score += clamp(recent30d, 0, 30);

  return {
    activityScore: clamp(Math.round(score), 0, 100),
    postsLast7d: recent7d,
    postsLast30d: recent30d,
    lastPublishedAt: latest ? new Date(latest).toISOString() : "",
  };
}

function classifySourceAndQuality(input = {}) {
  const text = `${input.homeText || ""} ${input.rssXml || ""} ${input.sitemapXml || ""}`.toLowerCase();
  const hugeVolume = (input.activity?.postsLast7d || 0) > 150;
  const mediumVolume = (input.activity?.postsLast7d || 0) > 60;

  const hasOfficial = /official|press release|comunicado oficial/.test(text);
  const hasForum = /forum|thread|reply|discuss/.test(text);
  const hasAggregator = /via |source:|fontes:|roundup/.test(text);
  const hasAuthorship = /author|by\s+[a-z]|editor|redaç/.test(text);
  const adHeavy = (text.match(/adsbygoogle|doubleclick|taboola|outbrain/g) || []).length >= 3;
  const keywordStuff = /(anime\s+news\s+anime\s+news|best\s+anime\s+best\s+anime)/.test(text);

  let sourceType = "blog";
  if (hasOfficial) sourceType = "official";
  else if (hasForum) sourceType = "forum";
  else if (hasAggregator) sourceType = "aggregator";
  else sourceType = "editorial";

  let spamProbability = 0.08;
  if (mediumVolume) spamProbability += 0.18;
  if (hugeVolume) spamProbability += 0.28;
  if (!hasAuthorship) spamProbability += 0.14;
  if (adHeavy) spamProbability += 0.2;
  if (keywordStuff) spamProbability += 0.2;

  const spam = clamp(Number(spamProbability.toFixed(4)), 0, 0.98);
  const qualityEstimate = clamp(
    Math.round(78 + (hasAuthorship ? 8 : -10) + (adHeavy ? -18 : 0) + (keywordStuff ? -16 : 0) + (hugeVolume ? -10 : 0)),
    0,
    100
  );

  return {
    sourceType,
    qualityEstimate,
    spamProbability: spam,
  };
}

function calculateValidationScore({ topicConfidence, qualityEstimate, activityScore, spamProbability }) {
  const topicScore = clamp(Math.round(Number(topicConfidence || 0) * 100), 0, 100);
  const quality = clamp(Math.round(Number(qualityEstimate || 0)), 0, 100);
  const activity = clamp(Math.round(Number(activityScore || 0)), 0, 100);
  const spamPenalty = clamp(Math.round(Number(spamProbability || 0) * 100), 0, 100);

  const weighted = topicScore * 0.35 + quality * 0.3 + activity * 0.35 - spamPenalty * 0.5;
  return clamp(Math.round(weighted), 0, 100);
}

async function validateCandidate(candidate = {}, options = {}) {
  const domain = normalizeHost(candidate.domain || "");
  if (!domain) return null;

  const rss = await detectRss(domain);
  const sitemap = await detectSitemap(domain);
  const homeUrl = safeUrl(domain, "/");
  const homeHtml = rss.homeHtml || (await fetchText(homeUrl, `Validation/Home/${domain}`));

  const topicBreakdown = summarizeTopicConfidence([
    homeHtml,
    rss.rssXml,
    sitemap.sitemapXml,
    ...(candidate.sampleUrls || []),
  ]);

  const activity = estimateActivity(homeHtml, rss.rssXml, sitemap.sitemapXml);
  const topicConfidence = clamp(
    Math.max(Number(candidate.topicConfidence || 0), topicBreakdown.anime),
    0,
    1
  );

  const sourceAndQuality = classifySourceAndQuality({
    homeText: homeHtml,
    rssXml: rss.rssXml,
    sitemapXml: sitemap.sitemapXml,
    activity,
  });

  const validationScore = calculateValidationScore({
    topicConfidence,
    qualityEstimate: sourceAndQuality.qualityEstimate,
    activityScore: activity.activityScore,
    spamProbability: sourceAndQuality.spamProbability,
  });

  const status = validationScore > (Number(options.approvalThreshold) || 75) ? "validated" : "rejected";

  return {
    domain,
    rssDetected: rss.rssDetected,
    rssUrl: rss.rssUrl,
    sitemapDetected: sitemap.sitemapDetected,
    sitemapUrl: sitemap.sitemapUrl,
    activityScore: activity.activityScore,
    topicConfidence: Number(topicConfidence.toFixed(4)),
    topicBreakdown,
    qualityEstimate: sourceAndQuality.qualityEstimate,
    spamProbability: sourceAndQuality.spamProbability,
    sourceType: sourceAndQuality.sourceType,
    validationScore,
    status,
    sandboxStatus: status === "validated" ? "ready" : "not_started",
    sandboxDays: status === "validated" ? 7 : 0,
    inspectedUrls: [homeUrl, rss.rssUrl, sitemap.sitemapUrl].filter(Boolean),
    signals: {
      postsLast7d: activity.postsLast7d,
      postsLast30d: activity.postsLast30d,
      lastPublishedAt: activity.lastPublishedAt,
      referenceCount: Number(candidate.referenceCount || 0),
      uniqueArticles: Number(candidate.uniqueArticles || 0),
    },
  };
}

async function validateCandidates(candidates = [], options = {}) {
  const output = [];
  for (const candidate of candidates) {
    const validated = await validateCandidate(candidate, options);
    if (validated) output.push(validated);
  }
  return output;
}

module.exports = {
  validateCandidates,
};
