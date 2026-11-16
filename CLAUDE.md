# Talhio

Monorepo do app de gestão de máquinas agrícolas: o admin planeja no app, o trator recebe o plano,
o operador só confirma, e o relatório chega pronto.

- `apps/mobile` — React Native + Expo (Expo Router, rotas em `src/app`). App do admin e do agrônomo.
- `apps/api` — NestJS (ESM, Vitest). Prefixo `/v1`, porta 3333.
- `apps/site` — site público (landing) em React Router 8 em modo framework, o sucessor do Remix.
  Gerado como HTML estático no build (`ssr: false` + `prerender`), sem servidor Node. `pnpm site`
  abre em http://localhost:5180. Texto em `app/conteudo.ts`; endereço e contato em `.env`
  (`VITE_URL_DO_SITE`, `VITE_CONTATO_WHATSAPP`, `VITE_CONTATO_EMAIL`; ver `.env.example`). Sem o
  endereço, não publica canonical, og:image nem sitemap. SEO: metas, Open Graph, JSON-LD
  (SoftwareApplication e FAQPage), `/sitemap.xml` e `/robots.txt`. Só afirma o que o app já faz.
  Visual do site (refeito em 10/11, a pedido do Alisson, para não parecer gerado por IA): conceito da
  "passada" (linha cheia = feito, tracejada = falta; o símbolo, os passos e o relatório usam isso).
  Verde lavoura `#15321F` (fundos escuros) e verde médio `#2E6A39` (seção da equipe), milho `#E7B31F`
  (destaque/feito), folha `#3F7A2C`, algodão `#F1F2EC`, papel `#FBFAF4`. Fontes Outfit (títulos e números) e Nunito Sans (texto), as mesmas do app, hospedadas no próprio site com
  `@fontsource` (importe sem `.css`, ex.: `@fontsource/outfit/700`). Formas sempre arredondadas (botões em pílula, relatório em papel de cantos redondos, balões de conversa, o celular imita a tela Início do app). CSS em `app/site.css`; variáveis de contexto
  `--fg`, `--fg-suave`, `--linha`, `--destaque`. Sem cartões, ícones repetidos, rótulos em caixa-alta
  nem palavra destacada no título; a peça central é o relatório em papel na abertura. As fontes condensadas (Big Shoulders e Source Serif) foram trocadas porque o Alisson não gostou. Posicionamento (decisão do Alisson): "o agrônomo cuida
  do que importa, o relatório se monta sozinho" (vende o tempo e a atenção do agrônomo). Ordem das
  seções: tempo do agrônomo, relatórios, IA, planejamento (com tempo real), equipe (WhatsApp), John
  Deere, perguntas, contato. Sem selo
  de "em testes" na abertura. A John Deere já tem
  Work Planner e está lançando o assistente de IA "JD" no Operations Center (previsto para a América
  Latina até o fim de 2026): não prometer no site nada que só ela entrega. Vídeos de fundo da abertura: todo `.mp4` em `public/video` entra (lista montada no build pelo
  `vite.config.ts`); com vários, tocam em sequência; sem nenhum, fundo animado de fileiras.
  `react` e `react-dom` ficam na MESMA versão do app (hoisted): não deixar duas versões no monorepo.
- `packages/shared` — contrato da API: schemas Zod e tipos usados nas duas pontas.
- `packages/deere` — porta para a John Deere: interface `ProvedorMaquinas`, `FakeProvedor` e `DeereProvedor`.

## Comandos

```bash
pnpm install
pnpm build            # compila packages/* (necessário antes de rodar os apps)
pnpm api              # API em http://localhost:3333/v1 (dados falsos por padrão)
pnpm ios              # compila o app nativo e abre no simulador iOS (porta 8082)
pnpm android          # o mesmo para o emulador Android
pnpm mobile           # só o servidor do Expo, quando o app já está instalado no simulador
pnpm typecheck && pnpm test
```

Depois de mudar `packages/*`, rode `pnpm build` (ou `pnpm dev`, que deixa em watch).
No app, instale bibliotecas com `npx expo install <pacote>` dentro de `apps/mobile`.

O app usa código nativo (mapa MapLibre), então **não roda no Expo Go**: é um development build.
`pnpm ios` e `pnpm android` já compilam os pacotes antes de subir. Depois de instalar uma biblioteca
com código nativo, rode `pnpm ios` de novo para recompilar.

## Regras de arquitetura (valem para todo código novo)

Geral
- Organizar por funcionalidade, não por tipo técnico.
- `apps/*` importam de `packages/*`, nunca o contrário. `mobile` e `api` não importam um do outro.
- Todo tipo ou schema do contrato da API vive em `packages/shared`.
- Só `packages/deere` e `apps/api/src/integracoes/deere` conhecem a John Deere. O app nunca importa `packages/deere`.
- O backend calcula os números; a IA só escreve o texto.
- A IA nunca estima nem pede desculpas (12/11, pedido do Alisson: "os dados nunca podem vir errados"): tudo que ela diz sai dos DADOS ou de `consultar_relatorio`. `porMaquina` do relatório traz área, horas, litros, consumo por ha e por hora e minutos parados de cada máquina (nulo = sem leitura, não zero). Dado ausente: uma frase curta dizendo que não tem; resposta anterior que não bate com os dados: "Corrigindo:" e o número certo.

App (`apps/mobile/src`)
- Vertical slice: `features/<nome>/{screens,components,hooks,api}`, `<nome>.keys.ts` e `index.ts`.
- `index.ts` é a única porta de entrada da feature. Uma feature só usa outra pelo que o `index.ts`
  dela exporta (hooks e componentes públicos), nunca por arquivos internos.
- Código só sobe para `shared/` quando aparece em três features.
- Arquivos de rota em `src/app` são finos: só reexportam a tela da feature.
- Tela desenha, hook decide, `api/` busca. Tela não tem `fetch`, `useQuery` direto nem regra de negócio.
- Dado do servidor sempre via TanStack Query, dentro de hooks da feature, com chave da fábrica
  `<nome>.keys.ts`. Mutação invalida as chaves que afeta. Nunca guardar dado do servidor em `useState`.
- Sem prop drilling: passe o id e deixe o componente chamar o hook; composição antes de contexto;
  uma prop não atravessa componente que não a usa.
- Sem prop hell: até cerca de 7 props; `variant` em vez de booleanos; `children` e componentes compostos;
  objeto de domínio inteiro (`<MaquinaCard maquina={m} />`).
- Toda tela trata carregando, erro com "tentar de novo", vazio e sucesso (`shared/components/estado-tela`).
- Cores e espaços vêm de `shared/theme`. Área de toque de 44 px ou mais.

Backend (`apps/api/src`)
- Um módulo por feature: `<nome>.controller.ts`, `<nome>.service.ts`, `<nome>.module.ts`, `dto/`, `entities/`.
- Controller fino, regra no service, SQL no repository. Controller nunca devolve entidade.
- Injeção sempre com `@Inject(...)` explícito. Nunca `new Service()`.
- Módulo exporta só o necessário. Sem `forwardRef()`. `AppModule` só importa módulos.
- Projeto ESM: imports relativos terminam em `.js`. Testes em Vitest (`vi.fn()`).
- Toda consulta filtra pela fazenda da sessão. Envio ao trator é idempotente.
- Erros de negócio têm `codigo` estável (ex.: `MAQUINA_NAO_ENCONTRADA`).

