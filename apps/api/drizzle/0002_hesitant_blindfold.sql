CREATE TABLE "escalas" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"dia" text NOT NULL,
	"maquina_id" text NOT NULL,
	"operador" text NOT NULL,
	"tarefa" text,
	"talhao_id" text,
	"turno" text DEFAULT 'dia-todo' NOT NULL,
	"enviada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "escalas_org_dia_maquina_idx" ON "escalas" USING btree ("org_id","dia","maquina_id");