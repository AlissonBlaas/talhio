import { site } from "../site";

export function loader() {
  // Sem o endereço definitivo, o mapa do site não é anunciado (ele teria endereços incompletos).
  const linhas = ["User-agent: *", "Allow: /", ...(site.url ? [`Sitemap: ${site.url}/sitemap.xml`] : [])];
  return new Response(`${linhas.join("\n")}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
