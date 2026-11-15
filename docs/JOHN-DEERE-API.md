# John Deere: o que a API entrega para o relatório

Resumo das páginas oficiais (developer.deere.com) lidas em 09/11/2026: Field Operations,
Operations Data Export, Machine Engine Hours e Machine Hours Of Operation. Confira na fonte
antes de implementar: a John Deere avisa que colunas e formatos mudam sem aviso.

## De onde vem cada parte do relatório

| Dado no Talhio | API | Endpoint | Escopo |
|---|---|---|---|
| Operações feitas num talhão (plantio, aplicação, colheita, preparo) | Field Operations | `GET /organizations/{orgId}/fields/{fieldId}/fieldOperations` | ag2 |
| Totais da operação (área trabalhada, total plantado/aplicado/colhido, meta x realizado) | Field Operations | `GET /fieldOperations/{id}/measurementTypes[/{tipo}]` | ag2 |
| Imagem do mapa da operação, com legenda | Field Operations | mesmo endpoint, `Accept: application/vnd.deere.axiom.v3.image+json` | ag2 |
| Ponto a ponto (por onde a máquina passou) | Operations Data Export | `POST /operations/{id}/operationsExportRequests` e `GET .../{requestId}` | ag2 |
| Horímetro | Machine Engine Hours | `GET /machines/{id}/engineHours` | eq1 |
| Tempo com motor ligado e desligado no período | Machine Hours Of Operation | `GET /machines/{id}/hoursOfOperation` | eq1 |

Base Sandbox: `https://sandboxapi.deere.com/platform` (o export usa `/isg`).

## Exportação ponto a ponto (Operations Data Export)

- Substitui o antigo `GET /fieldOps/{operationId}`. Usar a nova desde o início.
- Assíncrona: o POST devolve `201` com o `requestId`; o GET devolve `requestStatus`
  (`IN_PROGRESS`, `SUCCESSFUL`, `FAILED`) e, ao terminar, `files[].presignedUri` com validade.
- Webhook `operationsExport` avisa quando o arquivo fica pronto (evita ficar consultando).
- Formatos: `SHAPEFILE` ou `ADAPT`. No shapefile vêm `.shp`, `.dbf`, `.prj` (WGS84) e um `.json`
  com unidades e os índices de máquina, operador, implemento, variedade e produto.
- `shapeType` e `resolution`: pedir `Polygon` + `OneHertz` (um polígono por segundo de trabalho).
  O padrão (`Point` + `EachSection`) pode chegar a 65 GB.
- Limite: 500 requisições por minuto por aplicativo.

Colunas úteis para o relatório (todas por ponto):

- Sempre que houver dado: `ISOTIME`, `HEADING`, `DISTANCE`, `SWATHWIDTH`, `SECTIONID`,
  `ELEVATION`, `MACHINE`, `IMPLEMENT`.
- Plantio e aplicação: `APPLIEDRATE` (realizado), `CONTROLRATE` e `TARGETRATE` (meta),
  `VARIETY` ou `PRODUCT`.
- Colheita: `VRYIELDVOL` ou `VRYIELDMAS`, `MOISTURE`.
- Preparo: `TILLTYPE`, profundidade e pressão (meta e realizado).
- Opcionais: `FUEL`, `VEHICLSPEED`, clima.

Regras da John Deere: a ordem das colunas não é garantida, uma coluna pode faltar se não houver
dado, e colunas novas aparecem sem aviso. Ler sempre pelo nome, sem diferenciar maiúsculas.
Área trabalhada = soma de `SWATHWIDTH` x `DISTANCE` (a área do polígono distorce nas curvas).

## Avisos de dado novo (webhook)

Evento de Field Operation dispara a cada criação, alteração ou exclusão. Filtro `orgId`
obrigatório; `fieldId`, `cropSeason` e `fieldOperationType` opcionais. Criar uma assinatura por
organização (a lista de orgs não pode ser alterada depois).

## Login (OAuth 2)

- Só fluxo "authorization code". Token de acesso vale 12 h; refresh token vale 365 dias sem uso
  (pedir o escopo `offline_access`).
- Depois do login falta um passo: `GET /organizations`; se vier o link `connections`, o usuário
  ainda precisa liberar a organização para o aplicativo.
- Pedir só os escopos usados. Para o Talhio: `ag1` (talhões), `ag2` (operações), `eq1`
  (máquinas), `work2` (planos de trabalho), `offline_access`. O Talhio também grava talhões, contornos,
  linhas e operadores, então pede `ag3` e `org2` (padrão em `DEERE_ESCOPOS`). `files` só se formos
  trocar arquivos. Pedido de acesso feito em 10/11/2026 (13 APIs, leitura e escrita; sem Delete); aguardando análise.
