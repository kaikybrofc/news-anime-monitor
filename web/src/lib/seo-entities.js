export const SEO_ENTITY_CONFIG_BY_ROUTE = {
  anime: {
    type: "anime",
    routeBase: "/anime",
    singular: "Anime",
    plural: "Animes",
    lead: "Páginas programáticas com notícias relacionadas a cada anime.",
  },
  personagem: {
    type: "character",
    routeBase: "/personagem",
    singular: "Personagem",
    plural: "Personagens",
    lead: "Páginas programáticas com personagens citados nas notícias.",
  },
  estudio: {
    type: "studio",
    routeBase: "/estudio",
    singular: "Estúdio",
    plural: "Estúdios",
    lead: "Páginas programáticas com estúdios e cobertura associada.",
  },
  tag: {
    type: "tag",
    routeBase: "/tag",
    singular: "Tag",
    plural: "Tags",
    lead: "Páginas programáticas para temas e categorias recorrentes.",
  },
};

export const SEO_ENTITY_CONFIG_BY_TYPE = Object.values(SEO_ENTITY_CONFIG_BY_ROUTE).reduce(
  (acc, config) => {
    acc[config.type] = config;
    return acc;
  },
  {}
);

export function getSeoEntityConfigByRoute(routeKey = "") {
  return SEO_ENTITY_CONFIG_BY_ROUTE[String(routeKey || "").trim()] || null;
}

export function getSeoEntityConfigByType(type = "") {
  return SEO_ENTITY_CONFIG_BY_TYPE[String(type || "").trim()] || null;
}

export function getArticleEntitiesByType(article = {}, type = "") {
  const refined = article?.refined || {};
  const entities = refined.entities || {};

  if (type === "anime") return Array.isArray(entities.anime) ? entities.anime : [];
  if (type === "character") return Array.isArray(entities.characters) ? entities.characters : [];
  if (type === "studio") return Array.isArray(entities.studios) ? entities.studios : [];
  if (type === "tag") return Array.isArray(entities.tags) ? entities.tags : [];

  return [];
}