## Estado atual

- Feito: base do monorepo; contrato de máquinas, talhões e painel; provedor falso com a fazenda
  de demonstração; API com `/saude`, `/maquinas`, `/talhoes` e `/painel`; base visual do protótipo
  (`shared/theme/tokens.ts`, `Icone`, `BarraDeAbas`); telas Início
  e Máquinas; mapa em tela cheia com MapLibre (`features/mapa`): satélite, talhões, máquinas,
  seleção por toque e painel de detalhes.
- Editor de talhão (`features/talhoes`, rota `/novo-talhao`): toque adiciona canto, arrastar ajusta,
  área calculada com `areaHaDoPoligono` de `@talhio/shared` (o mesmo cálculo no app e no backend),
  `POST /v1/talhoes` valida e salva.
- Editor de linha AB (`features/linhas`, rota `/linha-ab?talhaoId=`): toque marca A e B, ou usa uma
  linha padrão da fazenda, ou a borda mais comprida; passadas calculadas com `gerarPassadas` de
  `@talhio/shared`; `GET/POST /v1/linhas` salva e envia ao provedor (`enviarLinha`). Largura do
  implemento fixa em 12 m (`LARGURA_IMPLEMENTO_M`) até existir o planejamento.
- Mapa: ao selecionar um talhão aparecem as linhas do trator (`useLinhasDoTalhao` de `features/linhas` + `CamadaPassadas` do motor de mapa): linha AB do talhão ou, na falta, a padrão da fazenda; passadas feitas na cor
  da operação e as que faltam em branco. `Talhao.percentualFeito` vem do provedor. Provisório: as
  passadas feitas são estimadas pelo percentual, na ordem; com a John Deere real vêm da área
  trabalhada (Field Operations).
- Detalhe da máquina (`features/maquinas`, rota `/maquina/[id]`): aberto pelo cartão da lista e pelo
  "Ver máquina" do mapa. Mostra aviso, mini mapa com as linhas do talhão, horas, área e rendimento do
  dia, velocidade, motor, combustível, horímetro, modelo e série. `GET /v1/maquinas/:id`; medições
  vêm de `provedor.medicoes` (no real: Machine Measurements).
- Motor de mapa (`apps/mobile/src/mapa-motor`, importado como `@/mapa-motor`): módulo isolado e
  ÚNICO lugar do app que importa `@maplibre/*`. Fora dele, importe só de `@/mapa-motor` (nunca um
  arquivo interno). O `pnpm typecheck` do app falha se essa regra for quebrada
  (`scripts/verificar-mapa.mjs`). O módulo não conhece features nem regras de negócio: recebe
  GeoJSON, ids e cores do tema.
  - `MapaBase`: mapa + câmera. Props: `limites`/`margem` (ou `centro`/`zoom`), `interativo`,
    `aoTocar`. Comandos por `ref` (`MapaControle`): `aproximar`, `irPara`, `enquadrar`, `projetar`.
    A câmera nunca é movida por estado do React.
  - Camadas: `CamadaTalhoes`, `CamadaMaquinas`, `CamadaPassadas`, `CamadaContornos`,
    `CamadaDesenhoTalhao`, `CamadaLinhaAB`, `CamadaPonto`.
  - Regras de desempenho: (1) nada de componente React por máquina; máquinas são UMA fonte GeoJSON
    com UMA camada. (2) Toda camada é `memo`: passe o MESMO objeto GeoJSON enquanto o dado não
    mudar (monte com `useMemo`, ou `select` do React Query como em `usePontosDasMaquinas`).
    (3) Manipuladores de toque podem ser recriados à vontade: o motor os estabiliza
    (`useEventoEstavel`). (4) Seleção é expressão de pintura pelo id, nunca propriedade dentro do
    GeoJSON. (5) Não ouvir eventos de movimento da câmera para guardar em estado.
- Fazenda real por arquivo: `lerPastaGen4` (`packages/deere/src/gen4.ts`) lê a pasta de configuração
  do monitor John Deere Geração 4 (talhões, contornos e linhas curvas). Se existir
  `dados-fazenda/Gen4` na raiz (fora do Git; ou `DEERE_PASTA_GEN4`), a API usa esses talhões e
  linhas no lugar da demonstração; máquinas e andamento seguem simulados. Linha tem `tipo`
  `reta` (passadas calculadas) ou `curva` (passadas prontas em `passadas`).
- Publicação: destino é a AWS em São Paulo (decisão do Alisson). `Dockerfile` na raiz gera a imagem
  da API (compila, depois `pnpm deploy --prod --legacy` para levar só as dependências de produção;
  roda como usuário sem privilégio; traz os certificados do RDS). Passo a passo em
  `docs/PUBLICAR-AWS.md`. `infra/publicar.sh [tudo|api|site]` faz tudo com um comando (ECS Express
  Mode, um serviço por parte: `talhio-api` e `talhio-site`, mais o RDS), lendo as chaves da AWS do
  `.env` da raiz. O roteiro NÃO foi executado: o ambiente do Claude não alcança a AWS; quem roda é o
  Alisson, no terminal dele. O site vai como contêiner nginx (`apps/site/Dockerfile`).
  A fazenda importada pelo app fica no banco (tabela `fazendas_importadas`, uma por organização) e é
  devolvida ao provedor quando a API sobe (`ImportacoesService.onModuleInit`); não grava mais em pasta.
- Importação pelo app (`features/importacao`, rota `/importar`): escolhe um `.zip` da pasta Gen4 (ou
  os arquivos soltos) com `File.pickFileAsync` do `expo-file-system`, envia em base64 para
  `POST /v1/importacoes/gen4`. A API abre o zip (`fflate`), lê com `lerArquivosGen4`, entrega ao
  provedor (`importarFazenda`) e guarda a fazenda no banco.
  Cada importação substitui a anterior. GS3 2630 (binário) ainda não é lido: erro `FORMATO_GS3`.
- Login e segurança da API (`apps/api/src/auth`, `configurar-app.ts`):
  - Toda rota exige token por padrão (guarda global `AuthGuard`). Rota aberta só com `@Publico()`
    (hoje: `/saude`, `/auth/entrar|renovar|sair|cadastrar` e `/deere/callback`). Rota nova já nasce protegida.
  - A organização vem do token: use `@OrgAtual()` no controller. Nunca aceite `orgId` vindo do
    corpo ou da URL.
  - Token de acesso JWT HS256 de 15 min + token de renovação de 30 dias, uso único (rotaciona a cada
    renovação), guardado no servidor só como SHA-256. Senha com scrypt.
  - Força bruta: 5 logins/min por IP (`@Throttle`) + bloqueio do e-mail por 15 min após 5 erros
    (`BloqueioService`). Limite geral: 600 req/min por IP. Mesma mensagem para e-mail inexistente e
    senha errada.
  - `helmet`, corpo JSON de 100 kB (30 MB só em `/v1/importacoes`), CORS fechado (abre só com
    `CORS_ORIGENS`), ids de URL validados (`IdSchema`), zip limitado a 20 MB por arquivo.
  - Segredos em `apps/api/.env` (fora do Git; modelo em `.env.example`). Com `NODE_ENV=production`
    a API não sobe sem `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_SENHA`. Em desenvolvimento usa
    `admin@talhio.local` / `talhio-dev-123` e avisa no console.
  - Papéis: `admin` (pode tudo) e `leitura` (só consulta). Rota que muda dados leva `@SoAdmin()`.
  - Provisório: só existe o administrador vindo do `.env` (recriado a cada subida); sem cadastro de
    usuários, troca nem recuperação de senha. O app ainda não esconde botões de quem é `leitura`.
