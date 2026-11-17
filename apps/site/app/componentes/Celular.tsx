/**
 * A tela Início do aplicativo, como ela é: uma captura de tela de verdade, só com o nome da fazenda trocado
 * (pedido do Alisson: "esse é o app, não invente"). Para atualizar, troque `public/app-inicio.webp`.
 */
export function Celular() {
  return (
    <div className="celular">
      <img src="/app-inicio.webp" width={780} height={1688} alt="Tela Início do aplicativo Talhio: máquinas trabalhando, paradas e sem sinal, o mapa da fazenda e os atalhos para novo plano e para a IA" loading="lazy" decoding="async" />
    </div>
  );
}
