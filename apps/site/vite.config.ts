import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

/**
 * Vídeo de fundo da abertura: fica no S3 (fora do build do site, em /media/hero) e o site usa o link dele.
 * Trocar o vídeo = subir outro arquivo para o mesmo endereço (ou mudar o link abaixo) e gerar o site de novo.
 * Mesmo nome com .mp4 (H.264), .webm (usado primeiro) e .jpg (capa que aparece antes de carregar).
 */
// Caminho do mesmo site (www.talhio.com.br/media/hero/1-soja.*): funciona em HTTP e em HTTPS, sem "conteúdo misto".
const VIDEO_DO_FUNDO = "/media/hero/1-soja";
const videosDeFundo = () => [{ mp4: `${VIDEO_DO_FUNDO}.mp4`, webm: `${VIDEO_DO_FUNDO}.webm`, capa: `${VIDEO_DO_FUNDO}.jpg` }];

export default defineConfig({
  plugins: [reactRouter()],
  define: { __VIDEOS_DE_FUNDO__: JSON.stringify(videosDeFundo()) },
  resolve: {
    tsconfigPaths: true,
  },
});