- Banco (`apps/api/src/banco`): Drizzle ORM. Com `DATABASE_URL` usa Postgres de verdade; sem ela,
  Postgres embutido (PGlite) gravado em `apps/api/.dados/banco` (fora do Git), sem instalar nada.
  Testes usam o embutido em memória (`criarBancoDeTeste`). Tabelas em `schema.ts`: organizacoes,
  usuarios, sessoes, talhoes, linhas, conversas, mensagens (todas de dados com `org_id`). Mudou o schema: rode
  `pnpm --filter @talhio/api banco:gerar` e versione a pasta `apps/api/drizzle`; a API aplica as
  migrações ao subir. Só repositories injetam `BANCO`, e toda consulta filtra por `orgId`.
  Contorno é `jsonb` por enquanto (PostGIS quando precisar de consulta espacial no banco). Talhões
  e linhas vindos da John Deere ou importados não ficam no banco: vêm do provedor.
- Login no app (`features/auth`, `shared/lib/sessao.ts`): tokens no cofre do aparelho
  (`expo-secure-store`); `apiClient` manda o token, renova uma vez no 401 (renovação única
  compartilhada) e desloga se a renovação falhar; rotas protegidas com `Stack.Protected`; ao sair
  limpa o cache do React Query. App publicado só aceita API em `https://`.
- Relatório (`features/relatorios`, aba Relatórios; `GET /v1/relatorios/dia|semana|mes?data=AAAA-MM-DD`):
  dia (comparado com o anterior), 7 dias terminando em `data` (contra os 7 antes) ou mês inteiro
  (contra o mês anterior); sem `data` vale o período corrente. No app: Hoje/Semana/Mês, setas ‹ ›
  que andam um dia, 7 dias ou um mês (`datas.ts`), "Ir para hoje". Toda conta fica em
  `RelatoriosService` (`periodos.ts` calcula os intervalos); o texto do resumo sai de
  `relatorios/resumo.ts`, um modelo fixo que só descreve os números já calculados. Dados por dia vêm
  de `provedor.atividadeNoDia`. Fuso fixo em America/Sao_Paulo. "Enviar no WhatsApp" abre o WhatsApp
  com o texto. **PDF**: `GET /v1/relatorios/:periodo/pdf?data=` (pdfkit, `relatorio-pdf.ts`, fontes de
  `@fontsource`) traz marca Talhio + nome da fazenda, 8 indicadores (área, horas, combustível usado, tempo parado, L/ha, L/h, área dentro/fora dos talhões; `indicadores.litros` e `porDia[].litros`, nulos = sem leitura, mostrados como "—"), gráficos por dia (área, parado, combustível), hectares por máquina e por operação, tabela "Detalhe por máquina" com total, tabela "Dia a dia" e resumo; o app baixa com o token (`apiClient.baixar`), grava em cache (`expo-file-system`) e abre o
  compartilhar (`expo-sharing`, carregado sob demanda: exige rebuild do app nativo). Logo por fazenda
  (upload) ainda não existe.
- Relatório só de algumas máquinas (12/11, pedido do granjeiro): `?maquinas=id1,id2` em `GET /v1/relatorios/:periodo`, no `/pdf` e no `/envio` (`FiltroDeMaquinasSchema`); `RelatoriosService.montar(..., maquinaIds)` refaz totais, comparação, gráficos e resumo só com elas; `Relatorio.soMaquinas` (nulo = fazenda inteira) aparece no cabeçalho do PDF e nos textos ("Só: ..."); nenhuma máquina encontrada dá 404 `MAQUINA_NAO_ENCONTRADA`. No app, `SeletorMaquinas` na tela Relatórios: UMA linha ("Máquinas · Todas") que abre uma folha com lista rolável, busca (8+ máquinas), ativas primeiro (trabalhando, motor ligado ou com horas hoje) com ponto verde, atalho "Marcar as ativas hoje" e botão "Ver relatório"; nada de fileira de chips (o Alisson achou horroroso com muitas máquinas). Aplicar uma escolha de máquinas SEMPRE refaz o relatório: `refazerPara(ids)` do `useRelatorio` (`resetQueries` na chave nova) + esqueleto (`RelatorioEsqueleto`, com `Pulsar` de `animacoes`) + blocos remontados; trocar só de dia ou período continua mostrando o anterior esmaecido; vale para a tela, o PDF e o envio ao grupo. O relatório do Início segue com todas.
- A IA lê os relatórios pela ferramenta `consultar_relatorio` (`periodo`, `data?`), ligada à
  organização em `ferramentasDa(orgId)`; o retrato da fazenda traz só hoje e os últimos 7 dias.
- IA e relatórios de outras épocas (15/11, pedido do Alisson): três ferramentas em `ferramentasDa(orgId)`, definidas em
  `modelo-ia.ts` (`ferramentasOferecidas`; erro numa consulta volta ao modelo como `{ erro }`, não derruba a resposta):
  `consultar_relatorio` (`periodo`, `data?`, `maquinas?` = ids), `consultar_historico_mensal` (`meses` 1 a 24; litros e
  horas de motor por mês e por máquina, somados em `ConsumoDeereRepository.porMes` a partir de `combustivel_importado`;
  `AssistenteService.historicoMensal`) e `consultar_analise_da_maquina` (`maquina`, `de`, `ate?`, até 30 dias;
  `MaquinasService.analise`). Passado: `ConsumoDeereService` na primeira rodada busca sozinho os últimos 12 meses do
  Machine Measurements das máquinas que ainda não têm esse histórico (`PASSADO_QUE_FALTA`; `MEDICOES_PREENCHER_DESDE`
  continua valendo se definida); pedaço antigo recusado pela Deere não tira os dias recentes. Em `atividadeNoDia`, dia
  passado sem horas da Deere (ela só cobre 62 dias) nem caminho guardado usa as horas de motor e o tempo ocioso da
  mesma leitura dos litros, para o relatório de meses antigos não vir zerado. Área de dias anteriores ao Talhio
  acompanhar a fazenda continua sem fonte (só Field Operations).
- Área de meses antigos pelas operações de campo (16/11, pedido do Alisson: "pega pelo mês, do dia 1 ao fim do mês, pelo
  backend"): `DeereProvedor.areaDasOperacoes(orgId, de, ate)` devolve área e horas por máquina e dia (a mesma conta de
  `estimarDia`, mas esperando a Deere); `AreaOperacoesService` grava mês a mês na tabela `area_das_operacoes`
  (migração 0022; `AreaOperacoesRepository.trocarPeriodo` troca o mês inteiro): 4 min depois de subir cobre 13 meses
  (mês antigo já guardado não é relido) e a cada 6 h relê o mês atual e o anterior. `atividadeNoDia` de dia passado
  sem área usa o que está guardado (`config.areas`). Só existe área de operação DOCUMENTADA no Operations Center
  (plantio, aplicação, colheita); trator sem documentação não tem. O corte de 120 dias de `atividade_deere` e os 14
  dias do export ponto a ponto continuam como estavam. NÃO conferido contra a Deere real.
