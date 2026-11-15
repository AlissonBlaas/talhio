CREATE TABLE "uso_diario" (
	"org_id" text NOT NULL,
	"maquina_id" text NOT NULL,
	"dia" text NOT NULL,
	"trabalhando_h" double precision NOT NULL,
	"ocioso_h" double precision NOT NULL,
	"transporte_h" double precision NOT NULL,
	"area_ha" double precision NOT NULL,
	"paradas" integer NOT NULL,
	"por_talhao" jsonb NOT NULL,
	"pontos" integer NOT NULL,
	"fechado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uso_diario_org_id_maquina_id_dia_pk" PRIMARY KEY("org_id","maquina_id","dia")
);
--> statement-breakpoint
ALTER TABLE "uso_diario" ADD CONSTRAINT "uso_diario_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;