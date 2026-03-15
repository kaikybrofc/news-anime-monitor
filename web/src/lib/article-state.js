function isFetchRestricted(refined = {}) {
  if (refined.fetchRestricted === true) return true;
  if (refined.lastSeenEvent === "fetch_restricted") return true;
  if (refined?.ingestionMeta?.fetchRestricted === true) return true;
  return false;
}

export function getArticleLifecycleBadges(article = {}) {
  const refined = article?.refined || {};
  const badges = [];
  const event = String(refined.lastSeenEvent || "").toLowerCase();

  if (event === "new") {
    badges.push({
      key: "new",
      label: "novo",
      toneClass: "status-new",
    });
  }

  if (event === "updated") {
    badges.push({
      key: "updated",
      label: "atualizado",
      toneClass: "status-updated",
    });
  }

  if (isFetchRestricted(refined)) {
    badges.push({
      key: "restricted",
      label: "restrito",
      toneClass: "status-restricted",
    });
  }

  return badges;
}