- IA inventou números do ano (16/11, o Alisson: "a IA não tem que ficar se corrigindo, tem que pegar os dados corretos"):
  `consultar_historico_mensal` agora devolve, por mês, os números do MESMO relatório mensal da aba Relatórios
  (`RelatoriosService.montar('mes')`: área, área fora dos talhões, horas, litros, L/h, L/ha, parado, cada máquina), o
  detalhe do motor por estado (`motorPorEstado`, nulo sem leitura) e o `total` do período somado no servidor. As
  instruções mandam consultar ANTES de escrever, proíbem número que não veio dos DADOS ou de consulta da própria
  resposta (resposta anterior da conversa não é fonte; célula sem dado vira "—") e reduzem o "Corrigindo:" a uma frase.
- Conferência dos números da IA (16/11, o Alisson: "ela nunca pode inventar NENHUM dado", "não pode acontecer" número
  certo no lugar errado, e "tem que ser rápido"): `assistente/conferencia.ts`, `conferirResposta(resposta, fontes)`.
  Lê o retrato e o resultado de cada consulta COMO OBJETOS e guarda, de cada número, a medida (pelo nome do campo:
  `areaHa`, `litros`, `consumoLPorHora`, `paradoMin`...; ou pela `unidade` do item da análise), de quem é (o objeto
  com `nome`/`maquinaNome`/`maquina` que o contém) e de que período (`inicio`/`fim`, `mes`, `dia`, `de`/`ate`;
  `anterior` é do período anterior). Cada número da resposta precisa de uma folha com o mesmo valor (aceita
  arredondamento e duração "68h58"), da mesma MEDIDA, da máquina/talhão que a frase, a linha da tabela, o título ou a
  pergunta cita (número de máquina sem o nome dela é recusado; número da fazenda numa frase com máquina exige "a
  fazenda"/"total") e do PERÍODO citado (mês pelo nome, data, hoje, ontem, semana; número de um dia não vale como o do
  mês). Não conferidos: inteiro até 31 sem unidade, ano, contagem de tempo, código colado em letra. Nas regras e no
  texto do usuário basta o número existir. `comVariacoes` põe `diferenca` e `variacaoPct` em
  todo par `{ valor, anterior }`. Fluxo: `PortaDeLinhas` (em `assistente.service.ts`) solta cada LINHA assim que ela
  confere, enquanto o modelo ainda escreve; a primeira que não confere fecha a porta, o modelo responde de novo uma
  vez (recebendo a lista com o motivo) e o texto final substitui o da tela; se repetir, vai `RESPOSTA_BARRADA` e a
  falha fica no log. `consultar_analise_da_maquina` devolve `{ maquina: <nome>, de, ate, medicoes: [...] }` para a
  conferência saber de quem é. Limites: o que a frase não diz (período ou máquina omitidos em tudo, inclusive na
  pergunta) não tem como ser conferido; e texto sem número (ex.: "a que mais parou foi X") não é conferido.
