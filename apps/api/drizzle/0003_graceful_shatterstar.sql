CREATE TABLE "planos" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"talhao_ids" jsonb NOT NULL,
	"maquina_ids" jsonb NOT NULL,
	"operacao" text NOT NULL,
	"cultura" text,
	"variedade" text,
	"sementes_por_ha" double precision,
	"espacamento_cm" double precision,
	"produto" text,
	"dose_produto" double precision,
	"data_inicio" text NOT NULL,
	"recado" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planos" ADD CONSTRAINT "planos_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planos_org_idx" ON "planos" USING btree ("org_id","criado_em");