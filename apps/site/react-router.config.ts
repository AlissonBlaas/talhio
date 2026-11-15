import type { Config } from "@react-router/dev/config";

export default {
  // O site é gerado como HTML pronto na hora do build (melhor para o Google e para abrir rápido
  // no 4G) e publicado como arquivos estáticos: não precisa de servidor Node.
  ssr: false,
  prerender: ["/", "/sitemap.xml", "/robots.txt"],
} satisfies Config;
