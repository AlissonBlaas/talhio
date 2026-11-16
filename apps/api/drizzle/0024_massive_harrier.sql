DROP INDEX "escalas_org_dia_maquina_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "escalas_org_dia_maquina_turno_idx" ON "escalas" USING btree ("org_id","dia","maquina_id","turno");