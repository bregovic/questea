// Vytvoří URL slug z názvu (bez diakritiky, malá písmena, pomlčky).
export function slugify(input: string): string {
  const base = (input || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // odstranit diakritiku
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "blog";
}
