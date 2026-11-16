CREATE TABLE "area_das_operacoes" (
	"org_id" text NOT NULL,
	"maquina_id" text NOT NULL,
	"dia" text NOT NULL,
	"area_ha" double precision NOT NULL,
	"horas" double precision NOT NULL,
	"lido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "area_das_operacoes_org_id_maquina_id_dia_pk" PRIMARY KEY("org_id","maquina_id","dia")
);
--> statement-breakpoint
ALTER TABLE "area_das_operacoes" ADD CONSTRAINT "area_das_operacoes_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;