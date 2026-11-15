/** Todo o texto da página. O que está aqui também alimenta os dados estruturados (SEO). */

/** Relatório de exemplo. É demonstração: os números não são de uma fazenda real. */
export const relatorio = {
  periodo: "Hoje · terça, 10 de novembro",
  numeros: [
    { valor: "112 ha", rotulo: "Área trabalhada", variacao: "14% a mais que ontem" },
    { valor: "31h", rotulo: "Horas de máquina", variacao: "2h a mais que ontem" },
    { valor: "2h10", rotulo: "Tempo parado", variacao: "40 min a menos que ontem" },
  ],
  maquinas: [
    { nome: "Trator 8R 410", area: "44 ha", parte: 100 },
    { nome: "Trator 8R 370", area: "41 ha", parte: 93 },
    { nome: "Trator 7R 330", area: "27 ha", parte: 61 },
  ],
  resumo: "O plantio avançou 112 ha, 14% acima de ontem. A maior parada foi do Trator 6M 195, com 1h20.",
} as const;

/** O trabalho que o relatório tira da mão do agrônomo. */
export const antes = [
  "Pedir o número de cada máquina por rádio ou telefone",
  "Juntar tudo numa planilha no fim do dia",
  "Conferir hectares, horas e paradas na mão",
  "Escrever o resumo e mandar para o grupo",
] as const;

export const depois = [
  "As máquinas John Deere aparecem no mapa, sem ligar para ninguém",
  "Hectares, horas e paradas chegam calculados e comparados com ontem",
  "O resumo sai escrito: você revisa e manda",
  "Ficou em dúvida? Pergunte à IA, com os números da sua fazenda",
] as const;

/** O que o relatório entrega. */
export const sobreORelatorio = [
  { titulo: "Dia e semana, sempre comparados", texto: "Hoje contra ontem, e os últimos sete dias contra os sete anteriores. Você vê na hora se melhorou ou piorou." },
  { titulo: "Máquina por máquina", texto: "Hectares, horas trabalhadas e tempo parado de cada uma, com a maior parada do período em destaque." },
  { titulo: "Pergunte sobre qualquer número", texto: "Ficou em dúvida? A IA explica o relatório e responde o que ele não mostra de cara." },
] as const;

/** Mensagens de exemplo do grupo da equipe. É demonstração: nomes e números não são de uma fazenda real. */
export const grupo = [
  {
    hora: "18:04",
    titulo: "Plantio de soja · Talhão 7",
    linhas: ["Começa amanhã · 65.000 sementes/ha", "João: Trator 8R 410 (Plantadeira DB60)", "Pedro: Trator 7R 330 · manhã", "Recado: começar pela cabeceira perto da estrada."],
  },
  {
    hora: "19:12",
    titulo: "Relatório de hoje",
    linhas: ["112 ha plantados · 14% a mais que ontem", "31h de máquina · 2h10 parado", "Maior parada: Trator 6M 195, 1h20"],
  },
] as const;

/** O que o Talhio resolve para a equipe. */
export const sobreAEquipe = [
  { titulo: "A escala sai do plano", texto: "Escolha o operador e o turno de cada máquina do plano. O Talhio avisa se a mesma pessoa foi parar em duas máquinas no mesmo turno." },
  { titulo: "Uma mensagem, pronta para o grupo", texto: "Máquina, talhão, tarefa e o seu recado, tudo em uma mensagem. Um toque abre o WhatsApp com ela escrita." },
  { titulo: "O dia fecha sozinho", texto: "Hectares, horas e paradas do dia e da semana chegam prontos, e vão para o grupo do mesmo jeito." },
] as const;

/** Conversa de exemplo da seção de IA. É demonstração: os números não são de uma fazenda real. */
export const conversa = [
  { de: "voce", texto: "Qual foi a maior parada de hoje?" },
  { de: "ia", texto: "A maior parada de hoje foi do Trator 6M 195: 1h20, sem talhão associado. Ele está parado desde as 11h33." },
  { de: "voce", texto: "E o plantio do talhão 7, como está?" },
  { de: "ia", texto: "O talhão 7 está com 68% plantado. Três tratores trabalharam nele hoje; um ficou sem sinal às 7h15 e os dados dele entram quando reconectar." },
] as const;

export const exemplosDePergunta = ["Quantos hectares fizemos esta semana?", "Qual máquina ficou mais tempo parada?", "O que mudou em relação a ontem?", "Quem está em qual talhão agora?"] as const;

/** O que a IA faz e o que ela não faz. */
export const sobreAIa = [
  { titulo: "Responde com os números da sua fazenda", texto: "Máquinas, talhões e os relatórios do dia e da semana entram na resposta. Nada de resposta genérica de internet." },
  { titulo: "Por texto ou por voz", texto: "Fale a pergunta no celular, no meio do serviço. Ela vira texto para você conferir antes de enviar." },
  { titulo: "Não faz conta de cabeça", texto: "Hectares, horas e paradas são calculados pelo sistema. A IA só escreve a resposta com esses números." },
] as const;

