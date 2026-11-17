const DESENHOS = {
  mapa: ["m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z", "M9 3v15", "M15 6v15"],
  plano: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4z"],
  escala: ["M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M8 2v4", "M16 2v4", "M3 10h18"],
  relatorio: ["M3 3v18h18", "M7 15l4-4 3 3 5-6"],
  assistente: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"],
  talhao: ["M4 8 13 4l7 5-3 11-11-2z", "M4 8h.01", "M13 4h.01", "M20 9h.01", "M17 20h.01", "M6 18h.01"],
  importar: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  seta: ["M5 12h14", "m12 5 7 7-7 7"],
  atencao: ["M12 9v4", "M12 17h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
} as const;

export type NomeDoIcone = keyof typeof DESENHOS;

/** Ícone de traço, decorativo (o texto ao lado diz o que é). */
export function Icone({ nome, tamanho = 22 }: { nome: NomeDoIcone; tamanho?: number }) {
  return (
    <svg aria-hidden="true" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {DESENHOS[nome].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Símbolo oficial: quatro passadas curvas, três feitas (cheias) e uma por fazer (tracejada). `sobre` diz a cor do fundo onde ele vai ("auto": a cor do texto em volta). */
export function Marca({ tamanho = 28, sobre = "claro" }: { tamanho?: number; sobre?: "claro" | "escuro" | "auto" }) {
  // "auto" usa a cor do texto em volta (o menu muda de cor quando fica suspenso).
  const base = sobre === "claro" ? "#15321F" : sobre === "escuro" ? "#FFFFFF" : "currentColor";
  return (
    <svg aria-hidden="true" width={(tamanho * 136) / 111} height={tamanho} viewBox="12 16 136 111" fill="none" strokeLinecap="round">
      <path d="M18 58 Q66 21 142 23" stroke="#E7B31F" strokeWidth="13" />
      <path d="M18 84 Q68 48 142 49" stroke="#3F7A2C" strokeWidth="13" />
      <path d="M18 110 Q69 75 142 75" stroke={base} strokeWidth="13" />
      <path d="M41 121 Q86 96 142 100" stroke={base} strokeWidth="11" strokeDasharray="12 14" />
    </svg>
  );
}
