import { Animacoes } from "../componentes/Animacoes";
import { Celular } from "../componentes/Celular";
import { FundoDoCampo } from "../componentes/FundoDoCampo";
import { Marca } from "../componentes/Icone";
import { conversa, escala, integracao, noMonitor, paraQuem, perguntas, recursos, relatorio, sobreORelatorio } from "../conteudo";
import { contato, site } from "../site";
import type { CSSProperties } from "react";
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

/** Variável de CSS inline (atraso da animação, tamanho da barra), sem repetir o cast em todo lugar. */
const v = (valores: Record<string, string | number>) => valores as CSSProperties;

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
              <b style={v({ "--parte": maquina.parte })} />
            </i>
            <strong>{maquina.area}</strong>
          </div>
        ))}
      </div>
      <p className="relatorio-resumo">{relatorio.resumo}</p>
    </figure>
  );
}

function Lista({ itens }: { itens: readonly string[] }) {
  return (
    <ul className="linhas">
      {itens.map((item) => (
        <li key={item}>
          {item}
        </li>
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
            <Marca tamanho={26} sobre="auto" />
            Talhio
          </a>
          <nav aria-label="Seções da página">
            <a href="#recursos">Recursos</a>
            <a href="#relatorios">Relatórios</a>
            <a href="#monitor">No monitor</a>
            <a href="#john-deere">John Deere</a>
            <a href="#perguntas">Perguntas</a>
          </nav>
          <a className="botao botao-pequeno" href={contato.href} {...destino}>
            {contato.rotulo}
          </a>
        </div>
      </header>

      <Animacoes />
      <main>
        <section className="heroi">
          <FundoDoCampo />
          <div className="largura heroi-centro">
            <h1>
              <span className="heroi-logo">
                <Marca tamanho={104} sobre="claro" />
                Talhio
              </span>
              <span className="heroi-lema">
                <span className="pal">
                  <b style={v({ "--i": 0 })}>Planeje</b>
                </span>
                <i aria-hidden="true">/</i>
                <span className="pal">
                  <b style={v({ "--i": 1 })}>Opere</b>
                </span>
                <i aria-hidden="true">/</i>
                <span className="pal">
                  <b style={v({ "--i": 2 })}>Relatórios</b>
                </span>
              </span>
              <span className="heroi-passada" aria-hidden="true">
                <i style={v({ "--i": 0 })} />
                <i style={v({ "--i": 1 })} />
                <i style={v({ "--i": 2 })} />
              </span>
            </h1>
          </div>
        </section>

        <section id="produto" className="produto">
          <div className="largura produto-grade">
            <h2 className="gigante produto-titulo">Do planejamento ao relatório, tudo em um só lugar.</h2>
            <div className="produto-texto">
              <p>Organize as operações da fazenda, acompanhe a execução em tempo real e receba relatórios prontos, feitos com os dados das suas máquinas.</p>
            </div>
            <div className="produto-cena">
              <svg className="produto-arcos" viewBox="0 0 1600 640" preserveAspectRatio="xMidYMax slice" fill="none" strokeLinecap="round" aria-hidden="true">
                <path d="M-60 600 Q 520 90 1700 130" stroke="#E7B31F" strokeWidth="40" />
                <path d="M-60 680 Q 600 190 1700 230" stroke="#3F7A2C" strokeWidth="40" />
                <path d="M-60 760 Q 680 290 1700 330" stroke="#15321F" strokeWidth="40" />
              </svg>
              <Celular />
            </div>
          </div>
        </section>

        <section id="recursos" className="recursos-faixa">
          <div className="largura recursos-grade">
            <div className="recursos-titulo">
              <h2 className="gigante">Menos rádio e planilha. Mais tempo na lavoura.</h2>
            </div>
            <ul className="recursos">
              {recursos.map((recurso) => (
                <li key={recurso.titulo}>
                  <h3>{recurso.titulo}</h3>
                  <p>{recurso.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="relatorios" className="relatorios">
          <div className="largura relatorios-grade">
            <div>
              <h2 className="grande">O relatório do dia já chega pronto.</h2>
              <p className="apoio">
                Ninguém preenche nada. Os números saem do que as máquinas registraram e chegam com um resumo escrito.
              </p>
              <Lista itens={sobreORelatorio} />
            </div>
            <div className="relatorios-papel">
              <Relatorio />
              <p className="legenda">Exemplo com dados de demonstração.</p>
            </div>
          </div>
        </section>

        <section className="equipe">
          <div className="largura">
            <div className="linha-demo">
              <div className="texto">
                <h3 className="medio">Escala por turno, no WhatsApp.</h3>
                <p className="apoio">
                  Escolha quem opera cada máquina em cada turno. A escala e as trocas chegam no grupo da equipe.
                </p>
              </div>
              <div className="demo">
                <div className="mensagem" role="img" aria-label="Exemplo de mensagem de escala no grupo da equipe, com dados de demonstração">
                  <strong>{escala.titulo}</strong>
                  {escala.linhas.map((linha) => (
                    <span key={linha}>
                      {linha}
                    </span>
                  ))}
                  <small>{escala.hora}</small>
                </div>
              </div>
            </div>

            <div className="linha-demo inversa">
              <div className="texto">
                <h3 className="medio">Pergunte à IA, por texto ou por voz.</h3>
                <p className="apoio">
                  Ela responde com os dados da sua fazenda e ensina a usar o aplicativo. Os números vêm do sistema: a IA não faz conta de cabeça.
                </p>
              </div>
              <div className="demo">
                <div className="chat" role="img" aria-label="Exemplo de conversa com a IA do Talhio, com dados de demonstração">
                  {conversa.map((fala) => (
                    <p key={fala.texto} className={`fala fala-${fala.de}`}>
                      {fala.texto}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="monitor" className="monitor">
          <div className="largura monitor-grade">
            <div className="monitor-mapa">
              <img src="/mapa-app.jpg" width={1358} height={672} alt="Mapa do aplicativo Talhio: imagem de satélite da fazenda com as máquinas marcadas como trabalhando, paradas ou sem sinal" loading="lazy" decoding="async" />
            </div>
            <div className="monitor-texto">
              <h2 className="grande">O que você planeja chega ao monitor da máquina.</h2>
              <p className="apoio">
                O operador liga o trator e o serviço do dia já está lá. Tudo sai do nosso aplicativo, sem pendrive, sem papel e sem treinamento.
              </p>
              <Lista itens={noMonitor} />
            </div>
          </div>
        </section>

        <section className="publico">
          <div className="largura publico-grade">
            <h2 className="grande publico-titulo">Para quem decide no campo e para quem acompanha de longe.</h2>
            <ul>
              {paraQuem.map((item) => (
                <li key={item.titulo}>
                  <h3>{item.titulo}</h3>
                  <p>{item.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="john-deere" className="integracao">
          <div className="largura integracao-grade">
            <div className="integracao-texto">
              <h2 className="grande">Os dados vêm das suas máquinas John Deere.</h2>
              <p className="apoio">
                O Talhio conversa com o John Deere Operations Center com a autorização da fazenda, dada na página da própria John Deere. Nenhuma senha passa pelo Talhio, e a fazenda cancela o acesso quando quiser.
              </p>
            </div>
            <ul className="etapas">
              {integracao.map((item) => (
                <li key={item.titulo}>
                  <span className={`situacao situacao-${item.estado === "Pronto" ? "pronto" : "andamento"}`}>{item.estado}</span>
                  <div>
                    <h3>{item.titulo}</h3>
                    <p>{item.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="perguntas" className="perguntas">
          <div className="largura perguntas-grade">
            <h2 className="grande perguntas-titulo">O que costumam perguntar.</h2>
            <div className="lista-perguntas">
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
          <div className="largura">
            <div className="contato-caixa">
              <h2 className="gigante">Pronto para evoluir a gestão da sua fazenda?</h2>
              <p>Veja na prática como o Talhio funciona na sua operação. Conte quantas máquinas John Deere você tem e a gente combina uma demonstração.</p>
              {contato.href === "#contato" ? (
                // Enquanto o contato não estiver no .env, o espaço fica marcado para não ir ao ar sem ele.
                <p className="pendente">[SEU WHATSAPP OU E-MAIL DE CONTATO]</p>
              ) : (
                <a className="botao botao-escuro botao-grande" href={contato.href} {...destino}>
                  {contato.rotulo}
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="rodape">
        <div className="largura rodape-linha">
          <a className="marca" href="#" aria-label="Talhio, voltar ao topo">
            <Marca tamanho={30} sobre="escuro" />
            Talhio
          </a>
          <nav aria-label="Seções da página">
            <a href="#recursos">Recursos</a>
            <a href="#relatorios">Relatórios</a>
            <a href="#john-deere">John Deere</a>
            <a href="#perguntas">Perguntas</a>
            <a href="#contato">Contato</a>
          </nav>
        </div>
        <div className="largura rodape-legal">
          <p>
            © {new Date().getFullYear()} Talhio. John Deere, Operations Center e JDLink são marcas da Deere &amp; Company. O Talhio é um produto independente, sem vínculo com a Deere &amp; Company.
          </p>
        </div>
      </footer>
    </>
  );
}
