import { Celular } from "../componentes/Celular";
import { FundoDoCampo } from "../componentes/FundoDoCampo";
import { Marca } from "../componentes/Icone";
import { Passadas } from "../componentes/Passadas";
import { antes, conversa, depois, exemplosDePergunta, grupo, integracao, passos, perguntas, recursos, relatorio, sobreAEquipe, sobreAIa, sobreORelatorio } from "../conteudo";
import { contato, site } from "../site";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  const imagem = site.url ? `${site.url}/og.png` : null;
  return [
    { title: site.titulo },
    { name: "description", content: site.descricao },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "pt_BR" },
    { property: "og:site_name", content: site.nome },
    { property: "og:title", content: site.titulo },
    { property: "og:description", content: site.descricao },
    { name: "twitter:card", content: "summary_large_image" },
    // Endereço e imagem só entram quando o domínio definitivo está configurado.
    ...(site.url ? [{ tagName: "link", rel: "canonical", href: `${site.url}/` }, { property: "og:url", content: `${site.url}/` }] : []),
    ...(imagem ? [{ property: "og:image", content: imagem }, { name: "twitter:image", content: imagem }] : []),
    // Dados estruturados: o que é o produto e as perguntas frequentes, para os buscadores.
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: site.nome,
        description: site.descricao,
        applicationCategory: "BusinessApplication",
        operatingSystem: "iOS, Android",
        inLanguage: "pt-BR",
        ...(site.url ? { url: `${site.url}/` } : {}),
      },
    },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: perguntas.map((p) => ({ "@type": "Question", name: p.pergunta, acceptedAnswer: { "@type": "Answer", text: p.resposta } })),
      },
    },
  ];
}

const destino = contato.externo ? { target: "_blank", rel: "noopener" } : {};
const tempoReal = recursos[0];

