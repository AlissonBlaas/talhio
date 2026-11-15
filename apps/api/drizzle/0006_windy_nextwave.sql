CREATE TABLE "atividade_deere" (
	"org_id" text NOT NULL,
	"operacao_id" text NOT NULL,
	"maquina_id" text NOT NULL,
	"dia" text NOT NULL,
	"horas" double precision NOT NULL,
	"area_ha" double precision NOT NULL,
	"combustivel_l" double precision NOT NULL,
	"parado_min" double precision NOT NULL,
	CONSTRAINT "atividade_deere_org_id_operacao_id_maquina_id_dia_pk" PRIMARY KEY("org_id","operacao_id","maquina_id","dia")
);
--> statement-breakpoint
CREATE TABLE "exportacoes_deere" (
	"org_id" text NOT NULL,
	"operacao_id" text NOT NULL,
	"versao" text NOT NULL,
	"lido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exportacoes_deere_org_id_operacao_id_pk" PRIMARY KEY("org_id","operacao_id")
);
--> statement-breakpoint
ALTER TABLE "atividade_deere" ADD CONSTRAINT "atividade_deere_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exportacoes_deere" ADD CONSTRAINT "exportacoes_deere_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atividade_deere_busca" ON "atividade_deere" USING btree ("org_id","maquina_id","dia");