export const recursos = [
  { icone: "mapa", titulo: "O talhão em tempo real", texto: "Cada talhão no satélite, com as máquinas em cima, as linhas do trator e o quanto já foi feito. Máquina parada ou sem sinal aparece no mapa e vira aviso." },
  { icone: "plano", titulo: "Planejamento do talhão", texto: "Operação, cultura, variedade, taxa, data e as máquinas que vão fazer. Um plano por talhão, ou o mesmo para vários." },
  { icone: "escala", titulo: "Escala da equipe", texto: "Quem vai em qual máquina e em qual talhão, por turno. Sai numa mensagem pronta para o grupo do WhatsApp." },
  { icone: "relatorio", titulo: "Relatório pronto", texto: "Hectares, horas de máquina e tempo parado do dia e da semana, por máquina e comparados com o período anterior. E você pode perguntar à IA sobre qualquer número dele." },
  { icone: "assistente", titulo: "Assistente de IA", texto: "Pergunte por texto ou por voz e receba a resposta com os dados da operação, com o histórico das conversas guardado." },
  { icone: "importar", titulo: "Comece com o que já existe", texto: "Importe os talhões e as linhas do monitor Geração 4 da máquina. Não precisa redesenhar a fazenda." },
] as const;

export const passos = [
  { titulo: "Escolha o talhão", texto: "Toque no talhão no mapa, ou desenhe um novo e defina a linha do piloto automático." },
  { titulo: "Monte o plano", texto: "Diga o que vai ser feito, com qual cultura e taxa, quando começa e com quais máquinas." },
  { titulo: "Escale a equipe", texto: "Escolha o operador e o turno de cada máquina e mande a escala no WhatsApp." },
  { titulo: "Acompanhe e pergunte", texto: "Veja o talhão avançar no mapa, pergunte à IA o que quiser saber e, no fim do dia, o relatório já está montado." },
] as const;

export const integracao = [
  { estado: "Pronto", titulo: "Talhões e linhas por arquivo", texto: "Importação da pasta de configuração do monitor Geração 4 (4200, 4240, 4600 e 4640)." },
  { estado: "Em desenvolvimento", titulo: "Conexão com o Operations Center", texto: "Máquinas, posição, horas e operações de campo direto da conta da fazenda, com a autorização dela." },
  { estado: "Em análise", titulo: "Envio do plano ao monitor", texto: "Depende de liberação da John Deere. Até lá, o plano chega à equipe pela escala." },
] as const;

export const perguntas = [
  { pergunta: "O que quer dizer “tempo real”?", resposta: "O mapa e os números se atualizam sozinhos enquanto você olha, com o último dado que a máquina enviou. O intervalo depende da conexão da máquina; quando ela fica sem sinal, o Talhio mostra o horário do último dado e atualiza quando ela reconecta." },
  { pergunta: "O Talhio manda mensagem sozinho no WhatsApp?", resposta: "Hoje não. Ele monta a mensagem da escala ou do relatório e abre o seu WhatsApp com ela pronta; você escolhe o grupo e envia. O envio automático para cada operador é um próximo passo." },
  { pergunta: "A IA pode inventar um número?", resposta: "Os números (hectares, horas, paradas) são calculados pelo sistema a partir dos dados das máquinas; a IA só escreve a resposta com eles. Como toda IA, ela pode se enganar ao escrever, então o relatório é sempre a referência." },
  { pergunta: "O que a IA sabe sobre a minha fazenda?", resposta: "O que está no Talhio: máquinas, talhões, andamento e os relatórios do dia e da semana. Cada usuário só vê as próprias conversas, e os dados de uma fazenda não aparecem para outra." },
  { pergunta: "O Talhio funciona com quais marcas de máquina?", resposta: "Por enquanto, só John Deere. Começamos por uma marca para fazer bem feito; outras entram depois." },
  { pergunta: "Preciso trocar o monitor ou instalar algum aparelho na máquina?", resposta: "Não. O Talhio usa o que a máquina já envia para o John Deere Operations Center e os arquivos do próprio monitor." },
  { pergunta: "O Talhio fica com a minha senha da John Deere?", resposta: "Não. A fazenda autoriza o acesso na página da própria John Deere e pode cancelar essa autorização quando quiser. O Talhio nunca vê a senha." },
  { pergunta: "E quando a máquina fica sem sinal no campo?", resposta: "Ela aparece como “sem sinal” no mapa e no relatório, com o horário do último dado. As informações entram quando a máquina volta a se conectar." },
  { pergunta: "Tem para iPhone e Android?", resposta: "Sim, o aplicativo é feito para os dois." },
  { pergunta: "Quanto custa?", resposta: "Ainda estamos definindo os planos. Fale com a gente e conte o tamanho da sua operação." },
] as const;
