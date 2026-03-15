function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategories(categories = []) {
  return Array.from(
    new Set(
      (Array.isArray(categories) ? categories : [])
        .map((category) => normalizeText(category))
        .filter(Boolean)
    )
  );
}

function normalizeCategoriesForMatching(categories = []) {
  return Array.from(
    new Set(
      normalizeCategories(categories)
        .map((category) => category.toLowerCase())
        .filter(Boolean)
    )
  );
}

function categoriesMatchRequired(categories = [], requiredCategories = []) {
  if (!requiredCategories || !requiredCategories.length) {
    return true;
  }

  const normalized = new Set(normalizeCategoriesForMatching(categories));

  return requiredCategories.some((required) =>
    normalized.has(normalizeText(required).toLowerCase())
  );
}

module.exports = {
  normalizeText,
  normalizeCategories,
  normalizeCategoriesForMatching,
  categoriesMatchRequired,
};
