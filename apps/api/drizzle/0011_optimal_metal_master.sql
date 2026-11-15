CREATE TABLE "larguras_de_implemento" (
	"org_id" text NOT NULL,
	"maquina_id" text NOT NULL,
	"largura_m" double precision NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "larguras_de_implemento_org_id_maquina_id_pk" PRIMARY KEY("org_id","maquina_id")
);
--> statement-breakpoint
ALTER TABLE "larguras_de_implemento" ADD CONSTRAINT "larguras_de_implemento_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;