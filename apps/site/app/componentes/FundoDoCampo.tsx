import { useState } from "react";

const VIDEOS = __VIDEOS_DE_FUNDO__;

/**
 * Fundo da abertura: os vídeos do campo, por cima de um fundo animado de linhas de plantio.
 * Com um vídeo, ele repete; com vários, tocam em sequência e recomeçam. Sem vídeo em
 * `public/video` (ou se a pessoa pediu menos movimento), fica só o fundo animado.
 * Tudo aqui é decorativo.
 */
export function FundoDoCampo() {
  const [indice, setIndice] = useState(0);
  const video = VIDEOS[indice % Math.max(VIDEOS.length, 1)];
  const unico = VIDEOS.length === 1;

  return (
    <div className="fundo-campo" aria-hidden="true">
      <div className="fundo-linhas" />
      {video ? (
        <video
          // Trocar a chave recria o elemento: é o jeito simples de passar para o vídeo seguinte.
          key={video.mp4}
          className="fundo-video"
          autoPlay
          muted
          playsInline
          loop={unico}
          preload="metadata"
          poster={video.capa ?? undefined}
          tabIndex={-1}
          onEnded={() => setIndice((atual) => (atual + 1) % VIDEOS.length)}
          // Vídeo que não carrega não trava a sequência.
          onError={() => !unico && setIndice((atual) => (atual + 1) % VIDEOS.length)}>
          {video.webm ? <source src={video.webm} type="video/webm" /> : null}
          <source src={video.mp4} type="video/mp4" />
        </video>
      ) : null}
      <div className="fundo-sombra" />
    </div>
  );
}
