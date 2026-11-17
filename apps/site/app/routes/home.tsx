import { Celular } from "../componentes/Celular";
import { FundoDoCampo } from "../componentes/FundoDoCampo";
import { Icone, Marca } from "../componentes/Icone";
import { MapaDaFazenda } from "../componentes/MapaDaFazenda";
import { conversa, escala, integracao, noMonitor, paraQuem, perguntas, pilares, relatorio, sobreORelatorio } from "../conteudo";
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

function Relatorio() {
  return (
    <figure className="relatorio" aria-label="Exemplo de relatório do dia no Talhio, com dados de demonstração">
      <figcaption>
        <strong>Relatório do dia</strong>
        <span>{relatorio.periodo}</span>
      </figcaption>
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
    </figure>
  );
}

function Lista({ itens }: { itens: readonly string[] }) {
  return (
    <ul className="lista-feito">
      {itens.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <>
      <header className="topo">
        <div className="largura topo-linha">
          <a className="marca" href="/" aria-label="Talhio, início">
            <Marca tamanho={26} sobre="escuro" />
            Talhio
          </a>
          <nav aria-label="Seções da página">
            <a href="#produto">Produto</a>
            <a href="#monitor">No monitor</a>
            <a href="#relatorios">Relatórios</a>
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
          <div className="largura heroi-centro">
            <h1>
              <span className="heroi-logo">
                <Marca tamanho={104} sobre="escuro" />
                Talhio
              </span>
              <span className="heroi-lema">
                Planeje <i aria-hidden="true">/</i> Opere <i aria-hidden="true">/</i> Relatórios
              </span>
            </h1>
            <p className="heroi-sub">O agrônomo planeja pelo aplicativo. O operador recebe tudo no monitor da máquina.</p>
            <div className="heroi-acoes">
              <a className="botao" href={contato.href} {...destino}>
                {contato.rotulo}
              </a>
              <a className="botao botao-vidro" href="#produto">
                Conhecer o produto
              </a>
            </div>
            <a className="heroi-seta" href="#produto" aria-label="Descer para o produto">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 9 7 7 7-7" />
              </svg>
            </a>
          </div>
        </section>

        <section id="produto" className="secao">
          <div className="largura duas-colunas">
            <div>
              <div className="secao-intro">
                <p className="sobretitulo">Gestão de operações no campo</p>
                <h2>Do planejamento ao relatório, tudo em um só lugar.</h2>
                <p>Organize as operações da fazenda, acompanhe a execução em tempo real e receba relatórios prontos, feitos com os dados das suas máquinas.</p>
              </div>
              <ul className="pilares">
                {pilares.map((pilar) => (
                  <li key={pilar.titulo}>
                    <Icone nome={pilar.icone} tamanho={28} />
                    {pilar.titulo}
                  </li>
                ))}
              </ul>
            </div>
            <div className="vitrine">
              <svg className="vitrine-arcos" viewBox="0 0 400 300" fill="none" strokeLinecap="round" aria-hidden="true">
                <path d="M40 300 Q150 40 420 30" stroke="#E7B31F" strokeWidth="26" />
                <path d="M96 300 Q190 96 420 84" stroke="#3F7A2C" strokeWidth="26" />
                <path d="M152 300 Q230 150 420 138" stroke="#15321F" strokeWidth="26" />
              </svg>
              <Celular />
            </div>
          </div>
        </section>

        <section id="monitor" className="secao">
          <div className="largura">
            <div className="faixa duas-colunas">
              <div className="faixa-mapa">
                <MapaDaFazenda />
                <div className="faixa-legenda" aria-hidden="true">
                  <span>
                    <i className="traco traco-feito" />
                    Realizado <strong>72%</strong>
                  </span>
                  <span>
                    <i className="traco traco-falta" />
                    Pendente <strong>28%</strong>
                  </span>
                </div>
              </div>
              <div>
                <div className="secao-intro">
                  <p className="sobretitulo">Direto no monitor</p>
                  <h2>O que você planeja chega ao monitor da máquina.</h2>
                  <p>O operador liga o trator e o serviço do dia já está lá. Tudo sai do nosso aplicativo, sem pendrive, sem papel e sem treinamento.</p>
                </div>
                <Lista itens={noMonitor} />
              </div>
            </div>
          </div>
        </section>

        <section id="relatorios" className="secao">
          <div className="largura duas-colunas">
            <div>
              <div className="secao-intro">
                <p className="sobretitulo">Dados das máquinas em ação</p>
                <h2>Relatórios automáticos e confiáveis.</h2>
                <p>Ninguém preenche nada. Os números saem do que as máquinas registraram e chegam com um resumo escrito.</p>
              </div>
              <Lista itens={sobreORelatorio} />
            </div>
            <div>
              <Relatorio />
              <p className="legenda">Exemplo com dados de demonstração.</p>
            </div>
          </div>
        </section>

        <section className="secao">
          <div className="largura quadro">
            <article className="cartao">
              <div className="cartao-texto">
                <h3>Escala por turno, no WhatsApp</h3>
                <p>Escolha quem opera cada máquina em cada turno. A escala e as trocas chegam no grupo da equipe.</p>
              </div>
              <div className="mensagem" role="img" aria-label="Exemplo de mensagem de escala no grupo da equipe, com dados de demonstração">
                <strong>{escala.titulo}</strong>
                {escala.linhas.map((linha) => (
                  <span key={linha}>{linha}</span>
                ))}
                <small>{escala.hora}</small>
              </div>
            </article>

            <article className="cartao">
              <div className="cartao-texto">
                <h3>Pergunte à IA, por texto ou por voz</h3>
                <p>Ela responde com os dados da sua fazenda e ensina a usar o aplicativo. Os números vêm do sistema: a IA não faz conta de cabeça.</p>
              </div>
              <div className="chat" role="img" aria-label="Exemplo de conversa com a IA do Talhio, com dados de demonstração">
                {conversa.map((fala) => (
                  <p key={fala.texto} className={`fala fala-${fala.de}`}>
                    {fala.texto}
                  </p>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="secao">
          <div className="largura">
            <div className="secao-intro centro">
              <p className="sobretitulo">Para diferentes realidades</p>
              <h2>Soluções que se adaptam à sua fazenda.</h2>
            </div>
            <ul className="para-quem">
              {paraQuem.map((item) => (
                <li key={item.titulo}>
                  <span>
                    <Icone nome={item.icone} tamanho={26} />
                  </span>
                  <div>
                    <h3>{item.titulo}</h3>
                    <p>{item.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="john-deere" className="secao">
          <div className="largura">
            <div className="painel">
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
          </div>
        </section>

        <section id="perguntas" className="secao">
          <div className="largura estreita">
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

        <section id="contato" className="secao contato">
          <div className="largura">
            <div className="contato-caixa">
              <h2>Pronto para evoluir a gestão da sua fazenda?</h2>
              <p>Veja na prática como o Talhio funciona na sua operação. Conte quantas máquinas John Deere você tem e a gente combina uma demonstração.</p>
              {contato.href === "#contato" ? (
                // Enquanto o contato não estiver no .env, o espaço fica marcado para não ir ao ar sem ele.
                <p className="pendente">[SEU WHATSAPP OU E-MAIL DE CONTATO]</p>
              ) : (
                <a className="botao botao-milho" href={contato.href} {...destino}>
                  {contato.rotulo}
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="rodape">
        <div className="largura rodape-linha">
          <span className="marca">
            <Marca tamanho={24} sobre="escuro" />
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
