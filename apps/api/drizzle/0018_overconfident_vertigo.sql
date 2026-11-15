CREATE TABLE "combustivel_importado" (
	"org_id" text NOT NULL,
	"maquina_id" text NOT NULL,
	"dia" text NOT NULL,
	"litros" double precision NOT NULL,
	"horas_motor" double precision,
	"importado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "combustivel_importado_org_id_maquina_id_dia_pk" PRIMARY KEY("org_id","maquina_id","dia")
);
--> statement-breakpoint
ALTER TABLE "combustivel_importado" ADD CONSTRAINT "combustivel_importado_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;