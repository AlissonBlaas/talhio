import { existsSync, readdirSync } from "node:fs";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

/**
 * Vídeos de fundo da abertura: todo .mp4 em public/video, em ordem alfabética. Para cada um, usa
 * também o .webm e a capa .jpg de mesmo nome, se existirem. A lista é fixada no build.
 */
function videosDeFundo() {
  const pasta = "public/video";
  const arquivos = existsSync(pasta) ? readdirSync(pasta) : [];
  const irmao = (mp4: string, extensao: string) => {
    const nome = mp4.replace(/\.mp4$/i, extensao);
    return arquivos.includes(nome) ? `/video/${nome}` : null;
  };
  return arquivos
    .filter((arquivo) => /\.mp4$/i.test(arquivo))
    .sort()
    .map((mp4) => ({ mp4: `/video/${mp4}`, webm: irmao(mp4, ".webm"), capa: irmao(mp4, ".jpg") }));
}

export default defineConfig({
  plugins: [reactRouter()],
  define: { __VIDEOS_DE_FUNDO__: JSON.stringify(videosDeFundo()) },
  resolve: {
    tsconfigPaths: true,
  },
});
