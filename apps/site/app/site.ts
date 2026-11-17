/** Dados do site que mudam por ambiente. Vêm do `.env` (ver `.env.example`). */
const env = import.meta.env;

const semBarra = (url: string | undefined) => url?.trim().replace(/\/+$/, "") || null;
const soNumeros = (texto: string | undefined) => texto?.replace(/\D/g, "") || null;

export const site = {
  nome: "Talhio",
  titulo: "Talhio · Planeje no aplicativo, o operador recebe no monitor da máquina",
  descricao:
    "O Talhio mostra as máquinas John Deere no mapa, monta a escala da equipe, entrega o relatório do dia pronto e responde às suas perguntas com os números da fazenda.",
  /** Endereço público, sem barra no fim. Nulo enquanto o domínio não estiver definido. */
  url: semBarra(env.VITE_URL_DO_SITE),
  whatsapp: soNumeros(env.VITE_CONTATO_WHATSAPP),
  email: env.VITE_CONTATO_EMAIL?.trim() || null,
};

const MENSAGEM = "Olá! Quero conhecer o Talhio.";

/** Para onde vai o botão de contato: WhatsApp, e-mail ou, sem nenhum dos dois, a seção de contato. */
export const contato = site.whatsapp
  ? { href: `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(MENSAGEM)}`, rotulo: "Falar no WhatsApp", externo: true }
  : site.email
    ? { href: `mailto:${site.email}?subject=${encodeURIComponent("Quero conhecer o Talhio")}`, rotulo: "Enviar e-mail", externo: false }
    : { href: "#contato", rotulo: "Quero testar", externo: false };
