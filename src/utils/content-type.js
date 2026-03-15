function inferContentType(article = {}) {
  const sourceId = String(article.sourceId || "").toLowerCase();

  let pathname = "";
  try {
    const url = new URL(article.canonicalUrl || article.url || "");
    pathname = String(url.pathname || "").toLowerCase();
  } catch {
    pathname = "";
  }

  if (sourceId === "animenewsnetwork") {
    if (pathname.startsWith("/daily-briefs/")) return "brief";
    if (pathname.startsWith("/news/")) return "news";
    return "unknown";
  }

  if (sourceId === "animecorner") {
    return "news";
  }

  if (sourceId === "animenew") {
    return "news";
  }

  return "unknown";
}

module.exports = {
  inferContentType,
};
