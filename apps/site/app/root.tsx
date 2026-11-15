import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import "@fontsource/outfit/600";
import "@fontsource/outfit/700";
import "@fontsource/outfit/800";
import "@fontsource/nunito-sans/400";
import "@fontsource/nunito-sans/400-italic";
import "@fontsource/nunito-sans/600";
import "./site.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#15321F" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const naoEncontrada = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="erro">
      <h1>{naoEncontrada ? "Página não encontrada" : "Algo deu errado"}</h1>
      <p>{naoEncontrada ? "O endereço que você abriu não existe no site do Talhio." : "Tente abrir a página de novo em instantes."}</p>
      <a className="botao botao-broto" href="/">
        Voltar ao início
      </a>
    </main>
  );
}
