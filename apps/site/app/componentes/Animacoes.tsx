import { useEffect } from "react";

/**
 * Só uma coisa com a rolagem: o menu. No topo da página ele é o header normal; depois que a marca e a frase da
 * abertura saem da tela por cima, o <html> ganha "menu-visivel" e o menu vira a pílula suspensa (ver .topo em
 * site.css). O resto da página não anima: o conteúdo aparece parado, no lugar.
 */
export function Animacoes() {
  useEffect(() => {
    const abertura = document.querySelector(".heroi h1");
    if (!abertura || !("IntersectionObserver" in window)) return;
    const raiz = document.documentElement;
    const olho = new IntersectionObserver(([e]) => {
      if (e) raiz.classList.toggle("menu-visivel", !e.isIntersecting && e.boundingClientRect.bottom <= 0);
    });
    olho.observe(abertura);
    return () => {
      olho.disconnect();
      raiz.classList.remove("menu-visivel");
    };
  }, []);
  return null;
}