export default function Home() {
  return (
    <>
      <header className="topo">
        <div className="largura topo-linha">
          <a className="marca" href="/" aria-label="Talhio, início">
            <Marca tamanho={32} />
            Talhio
          </a>
          <nav aria-label="Seções da página">
            <a href="#relatorios">Relatório</a>
            <a href="#ia">IA</a>
            <a href="#planejamento">Planejamento</a>
            <a href="#john-deere">John Deere</a>
            <a href="#perguntas">Perguntas</a>
          </nav>
          <a className="botao botao-pequeno" href={contato.href} {...destino}>
            {contato.rotulo}
          </a>
        </div>
      </header>

      <main>
        <section className="heroi">
          <FundoDoCampo />
          <div className="largura heroi-grade">
            <div className="heroi-texto">
              <h1>
                <span>O agrônomo cuida do que importa.</span>
                <span>O relatório se monta sozinho.</span>
              </h1>
              <p className="heroi-sub">
                O Talhio acompanha as máquinas John Deere, escreve o relatório do dia e responde às suas perguntas com os números da fazenda. Seu tempo fica para olhar a lavoura.
              </p>
              <div className="heroi-acoes">
                <a className="botao" href={contato.href} {...destino}>
                  {contato.rotulo}
                </a>
                <a className="botao botao-contorno" href="#relatorios">
                  Ver o relatório
                </a>
              </div>
            </div>

            <figure className="papel relatorio" aria-label="Exemplo de relatório do dia no Talhio, com dados de demonstração">
              <div className="papel-titulo">
                <h2>Relatório do dia</h2>
                <span>{relatorio.periodo}</span>
              </div>
              <div className="relatorio-numeros">
                {relatorio.numeros.map((numero) => (
                  <div key={numero.rotulo}>
                    <strong>{numero.valor}</strong>
                    <span>{numero.rotulo}</span>
                    <small>{numero.variacao}</small>
                  </div>
                ))}
              </div>
              <div className="relatorio-maquinas">
                {relatorio.maquinas.map((maquina) => (
                  <div key={maquina.nome}>
                    <span>{maquina.nome}</span>
                    <i>
                      <b style={{ width: `${maquina.parte}%` }} />
                    </i>
                    <strong>{maquina.area}</strong>
                  </div>
                ))}
              </div>
              <p className="relatorio-resumo">{relatorio.resumo}</p>
              <p className="legenda">Exemplo com dados de demonstração.</p>
            </figure>
          </div>
        </section>

        <section id="tempo" className="secao">
          <div className="largura">
            <div className="secao-intro">
              <h2>O tempo do agrônomo é da lavoura, não da planilha.</h2>
              <p>Juntar número de máquina, conferir hectare e escrever resumo é trabalho que ninguém vê e que come o fim do dia. O Talhio faz essa parte.</p>
            </div>
            <div className="duas-colunas tempo">
              <div className="tempo-antes">
                <h3>O que toma o seu dia hoje</h3>
                <ul>
                  {antes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="tempo-depois">
                <h3>Com o Talhio</h3>
                <ul>
                  {depois.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="relatorios" className="secao escuro">
          <div className="largura">
            <div className="secao-intro">
              <h2>O relatório chega pronto, e você só confere.</h2>
              <p>Ninguém preenche nada. Os números saem do que as máquinas registraram, com a comparação e um resumo em texto.</p>
            </div>
            <ul className="tres">
              {sobreORelatorio.map((item) => (
                <li key={item.titulo}>
                  <h3>{item.titulo}</h3>
                  <p>{item.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="ia" className="secao">
          <div className="largura duas-colunas">
            <div>
              <div className="secao-intro">
                <h2>Pergunte à IA em vez de abrir tela por tela.</h2>
                <p>A resposta vem do que as máquinas e os talhões da sua fazenda registraram.</p>
              </div>
              <ul className="lista-texto">
                {sobreAIa.map((item) => (
                  <li key={item.titulo}>
                    <h3>{item.titulo}</h3>
                    <p>{item.texto}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="chat-coluna">
              <div className="chat" role="img" aria-label="Exemplo de conversa com a IA do Talhio, com dados de demonstração">
                <div className="chat-topo">
                  <span className="chat-selo">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
                      <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
                    </svg>
                  </span>
                  <div>
                    <strong>Assistente</strong>
                    <span>Conhece máquinas, talhões e relatórios</span>
                  </div>
                </div>
                <div className="chat-mensagens">
                  {conversa.map((fala) => (
                    <p key={fala.texto} className={`fala fala-${fala.de}`}>
                      {fala.texto}
                    </p>
                  ))}
                  <span className="chat-pensando">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className="chat-atalhos">
                  {exemplosDePergunta.map((pergunta) => (
                    <span key={pergunta}>{pergunta}</span>
                  ))}
                </div>
                <div className="chat-campo">
                  <span>Pergunte sobre a fazenda…</span>
                  <b className="chat-mic">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="11" rx="3" />
                      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                    </svg>
                  </b>
                  <b className="chat-enviar">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </b>
                </div>
              </div>
              <p className="legenda">Conversa de exemplo, com dados de demonstração.</p>
            </div>
          </div>
        </section>

        <section id="planejamento">
          <div className="planejar-topo escuro">
            <div className="largura">
              <div className="secao-intro">
                <h2>Planeje o talhão e acompanhe o serviço no mapa.</h2>
                <p>{tempoReal.texto}</p>
                <p className="legenda">Tela de exemplo, com dados de demonstração.</p>
              </div>
              <div className="planejar-celular">
                <Celular />
              </div>
            </div>
          </div>
          <div className="planejar-passos">
            <div className="largura">
              <ol className="passos">
                {passos.map((passo, indice) => (
                  <li key={passo.titulo}>
                    <Passadas feitas={indice + 1} total={passos.length} />
                    <h3>{passo.titulo}</h3>
                    <p>{passo.texto}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="equipe" className="secao secao-verde">
          <div className="largura duas-colunas">
            <div>
              <div className="secao-intro">
                <h2>A equipe recebe a escala e o relatório no WhatsApp.</h2>
                <p>O operador não instala nada nem aprende aplicativo novo. O serviço do dia chega onde ele já olha.</p>
              </div>
              <ul className="lista-texto">
                {sobreAEquipe.map((item) => (
                  <li key={item.titulo}>
                    <h3>{item.titulo}</h3>
                    <p>{item.texto}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mensagens" role="img" aria-label="Exemplo das mensagens de escala e de relatório no grupo da equipe, com dados de demonstração">
                {grupo.map((mensagem) => (
                  <div key={mensagem.titulo} className="papel">
                    <div className="papel-titulo">
                      <h3>{mensagem.titulo}</h3>
                    </div>
                    <div className="mensagem-linhas">
                      {mensagem.linhas.map((linha) => (
                        <span key={linha}>{linha}</span>
                      ))}
                      <small>{mensagem.hora}</small>
                    </div>
                  </div>
                ))}
              </div>
              <p className="legenda">Mensagens de exemplo, com dados de demonstração. Você revisa e envia pelo seu WhatsApp.</p>
            </div>
          </div>
        </section>

        <section id="john-deere" className="secao">
          <div className="largura duas-colunas">
            <div className="secao-intro">
              <h2>Os dados vêm das suas máquinas John Deere.</h2>
              <p>
                O Talhio conversa com o John Deere Operations Center com a autorização da fazenda, dada na página da própria John Deere. Nenhuma senha passa pelo Talhio, e a fazenda cancela o acesso quando quiser.
              </p>
            </div>
            <ul className="integracao">
              {integracao.map((item) => (
                <li key={item.titulo}>
                  <span className={`estado estado-${item.estado === "Pronto" ? "pronto" : "andamento"}`}>{item.estado}</span>
                  <h3>{item.titulo}</h3>
                  <p>{item.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="perguntas" className="secao escuro">
          <div className="largura duas-colunas">
            <div className="secao-intro">
              <h2>O que costumam perguntar.</h2>
            </div>
            <div className="perguntas">
              {perguntas.map((item) => (
                <details key={item.pergunta}>
                  <summary>{item.pergunta}</summary>
                  <p>{item.resposta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contato" className="contato">
          <div className="largura contato-caixa">
            <h2>Quer ver o Talhio na sua fazenda?</h2>
            <p>Estamos abrindo o Talhio para poucas fazendas nesta fase. Conte quantas máquinas John Deere você tem e a gente combina uma demonstração.</p>
            {contato.href === "#contato" ? (
              // Enquanto o contato não estiver no .env, o espaço fica marcado para não ir ao ar sem ele.
              <p className="pendente">[SEU WHATSAPP OU E-MAIL DE CONTATO]</p>
            ) : (
              <a className="botao" href={contato.href} {...destino}>
                {contato.rotulo}
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="rodape">
        <div className="largura rodape-linha">
          <span className="marca">
            <Marca tamanho={26} />
            Talhio
          </span>
          <p>
            © {new Date().getFullYear()} Talhio. John Deere, Operations Center e JDLink são marcas da Deere &amp; Company. O Talhio é um produto independente, sem vínculo com a Deere &amp; Company.
          </p>
        </div>
      </footer>
    </>
  );
}
