import { Icone } from "./Icone";

/**
 * Ilustração da tela Início do aplicativo, desenhada em HTML. Os números são de demonstração.
 * É decorativa: o texto da página já diz o que o aplicativo faz.
 */
export function Celular() {
  return (
    <div className="celular" aria-hidden="true">
      <div className="celular-tela">
        <div className="celular-topo">
          <p className="celular-data">terça, 10 de novembro</p>
          <p className="celular-fazenda">Fazenda Boa Vista</p>
          <div className="celular-contagem">
            <div>
              <strong>3</strong>
              <span>Trabalhando</span>
            </div>
            <div>
              <strong className="milho">1</strong>
              <span>Parada</span>
            </div>
            <div>
              <strong>1</strong>
              <span>Sem sinal</span>
            </div>
          </div>
        </div>
        <div className="celular-corpo">
          <div className="celular-mapa">
            <svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice">
              <rect width="300" height="150" fill="#3b4a36" />
              <path d="M0 96 120 60l80 30 100-40v100H0z" fill="#4b5b3f" />
              <path d="M40 22 150 12l22 62-118 26z" fill="rgba(240,138,60,.55)" stroke="#e040fb" strokeWidth="2" />
              <path d="M176 34l92-14 12 74-86 16z" fill="rgba(90,169,230,.45)" stroke="#e040fb" strokeWidth="2" />
              <path d="M52 34 160 22M56 48 164 36M60 62 168 50M64 76 172 64" stroke="#fff" strokeWidth="1" opacity=".7" />
              <circle cx="104" cy="46" r="7" fill="#3f7a2c" stroke="#fff" strokeWidth="2.5" />
              <circle cx="132" cy="68" r="7" fill="#3f7a2c" stroke="#fff" strokeWidth="2.5" />
              <circle cx="222" cy="60" r="7" fill="#3f7a2c" stroke="#fff" strokeWidth="2.5" />
              <circle cx="238" cy="118" r="7" fill="#e7b31f" stroke="#fff" strokeWidth="2.5" />
            </svg>
            <span className="celular-abrir">Abrir mapa</span>
          </div>
          <div className="celular-andamento">
            <div>
              <strong>Plantio da soja</strong>
              <span>68% concluído</span>
            </div>
            <div className="barra">
              <i style={{ width: "68%" }} />
            </div>
          </div>
          <div className="celular-alerta">
            <span className="celular-alerta-icone">
              <Icone nome="atencao" tamanho={16} />
            </span>
            <div>
              <strong>Trator 6M 195 parado há 1h20</strong>
              <span>No talhão 7 desde 11h33, motor desligado.</span>
            </div>
          </div>
          <div className="celular-botoes">
            <span className="celular-botao-cheio">Novo plano</span>
            <span className="celular-botao-contorno">Perguntar à IA</span>
          </div>
        </div>
      </div>
    </div>
  );
}
