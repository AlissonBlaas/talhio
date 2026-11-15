/**
 * As passadas do talhão, como o mapa do aplicativo as mostra: linha cheia é o que já foi feito,
 * tracejada é o que falta. Aqui mostra em que passo da sequência a pessoa está.
 */
export function Passadas({ feitas, total = 4 }: { feitas: number; total?: number }) {
  return (
    <svg className="passadas" viewBox="0 0 64 36" fill="none" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const y = 5 + (i * 26) / Math.max(total - 1, 1);
        const pronta = i < feitas;
        return <path key={i} d={`M3 ${y}H61`} stroke={pronta ? "var(--milho)" : "currentColor"} strokeOpacity={pronta ? 1 : 0.45} strokeDasharray={pronta ? undefined : "1 7"} />;
      })}
    </svg>
  );
}
