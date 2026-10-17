require("dotenv").config();
const cheerio = require("cheerio");
const natural = require("natural");
const logger = require("../utils/logger.js");
const { getWithRetry, toPositiveInt } = require("../utils/http.js");
const { extractTitleFromHtml } = require("../utils/article-utils.js");

const SUMMARY_MAX_INPUT_CHARS = toPositiveInt(
  process.env.SUMMARY_MAX_INPUT_CHARS,
  12000
);
const SUMMARY_MAX_OUTPUT_CHARS = toPositiveInt(
  process.env.SUMMARY_MAX_OUTPUT_CHARS,
  650
);
const SUMMARY_MAX_SENTENCES = 3;
const SUMMARY_GENERIC_ERROR_MESSAGE = "Ocorreu um erro durante o resumo.";
const sentenceTokenizer = new natural.SentenceTokenizer();
const wordTokenizer = new natural.WordTokenizer();
const summaryStopWords = new Set(
  "a ao aos as com como da das de dela dele depois do dos e ela elas ele eles em entre era essa esse esta este eu foi foram ha isso isto mais mas me minha muito na nas no nos nossa o os ou para pela pelo pelas pelos por qual que quem se sem ser seu sua sao somente tambem tem um uma umas uns voce voces anime animacao news manga japanese season studio show serie new update episode latest based official says"
    .split(/\s+/)
);

function normalizeArticleText(text) {
  return String(text || "")
    .replace(/<[^>\n]{1,400}>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\r\n]{2,}/g, " ")
    .trim();
}

function cleanArticleDom($) {
  const noiseSelectors = [
    "script",
    "style",
    "noscript",
    "template",
    "iframe",
    "svg",
    "canvas",
    "form",
    "nav",
    "footer",
    "header",
    "aside",
    ".advert",
    ".ads",
    ".ad",
    ".social",
    ".share",
    ".sharing",
    ".related",
    ".recommended",
    ".comments",
    ".comment",
    ".newsletter",
    ".subscribe",
    ".breadcrumbs",
    ".breadcrumb",
    ".author-box",
    ".post-tags",
    ".tag-list",
  ];

  noiseSelectors.forEach((selector) => $(selector).remove());
}

function resolveArticleSelectors(options = {}) {
  const sourceSelectors = Array.isArray(options?.sourceConfig?.articleContentSelectors)
    ? options.sourceConfig.articleContentSelectors
    : [];
  const domain = String(options?.sourceConfig?.domains?.[0] || "")
    .trim()
    .toLowerCase();
  const domainSpecificSelectors = {
    "animenew.com.br": [
      ".inner-post-entry.entry-content",
      ".inner-post-entry",
      ".entry-content",
    ],
    "animenewsnetwork.com": [".meat", ".news", "article"],
    "nintendolife.com": [".article_body", "article .content", "article"],
    "pcgamer.com": [".article-body", ".article-content", "article"],
    "ign.com": [".article-page", ".article-content", "article"],
  };

  return [
    ...sourceSelectors,
    ...(domainSpecificSelectors[domain] || []),
    ".inner-post-entry.entry-content",
    ".inner-post-entry",
    ".entry-content",
    "article [itemprop='articleBody']",
    ".article-content",
    ".post-content",
    "article",
    "main",
    "body",
  ];
}

function extractArticleText(htmlContent, options = {}) {
  const $ = cheerio.load(htmlContent);
  cleanArticleDom($);

  const candidates = resolveArticleSelectors(options).map((selector) =>
    $(selector).text()
  );
  return (
    candidates
      .map((value) => normalizeArticleText(value))
      .find((value) => value && value.length > 120) || ""
  );
}

function tokenizeForScoring(text) {
  return wordTokenizer
    .tokenize(String(text || "").toLowerCase())
    .map((token) => token.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    .filter(
      (token) =>
        token.length > 2 &&
        !summaryStopWords.has(token) &&
        !/^\d+$/.test(token)
    );
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function buildExtractiveSummary(articleText, title = "") {
  const sentences = sentenceTokenizer
    .tokenize(String(articleText || ""))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 25);
  if (!sentences.length) return truncateText(articleText, SUMMARY_MAX_OUTPUT_CHARS);

  const tokensBySentence = sentences.map(tokenizeForScoring);
  const tfidf = new natural.TfIdf();
  tokensBySentence.forEach((tokens) => tfidf.addDocument(tokens.join(" ")));
  const titleTokens = new Set(tokenizeForScoring(title));

  const ranked = sentences.map((sentence, index) => {
    const terms = tfidf
      .listTerms(index)
      .filter(({ term }) => !summaryStopWords.has(term));
    const lexicalScore =
      terms.reduce((total, term) => total + term.tfidf, 0) /
      Math.sqrt(Math.max(tokensBySentence[index].length, 1));
    const titleMatches = tokensBySentence[index].filter((term) =>
      titleTokens.has(term)
    ).length;

    return {
      index,
      sentence,
      score: lexicalScore + titleMatches * 1.25 + 0.15 / (index + 1),
    };
  });

  const selected = ranked
    .sort((left, right) => right.score - left.score)
    .slice(0, SUMMARY_MAX_SENTENCES)
    .sort((left, right) => left.index - right.index)
    .map(({ sentence }) => sentence)
    .join(" ");

  return truncateText(selected, SUMMARY_MAX_OUTPUT_CHARS);
}

async function summarizeHtml(htmlContent, options = {}) {
  try {
    const articleText = extractArticleText(htmlContent, options);
    if (!articleText) {
      logger.warn("[Resumo] Não foi possível extrair o texto do artigo.");
      return "Não foi possível extrair o conteúdo para resumo.";
    }

    const limitedText = articleText.slice(0, SUMMARY_MAX_INPUT_CHARS);
    const title = extractTitleFromHtml(htmlContent);
    const summary = buildExtractiveSummary(limitedText, title);
    logger.info(`[Resumo] Resumo extrativo local gerado (${summary.length} caracteres).`);
    return summary;
  } catch (error) {
    logger.error("[Resumo] Erro ao gerar resumo:", error.message || error);
    return SUMMARY_GENERIC_ERROR_MESSAGE;
  }
}

function translateTitleToPtBr(title = "") {
  return Promise.resolve(String(title || "").trim());
}

async function summarizeUrl(url, options = {}) {
  if (!url) throw new Error("URL inválida para resumo.");

  const { context = "Resumo/FetchURL", headers } = options;
  logger.info(`[Resumo] Buscando conteúdo para: ${url}`);
  const response = await getWithRetry(url, { context, headers });
  return summarizeHtml(response.data, options);
}

module.exports = {
  summarizeHtml,
  summarizeUrl,
  translateTitleToPtBr,
  SUMMARY_GENERIC_ERROR_MESSAGE,
};