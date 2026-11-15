import { site } from "../site";

const PAGINAS = ["/"];

export function loader() {
  const base = site.url ?? "";
  const urls = PAGINAS.map((pagina) => `  <url><loc>${base}${pagina}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
