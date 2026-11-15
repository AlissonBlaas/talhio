ALTER TABLE "uso_diario" ADD COLUMN "area_fora_ha" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
-- A regra da área mudou (conta em qualquer lugar, com a parte de fora dos talhões separada): os fechamentos já gravados
-- são apagados para a busca do passado refazê-los com a regra nova. São dados derivados do trajeto, nada se perde.
DELETE FROM "uso_diario";
