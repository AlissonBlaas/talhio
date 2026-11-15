CREATE TABLE "combustivel_acumulado" (
	"org_id" text NOT NULL,
	"serie" text NOT NULL,
	"dia" text NOT NULL,
	"litros" double precision NOT NULL,
	"lido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "combustivel_acumulado_org_id_serie_dia_pk" PRIMARY KEY("org_id","serie","dia")
);
--> statement-breakpoint
ALTER TABLE "combustivel_acumulado" ADD CONSTRAINT "combustivel_acumulado_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;