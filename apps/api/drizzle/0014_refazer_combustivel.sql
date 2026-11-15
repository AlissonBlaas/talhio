-- O cálculo antigo dos litros pela queda do tanque somava o balanço da boia como consumo (relatório de 12/11:
-- 85 e 129 L/h num 8270R que gasta 24). Os fechamentos que guardaram litros por esse cálculo saem; a busca do
-- passado refaz esses dias com a conta nova (queda líquida do nível).
DELETE FROM "uso_diario" WHERE "combustivel_l" IS NOT NULL;
