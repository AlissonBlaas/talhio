/** Lista dos vídeos de fundo, montada no build pelo vite.config.ts a partir de public/video. */
declare const __VIDEOS_DE_FUNDO__: { mp4: string; webm: string | null; capa: string | null }[];

/** Fontes hospedadas no próprio site: só importam CSS. */
declare module "@fontsource/*";