- IA mais solta, com conta feita no servidor (16/11, pedido do Alisson): ferramenta `calcular` (`assistente/calculo.ts`,
  só números, + - * / e parênteses; nada é executado como código). Cada operando tem que existir nos dados, numa conta
  anterior ou no que a pessoa escreveu (`existeNasFontes`), salvo contagens até 31 e os fatores 60, 100, 365, 1000 e
  3600 (`ehConstante`); o resultado entra na conferência como folha `calculado` (vale em qualquer frase, mas com a
  medida da `unidade` informada). As instruções agora mandam FAZER a conta quando ajuda e deixam interpretar ("pelo que
  vejo"), sem afirmar causa nem número de referência de fora. Conta de cabeça continua barrada.
- Áudio como no WhatsApp (16/11): `useGravacaoDeVoz` (substitui `useDitado`) + `CampoDePergunta`. Sem texto, o botão é o
  microfone: segura para falar (relógio, "Deslize para cancelar", o texto entendido aparece em cima), solta e a pergunta
  é ENVIADA na hora; arrastar 90 px para a esquerda cancela; toque curto só mostra a dica. Com texto digitado o botão
  vira enviar. Continua sendo reconhecimento de fala no aparelho (`expo-speech-recognition`, `continuous: true`): o
  áudio não vai ao servidor e não existe balão de áudio para ouvir de novo. Gesto com `PanResponder`, sem biblioteca nova.
- Onboarding em 4 passos (16/11): `OnboardingScreen` com John Deere (obrigatório), talhões (`PassoImportar`, de
  `features/importacao`), WhatsApp (`PassoWhatsapp`) e largura dos implementos (`PassoLarguras`, de `features/maquinas`).
  Cada passo opcional mostra `SePular` (o que se perde) ANTES dos botões; feito, vira confirmação e o botão é
  "Continuar"; sem fazer, "Pular por enquanto". Quem já tem a Deere ligada começa no passo 2. A Config ganhou "Rever os
  primeiros passos" (só administrador). `PortaDoOnboarding` continua levando só quem ainda não conectou a Deere.
- Resposta da IA organizada (15/11): as instruções mandam começar pela frase com o número em **negrito** e, quando há
  várias partes, tabela (até 4 colunas), título `## ` e tópicos `- `; só essa marcação é permitida. No app,
  `features/assistente/formatar.ts` (`lerBlocos`, puro, aguenta resposta pela metade) e `components/TextoFormatado.tsx`
  desenham; o balão com tabela ocupa a largura da conversa. Fala do usuário continua texto simples.
- Início do app: depois do mapa/ações, vem o relatório de hoje em papel (3 números, barras por
  máquina, resumo, "Enviar no WhatsApp" e "Ver semana"), "Pergunte à IA" (campo em pílula com
  microfone que abre o assistente) e "Escala de hoje" com "Completar". Layout "Rolando" do desenho.
- Conta nova e John Deere: `POST /v1/auth/cadastrar` (aberto, 5/min por IP; `CADASTRO_ABERTO=0` fecha) cria a
  organização e o administrador numa transação e abre a sessão; e-mail repetido dá 409 `EMAIL_EM_USO`.
  Ligação com a Deere em `apps/api/src/integracoes/deere` (`ConexaoDeereService`): `GET /deere/conexao`
  (estado: desconectado, escolher-organizacao, liberar-acesso, pronto; modo `demonstracao` com o provedor
  falso), `POST /deere/conexao/iniciar` (devolve o endereço de login, `state` assinado por HMAC, 10 min),
  `GET /deere/callback` (ABERTO de propósito; não conclui, só repassa ao app; ver "Segurança das rotas abertas"), `GET /deere/organizacoes`, `POST /deere/organizacao`,
  `POST /deere/conexao/conferir`, `DELETE /deere/conexao`. Tokens cifrados com AES-256-GCM
  (`DEERE_CRIPTO_CHAVE`) na tabela `conexoes_deere`; renovação automática, uma por vez por fazenda
  (`obterToken`, usado pelo `DeereProvedor`). Endpoints de login vêm do `DEERE_WELL_KNOWN` (valor padrão
  NÃO verificado, confirmar com as chaves reais). Escopos em `DEERE_ESCOPOS` (inclui `ag3`/`org2`: o Talhio
  escreve talhões, contornos, linhas e operadores). `DeereProvedor` (`packages/deere`: `deere-cliente.ts` com
  paginação, nova tentativa em 429/503 e `DeereErro`; `deere-mapeadores.ts` puro): PRONTOS `listarMaquinas`
  (Equipment API em `equipmentapi.deere.com/isg/equipment?organizationIds=`, `DEERE_EQUIPAMENTOS_URL`; o id da máquina é o `principalId`), `ultimaPosicao` (breadcrumbs?lastKnown=true, com locationHistory de reserva, + deviceStateReports), `listarTalhoes` (Fields + Boundaries),
  `medicoes` (engineHours + fuelLevel do breadcrumb),
  `atividadeNoDia`/`atividadeDoDia`/`resumoDaFazenda` (Field Operations + measurementTypes: área, horas,
  operador, andamento por talhão), `sincronizar` (export ponto a ponto SHAPEFILE/Point/OneHertz em /isg: pede,
  confere, baixa o zip, `exportacao.ts` lê o .dbf e calcula horas, área, combustível e parado por máquina e dia;
  guarda em `atividade_deere`/`exportacoes_deere`; `SincronizacaoDeereService` roda ao subir, a cada 2 min e (na hora) quando a Deere chama `POST /deere/webhook` e
  logo após conectar, para o app já abrir com tudo pronto; `atividadeNoDia` lê do banco e, sem export lido,
  cai numa ESTIMATIVA pelas operações), `listarLinhas` (só ABLine),
  `enviarLinha` (POST guidanceLines, só linha AB reta em talhão), `importarFazenda` (POST fields + boundaries +
  guidanceLines; talhão com o mesmo nome é reaproveitado). AINDA `pendente`: `enviarPlano` (Work Plans, sem
  aprovação). Webhook: `POST /deere/webhook` (público, só dispara a leitura; a assinatura `operationsExport` em `eventSubscriptions` é criada por `POST /deere/aviso`, só a pedido do administrador (botão em Config), e nunca duplica: confere a lista antes). Leitura conferida com a documentação em 11/11: contornos por `embed=boundaries`, lista da organização e links `activeBoundary`/`boundaries` do talhão; linhas com `embed=shapes` (reta e curvas); posição = mais recente entre breadcrumb e locationHistory; máquina da operação casada também pelo chassi (`vin`); horas de hoje por `hoursOfOperation`. Várias organizações Deere podem ficar em uso juntas (`organizacaoIds`; máquinas e talhões são somados; `GET /deere/diagnostico` testa cada uma). App atualiza a cada 15 s. Login: credenciais no corpo do form (não Basic). As formas
  das respostas seguem a documentação e NÃO foram conferidas no sandbox (testes em `deere-provedor.spec.ts`
  usam exemplos escritos à mão: trocar por respostas reais). Dúvida aberta: `machineId` das operações de campo = `principalId`? `DeereErro` vira resposta com `codigo`
  (`DeereErroFilter`). App: `features/conexao` (`PassoConexao`, sem props,
  serve ao onboarding e à Config), `features/onboarding` (rota `/onboarding`; `PortaDoOnboarding` nas abas
  leva o administrador se o servidor usa a Deere e a fazenda não conectou; "Fazer depois" vale até fechar o
  app), `features/config` (aba Config: conta, John Deere, sair) e `CadastroScreen` (`/cadastro`, link "Criar
  conta" no login).
- O mapa não tem mais a imagem de demonstração sobreposta; a câmera reenquadra quando os talhões
  mudam (dentro do `MapaBase`).
- Escala automática (11/11): máquina sem escala gravada no dia aparece como sugestão que REPETE a do dia anterior (operador, tarefa, talhão, turno; talhão apagado fica de fora) e, sem ela, o operador que a máquina informa. `POST /v1/escala/confirmar?dia=` (`@SoAdmin`) grava todas as sugestões com operador sem marcar como enviadas; no app, o botão "Confirmar escala sugerida". Decisão do Alisson: sem API oficial do WhatsApp (Meta); o envio segue abrindo o WhatsApp com o texto pronto.
- Escala do dia (`features/escala`, aba Escala; `GET /v1/escala`, `POST|DELETE /v1/escala/maquinas/:id`,
  `POST /v1/escala/envio`): uma linha por máquina com operador, tarefa, talhão e turno. Sem escala
  gravada, a linha mostra o operador que a máquina informa como sugestão ("A confirmar"). O mesmo
  operador não entra em duas máquinas no mesmo turno (409 `OPERADOR_JA_ESCALADO`). O operador
  escalado passa a valer em `Maquina.operador` (cartões, painel, assistente). "Enviar" abre o
  WhatsApp com a escala em texto (`shared/lib/whatsapp.ts`) e grava o envio; mudar a escala zera o
  envio. Tabela `escalas` (única por org + dia + máquina). Falta: áudio por operador e envio
  individual (precisa do telefone de cada um e da API do WhatsApp), escala de outros dias.
- Planejar (`features/planos`, rota `/planejar?talhaoId=`, aberta pelo "Planejar e enviar" do mapa;
  `GET|POST /v1/planos`): operação, dados (cultura, variedade, sementes/ha, espaçamento, produto e
  dose, data, recado), máquinas que servem para a operação (trator para plantio e adubação,
  pulverizador, colheitadeira; as online já vêm marcadas; sem telemetria não dá para marcar) e outros
  talhões. Plantio exige cultura, variedade e taxa (regra em `NovoPlanoSchema`). O plano é SALVO
  (tabela `planos`), não enviado: cada máquina volta com `envio: 'aguardando-liberacao'` até a John
  Deere liberar o Work Plans. Plano que começa hoje grava tarefa e talhão na escala das máquinas que
  já têm operador. Falta: enviar de verdade, linha AB e largura do implemento dentro do plano,
  listar/editar/apagar planos, data além de 7 dias.
- O plano começa em `/novo-plano` (`NovoPlanoScreen`, `features/planos`), aberto pelo "Novo plano" do
  mapa e pelo "Enviar plano" do Início: os talhões que já existem aparecem no mapa para tocar, ou
  cria-se um novo (`/novo-talhao`, que segue para a linha e o plano). Talhão com linha vai direto
  para `/planejar`; sem linha, passa antes por `/linha-ab`. O mapa não tem mais o botão "Novo talhão".
- Fluxo "2 · Preparar e enviar ao trator" do protótipo, ponta a ponta: novo talhão -> linha AB
  (`/linha-ab`; ao concluir vai para `/planejar`, ou volta ao plano se veio dele com `origem=plano`)
  -> plano (`/planejar`) -> escala do plano (`/escala-do-plano?planoId=`, `EscalaDoPlanoScreen` em
  `features/planos`: operador e turno de cada máquina do plano no dia em que ele começa, prévia da
  mensagem, envio pelo WhatsApp) -> ao vivo (`/ao-vivo?talhaoId=`, `features/aovivo`: mapa do talhão
  com passadas e máquinas, % feito, hectares, velocidade, previsão de término pelo ritmo do dia e
  eventos; atualiza a cada 30 s com `useTalhoes({ aoVivo: true })`).
  A escala aceita qualquer dia: todas as rotas de `/v1/escala` levam `?dia=AAAA-MM-DD` (sem ele,
  hoje); `POST /v1/escala/envio` aceita `{ maquinaIds }` para marcar só as máquinas de um plano.
  `GET /v1/planos/:id`. Diferenças do protótipo, de propósito: mensagem de texto em vez de áudio,
  sem cópia para o encarregado, "plano salvo" em vez de "enviado às máquinas", e os eventos do ao
  vivo só mostram o que sabemos (plano salvo, parada, estado atual), sem "recebido no monitor".
- `MapaDoTalhao` (`features/talhoes`): mapa parado de um talhão, usado na escala e no plano.
  `Opcoes` (`shared/components`): fileira de opções de toque, escolha única ou múltipla.
- Assistente de IA (`features/assistente`, aba IA; `POST /v1/assistente/mensagens`): chat por texto
  e por voz. O servidor monta um retrato da fazenda com os números já calculados (painel, máquinas,
  talhões, relatórios do dia e da semana; sem contornos, coordenadas nem número de série) e manda
  ao modelo junto com a conversa (`assistente/instrucoes.ts`). O modelo só escreve; não calcula
  nem executa ações. Fornecedor atrás do token `MODELO_IA` (`IaAnthropic`, SDK oficial); chave em
  `ANTHROPIC_API_KEY` no `.env` do servidor, nunca no app; sem chave, responde 503
  `IA_NAO_CONFIGURADA`. Limite de 15 perguntas/min por IP. Histórico no banco (tabelas `conversas`
  e `mensagens`), sempre filtrado por organização E usuário: a conversa é de quem perguntou. O
  app manda só a pergunta nova e o `conversaId`; o servidor lê o histórico do banco (últimas 20
  mensagens vão ao modelo) e grava pergunta e resposta juntas, só quando a IA responde.
  `GET/DELETE /v1/assistente/conversas[/:id]` lista, abre e apaga.
  Paginação: `GET conversas?pular=N` devolve 20 por vez (`proximo` nulo no fim); `GET conversas/:id`
  devolve só as 30 mensagens mais recentes e `primeiraOrdem`; `?antes=<primeiraOrdem>` busca o trecho
  anterior. No app, o chat é uma `FlatList` invertida (só desenha o que está na tela e busca as
  anteriores ao subir) e o histórico usa `useInfiniteQuery`. O servidor nunca lê a conversa inteira.
  Voz: `expo-speech-recognition` transforma fala em texto no próprio aparelho (pt-BR) e preenche o
  campo para a pessoa conferir antes de enviar; o áudio não passa pelo nosso servidor. O módulo é
  carregado sob demanda (`useDitado`), então um app compilado sem ele continua abrindo.
- Animações (`shared/components/animacoes.tsx`, com `react-native-reanimated`): `Surgir` (entrada,
  com `ordem` para sequência), `BarraAnimada`, `PontosPensando`, `AnelPulsante`. Rodam fora da
  thread do JavaScript e respeitam "Reduzir movimento" do aparelho. Use esses componentes em vez
  de animar na mão; nada de animação em cima do mapa.
- Canal ao vivo (`apps/api/src/ao-vivo`, WebSocket em `/v1/ao-vivo`, pacote `ws`; contrato em `packages/shared/src/aovivo.ts`):
  o app abre UM socket enquanto há login (`shared/lib/canalAoVivo.ts`: reconexão com espera crescente, renova o token se o
  servidor recusa, fecha em segundo plano). O token vai no PRIMEIRO quadro (`auth`), nunca na URL; sem ele em 5 s o servidor
  fecha (4401). O servidor, a cada 5 s e só para fazendas com gente conectada, lê `MaquinasService.listar` e empurra
  `maquinas` se mudou; o app joga no cache do React Query (`useMaquinasAoVivo`). Com o canal aberto a consulta normal cai
  para 60 s (`intervaloDeAtualizacao`); sem ele, 15 s. Chat em streaming pelo mesmo canal: quadro `chat` -> `chat.trecho`
  (aos poucos, sem as sugestões: `CortaSugestoes`) -> `chat.fim`/`chat.erro`; uma pergunta por vez por conexão e 15/min por
  pessoa; sem canal o app usa o `POST /assistente/mensagens` de sempre. Atrás do balanceador, o idle timeout precisa ser > 25 s
  (a batida de ping é de 25 s) e o balanceador precisa aceitar WebSocket (ALB aceita).
- Desempenho (auditoria de 11/11): relatório e lista de máquinas NÃO esperam a Deere. Atividade vem do banco (uma consulta por
  fazenda, 120 dias, 15 s em memória, `AtividadeDeereRepository`); a estimativa por operações espera no máximo 400 ms e termina
  em segundo plano; operações por talhão servem a última lista boa enquanto atualizam (60 s). `ClienteDeere` tem fila de 6
  chamadas simultâneas, prazo de 20 s e junta leituras idênticas. `RelatoriosService.montar` junta pedidos iguais por 10 s.
  Respostas em gzip. Caches do `DeereProvedor` entregam a ÚLTIMA resposta boa enquanto atualizam por trás (`guardado`, rastro,
  operações): só a primeira consulta de todas espera a Deere, e `aquecer(orgId)` a faz ao subir o servidor e a cada rodada
  (`esquecer(orgId)` limpa ao trocar de organização). No app, Início e mapa não esperam tudo: cada bloco aparece quando o dado
  dele chega (o mapa abre com talhões OU máquinas, o que vier primeiro).
- Fazenda importada de arquivo com a Deere ligada: `DeereProvedor.importarFazenda` guarda os talhões e as linhas SÓ no Talhio (memória + tabela `fazendas_importadas`, devolvidos ao subir) e os soma aos da Deere em `listarTalhoes`/`listarLinhas`; nada é gravado na conta. Motivo (11/11): nas organizações da Granja Mangueira a API só devolve contorno de talhões de teste; os reais vêm sem desenho. Gravar na Deere é `enviarFazendaParaDeere`, que nada chama sozinho.
- Trajeto e uso do dia (11/11): `GET /v1/maquinas/rastros` devolve, por máquina que deu sinal hoje, o caminho em trechos e as paradas (2 min ou mais); no mapa, `CamadaRastros` (a ponta da linha segue a posição ao vivo). O `DeereProvedor` guarda o caminho do dia em memória (`rastroDeHoje`, só busca o pedaço novo a cada 20 s, e cada posição nova entra na hora) e dele saem: `usoDeHoje` (horas trabalhando/ocioso/transporte pela velocidade, litros pela ISO 15143-3 se liberada), paradas, tempo por talhão (`Maquina.usoHoje.porTalhao`, conta em `tempoPorTalhao` do `MaquinasService`) e hectares estimados (`areaDoCaminho`: metros dentro do talhão x largura da passada tirada das linhas do talhão, ou 12 m; teto na área do talhão). Carga do motor, rotação e AutoTrac NÃO existem em API pública da Deere.
- Busca do passado (11/11): tabela `uso_diario` (um fechamento por máquina e dia: horas por estado, paradas, tempo por talhão, hectares). `DeereProvedor.recuperarPassado` roda no fim de cada rodada da sincronização, lê o caminho dos dias ainda não fechados (45 dias, do mais recente ao mais antigo, 8 leituras por rodada, dia em 4 janelas de 6 h) e grava; dia sem motor ligado fecha zerado sem consultar. `atividadeNoDia` de dia passado usa esse fechamento quando a Deere não informa área. Importar talhões apaga os fechamentos para refazer. Horas de motor ligado de qualquer dia vêm de `ligadoPorDia` (uma leitura de 62 dias por máquina).
- Log (11/11): `[Deere]` uma linha por chamada à John Deere, `[AoVivo]` o que vai ao app, `[Pedido]` cada pedido; `LOG_DEERE=0`/`LOG_PEDIDOS=0` desligam. Lições do primeiro log real: `deviceStateReports` e `engineHours` sem filtro devolvem o histórico inteiro de 10 em 10 (usar `startDate`/`lastKnown` e uma página só); a lista de equipamentos traz plataformas de colheitadeira (filtrar `categories=Machine`); talhão de teste com 0 ha derrubava a lista inteira no app (agora cada item é validado sozinho).
- Largura do implemento e hectares por operação (11/11): `POST /v1/maquinas/:id/largura` (`@SoAdmin`, `{ larguraM: 0,5 a 60 | null }`) grava em `larguras_de_implemento`; `Maquina.larguraImplementoM`. Com largura informada, os hectares da máquina usam ela dentro e fora do talhão (`areasDoCaminho(..., larguraDaMaquina)`); sem ela, a largura das linhas do talhão. Mudar a largura chama `provedor.larguraMudou` (apaga os fechamentos de `uso_diario` para refazer). No app: `LarguraDoImplemento` na tela da máquina. `Relatorio.porOperacao`: a área de cada máquina em cada dia vai para a operação do plano mais recente já começado que inclui a máquina (`PlanosRepository.operacoes`); operação nula = máquina sem plano; o resumo ganha a frase "Pelos planos: ...". É o que temos de "hectares plantados" enquanto a Deere não informa a operação. Tanques conhecidos em `TANQUE_L` (8270R, 6150J, S550, S760, 620G).
- Litros pela queda do tanque (corrigido em 12/11, depois de o granjeiro ver 85 e 129 L/h num 8270R que gasta 24 no monitor): `litrosPelaQuedaDoTanque` NÃO soma cada descida do nível (a boia balança no campo e isso virava consumo, uns 4x a mais). Agora: mediana do nível a cada 5 min (alisada com as janelas coladas), corte só em subida de 10% ou mais (abastecimento) e, em cada trecho, nível do começo menos o do fim; resultado acima de 90 L/h entre a primeira e a última leitura vira nulo ("—"), nunca número. A migração 0014 apaga os fechamentos de `uso_diario` que tinham litros, para a busca do passado refazer com a conta nova. MAS essa estimativa NÃO entra mais no relatório (decisão do Alisson em 12/11: "se o monitor mostra 24 L/h é isso, não perto disso; não podemos errar"): fica desligada, só volta com `COMBUSTIVEL_PELO_TANQUE=1`.
- Trava de plausibilidade (12/11, o relatório mostrou 226 e 105 L/h): em `RelatoriosService`, `leituraPossivel` zera o combustível de uma máquina e dia quando litros/horas passa de 90 L/h (`LIMITE_L_POR_HORA`) ou quando há litros sem hora de motor; vira "—" em tudo (totais, L/h, L/ha, gráficos, PDF, texto). Vale para qualquer fonte de combustível.
- Diagnóstico no log (12/11): o 401/403 da Deere guarda o texto que ela mandou (`DeereErro.detalhe`, só log; a documentação diz que o 403 traz a licença e os escopos que faltam) e aparece na linha `combustível acumulado (ISO 15143-3)`; cada export baixado registra `export da operação <id>: ...` (`resumoDoExport`: colunas, unidades do .json e, para combustível/motor/carga, mín, máx, soma e se só cresce), porque a coluna `FUEL` do export nunca foi conferida com um arquivo real. Estado do pedido ao portal em 12/11: conexões das organizações 599909 e 459752 OK (permissão 2001 Equipment Access Level 1); falta confirmar que o aplicativo tem a API ISO 15143-3 liberada (o `partneraemp.deere.com` respondeu 403, `partnerapi.deere.com/aemp` 404, `aemp.deere.com` sem resposta).
- Estimativa pelo tanque com rótulo (12/11, o Alisson pediu para usar o nível do tanque enquanto a Deere não libera o ISO): com `COMBUSTIVEL_PELO_TANQUE=1`, litro que vem da queda do tanque sai MARCADO (`AtividadeDiariaExterna.combustivelEstimado`, `Relatorio.combustivelEstimado`, `porMaquina[].litrosEstimados`); PDF mostra "(estimado)" nos indicadores, `*` na tabela e nota de rodapé; texto do grupo diz "estimado pelo tanque: cerca de"; cartão do app "(estimado)"; a IA é instruída a dizer que é estimado. Número do motor (export ou ISO) sempre vence e não leva marca. Dia passado fechado com a estimativa desligada continua sem litros.
- Combustível do relatório = só o que o MOTOR informa (12/11): (1) litros do export ponto a ponto (`atividade_deere`, coluna FUEL do monitor); (2) sem export, combustível ACUMULADO da ISO 15143-3 (`/Fleet`, o número do monitor): `DeereProvedor.frota` relê a cada 30 min (também em `aquecer`, sem ninguém no app) e guarda a última leitura do dia por número de série em `combustivel_acumulado` (`CombustivelAcumuladoRepository`, `ArmazemDeCombustivel`); litros do dia = última leitura do dia menos a última do dia ANTERIOR (`litrosDoDia`), para hoje e para dias passados. Sem as duas leituras (primeiro dia depois do deploy, servidor fora do ar, Deere sem liberar o acumulado: log "combustível acumulado (ISO 15143-3): não veio"), o combustível fica nulo e o relatório mostra "—". Nunca completar com estimativa. Limite conhecido: a Deere guarda a resposta da frota por até 1 h, então trabalho perto da meia-noite pode cair no dia seguinte. A documentação da Deere (conferida em 12/11) lista "Cumulative Fuel Used" no `/Fleet` (escopo `eq1`; só máquinas com telemetria "active"; nem toda máquina informa), mas só publica o endereço do sandbox (`sandboxaemp.deere.com`): sem `DEERE_AEMP_URL`, `frota` testa `partnerapi.deere.com/aemp`, `aemp.deere.com` e `partneraemp.deere.com` e o log diz qual respondeu, quantas máquinas vieram e quantas têm combustível; se a resposta traz o link `connections`, o log mostra o endereço para o dono da fazenda liberar a organização ao aplicativo (sem isso a Deere dá 403/lista vazia).
- Segurança das rotas abertas (revisão de 11/11): (1) `POST /deere/webhook` é aberta, então o aviso tem teto: uma rodada a cada 30 s e uma limpeza do mapa a cada 5 min (`SincronizacaoDeereService.avisado`), senão um estranho esvaziaria o que está guardado de todas as fazendas. (2) Conexão com a John Deere em 3 passos: `iniciar` (admin) -> `GET /deere/callback` (aberta, NÃO conclui: só repassa `codigo` e `estado` ao app em `talhio://deere`) -> `POST /deere/conexao/concluir` (admin; só conclui se o `state` foi gerado pela MESMA fazenda da sessão, senão 403 `DEERE_PEDIDO_DE_OUTRA_FAZENDA`). Nunca voltar a trocar o código na rota aberta: um link de conexão de uma fazenda ligaria a conta Deere de outra pessoa a ela. (3) Trava de login por e-mail + endereço (5 erros) e por e-mail no total (50), 15 min (`BloqueioService`); depende de `ATRAS_DE_PROXY=1` atrás do balanceador para enxergar o endereço real. Bloqueios, limites e a fazenda importada ficam na memória de UMA cópia da API: com mais de uma cópia, levar para o banco.
- WhatsApp da fazenda (12/11, pedido do Alisson, mesmo modelo do fechou-backend; sem API oficial da Meta): `apps/api/src/whatsapp`. `GET /v1/whatsapp` (estado: indisponivel, desconectado, aguardando-codigo, reconectando, conectado), `POST /v1/whatsapp/codigo {telefone}` (@SoAdmin, 5/min) devolve o código de 8 caracteres que a pessoa digita no WhatsApp (Aparelhos conectados > Conectar com número de telefone), `POST /v1/whatsapp/teste` (manda mensagem ao próprio número conectado), `DELETE /v1/whatsapp` (sai do aparelho e apaga tudo). Só `baileys-whatsapp.ts` conhece o Baileys (rc14, o mesmo da Fechai); o resto usa `PROVEDOR_WHATSAPP`/`WhatsappService.enviarTexto(orgId, telefone, texto)`. Uma conexão por fazenda NESTE processo (por isso uma cópia da API só); credenciais e chaves de sessão no REDIS, cifradas (`armazem-whatsapp.ts`: `wa:creds:<org>` e hash `wa:keys:<org>:<tipo>`, HMGET/HSET em lote, SCAN para apagar; AES-256-GCM com `WHATSAPP_CRIPTO_CHAVE`, `shared/cripto.ts`); no Postgres fica só `conexoes_whatsapp` (uma linha pequena por fazenda: pareado, número, quando conectou), porque as chaves mudam o tempo todo e crescem (decisão do Alisson: banco não pode inchar); religa sozinha ao subir e depois de queda (espera crescente); `connectionReplaced` NÃO apaga credenciais (deploy com duas cópias não pode desconectar a fazenda); `loggedOut` apaga. Mensagens saem em fila com pausa de 1,5–3,5 s (rajada derruba o número). Ligar em produção: `WHATSAPP_PROVEDOR=baileys`, `WHATSAPP_CRIPTO_CHAVE` e `REDIS_URL` no `talhio/api-env` (sem `REDIS_URL` em dev as credenciais ficam na memória e somem ao reiniciar); sem isso, dev usa provedor falso e produção responde `indisponivel`. Risco assumido: Baileys não é oficial e o WhatsApp pode banir o número; usar um número dedicado da fazenda. Grupo das notificações (12/11, pedido do Alisson: a pessoa escolhe o grupo): `GET /v1/whatsapp/grupos` (grupos do número conectado), `POST /v1/whatsapp/grupo {grupoId}` (só aceita grupo que está na lista do WhatsApp conectado; guarda id e nome em `conexoes_whatsapp.grupo_id/grupo_nome`), `DELETE /v1/whatsapp/grupo`; `EstadoWhatsapp.grupo`; o teste vai ao grupo (sem grupo, ao próprio número). Outros módulos mandam com `WhatsappService.notificarGrupo(orgId, texto)` (erros `WHATSAPP_NAO_CONECTADO`, `WHATSAPP_SEM_GRUPO`, `WHATSAPP_ENVIO_FALHOU`). App: `features/whatsapp` (`PassoWhatsapp` na Config: número > código para digitar > escolher grupo > conectado com teste/trocar/desconectar; `AlertaWhatsapp` faixa verde em cima do mapa no Início, só para administrador, enquanto falta conectar, digitar o código ou escolher o grupo). Botões que disparam no grupo (12/11): `POST /v1/relatorios/:periodo/envio?data=` (@SoAdmin; `RelatoriosEnvioService` manda o PDF com o resumo de legenda, texto em `relatorios/texto-whatsapp.ts`) e `POST /v1/whatsapp/mensagem {texto}` (@SoAdmin, até 4000 caracteres; a escala do dia e a escala do plano mandam o mesmo texto que a tela mostra); os dois devolvem `{ grupoNome }`. No app, `useEnviarAoGrupo` (`features/whatsapp`) serve aos quatro botões (relatório do Início, tela Relatórios, Escala, escala do plano): com WhatsApp conectado + grupo + administrador dispara no grupo; senão abre o WhatsApp do aparelho com o texto, como antes; a escala só é marcada como enviada se a mensagem saiu. Falta: os automáticos (máquina parada, talhão concluído, combustível baixo, resumo em horário fixo) com chave na Config, e telefone de cada operador.
- Escopo: só John Deere por enquanto. Work Plans é API restrita (ver `docs/JOHN-DEERE-API.md`);
  seguimos sem o envio do plano até a John Deere liberar.
- A tela Início usa o mapa real (`MapaResumo` de `features/mapa`), parado e sem rótulos.
- Rotas: abas em `src/app/(abas)`; telas em tela cheia (ex.: `mapa`) ficam em `src/app` e empilham
  por cima das abas.
- Mapa: talhões e máquinas são fontes GeoJSON com camadas (`CamadaTalhoes` e `CamadaMaquinas` do motor de mapa). Para atualizar
  posições, troque o dado da fonte; não crie um componente por máquina.
- Provisório: "em qual talhão" calculado em
  TypeScript (`shared/geo.ts`) em vez de PostGIS; fazenda fictícia, com uma imagem de
  demonstração sobreposta ao satélite real (`fazendaDemo`, duplicado no app e em `packages/deere`);
  tiles de satélite da Esri
  só para desenvolvimento (ver `mapa-motor/estilo.ts`); aba Escala pronta (abaixo).
- Falta: linha curva e de pivô, editar e apagar talhão e linha, checar contorno que cruza a si mesmo ou
  sobrepõe outro talhão, banco (Postgres + PostGIS), login, OAuth e
  `DeereProvedor` real, planejamento e envio, escala, ao vivo, relatórios, assistente de IA,
  regra de ESLint para bloquear import de arquivos internos de outra feature.

Visual: o app usa a mesma marca do site (desde 10/11): verde lavoura (`cores.mata`), milho, folha,
algodão e papel nos tokens; fontes Outfit (`fontes.titulo/rotulo/rotuloLeve`) e Nunito Sans
(`regular/medio/semi/italico`), trocadas das condensadas porque o Alisson não gostou delas. Formas sempre arredondadas (pílulas, raios grandes, sem cantos retos). `Marca` é o
símbolo das passadas. As telas das abas e as de formulário/detalhe (máquina, importar, planejar, escala do plano) têm topo verde arredondado (`CabecalhoTela`, com `voltar` e `progresso` em passadas; barra de status clara enquanto em foco). Telas de mapa mantêm controles flutuantes redondos. Botões principais são pílulas de milho com texto `sobreMilho`. Toda cor e fonte vem de
`shared/theme/tokens.ts`. O app é só tema claro.

## Referências

- O que a API da John Deere entrega, limites e links: [docs/JOHN-DEERE-API.md](./docs/JOHN-DEERE-API.md).
- Contexto do produto, decisões e escopo: [docs/CONTEXTO.md](./docs/CONTEXTO.md). Leia antes de propor mudanças de escopo.
- Guia de arquitetura: https://claude.ai/artifact/UviBkLA9dM7FAsjr614Lmh
- Protótipo das telas: https://claude.ai/artifact/7QHUAKkZynNw8p6x9GjDAj