- Redirecionamento cadastrado no portal: `https://api.talhio.com.br/v1/deere/callback`, `http://localhost:9090/callback` e `talhio://deere`.
- Erros a tratar: `429` e `503` com `Retry-After`; `403` com `X-Deere-Terms-Location` (o dono da
  organização precisa aceitar termos novos).

## Tempo real (todas com escopo eq1)

| Dado no Talhio | API | Endpoint | Observação |
|---|---|---|---|
| Posição da máquina | Machine Locations | `GET /machines/{id}/locationHistory` | Latitude, longitude e altitude a cada chamada regular do modem. O intervalo não está na documentação. |
| Trajeto com velocidade, nível de combustível, direção e estado | Machine Locations | `GET /machines/{id}/breadcrumbs` | Gravado só enquanto a máquina trabalha. |
| Estado da conexão | Machine Device State Reports | `GET /machines/{id}/deviceStateReports` | Um relatório por chamada do modem: motor ligado, força do sinal (RSSI), rede (celular ou satélite), erro de GPS, tensão da bateria. |

Nenhuma das três aceita eTag: é consulta periódica mesmo.

## Envio do plano (Work Plans)

- O plano junta talhão, contorno, linhas de guia, produtos, prescrições, equipamento e operador.
- Vai sem fio só para monitores **Geração 4 (4200, 4240, 4600, 4640) e G5**. O operador confirma
  com um toque ao chegar no talhão.
- **GS3 2630 não está na lista.** A fazenda tem GS3 (pasta `GS3_2630` enviada pelo agrônomo).
- **Acesso restrito (verificado em 09/11/2026):** mesmo logado, o portal responde "You do not
  have access to view endpoints detail. Please contact support for this API". É preciso pedir
  acesso ao suporte da John Deere antes de implementar o envio do plano.

## Custo e contrato (API License Agreement, versão com data 13/05/2026)

Fonte: https://developer.deere.com/ApiAgreementPDF.pdf (Exhibit B). Os valores estão em branco no
documento público ("$", "$$", "$$$"); o preço só aparece no contrato assinado.

| Nível | APIs que usamos | Grátis até | Depois cobra por |
|---|---|---|---|
| Foundational | Fields, Boundaries, Guidance Lines, Equipment, Operators, Organizations, Webhooks, Files | sem limite publicado | — |
| Select Field Work | Field Operations (medições e totais) | 100 organizações com área trabalhada | organização |
| Select Equipment | locationHistory, deviceStateReports, engineHours, hoursOfOperation | 100 equipamentos | equipamento |
| Premium Field Work | Operations Data Export (ponto a ponto) | 100 organizações com área trabalhada | organização |
| Premium Equipment | breadcrumbs | 100 equipamentos | equipamento |
| Ultimate Field Work | **Work Plans**, Work Plans Transfer, Files Transfer, Prescriptions | **10 organizações com área trabalhada** | organização |
| Ultimate Equipment | machineMeasurements (medições detalhadas) | 10 equipamentos | equipamento |

- Cobrança anual, com acerto no fim do período; pagamento em 45 dias; atraso: 1,5% ao mês.
- A John Deere pode: revogar a chave na hora por vazamento ou quebra de contrato; limitar o
  volume se as chamadas prejudicarem o serviço; suspender após mudança relevante no aplicativo
  sem revisão; encerrar sem motivo com 90 dias de aviso.

## Em aberto (medir no teste com 1 trator)

- Quanto tempo depois do trabalho a operação aparece na API.
- Se a coluna `FUEL` vem preenchida nos tratores da fazenda.
- Se o operador aparece sem ninguém selecionar no monitor.
- De quanto em quanto tempo o modem manda posição (define o "ao vivo").
- Quantos tratores têm Gen4/G5 e quantos têm GS3 2630.
- Preço por organização acima dos limites e condições para aprovar Work Plans (perguntar ao suporte).
- Limite de organizações no Sandbox e o que a revisão para produção exige (não confirmado em fonte oficial).
- Ativação automática do plano ao entrar no talhão: em quais monitores e com quais condições.
- Como mandar linhas e plano para o GS3 2630 sem pen drive, se for possível.

## Links da documentação oficial

O portal só carrega no navegador (leitura automática devolve a página vazia). Algumas páginas
mostram os endpoints apenas com login.

- Lista de APIs: https://developer.deere.com/dev-doc-landing
- Work Plans (endpoints só com login): https://developer.deere.com/dev-docs/work-plans
- Machine Device State Reports: https://developer.deere.com/dev-docs/machine-device-state-reports
- Machine Locations: https://developer.deere.com/dev-docs/machine-locations
- Field Operations: https://developer.deere.com/dev-docs/field-operations
- Operations Data Export: https://developer.deere.com/dev-docs/operations-export
- Machine Hours Of Operation: https://developer.deere.com/dev-docs/machine-hours-of-operation
- Machine Engine Hours: https://developer.deere.com/dev-docs/machine-engine-hours
