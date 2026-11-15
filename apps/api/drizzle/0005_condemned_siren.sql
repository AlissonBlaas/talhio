CREATE TABLE "conexoes_deere" (
	"org_id" text PRIMARY KEY NOT NULL,
	"acesso_cifrado" text NOT NULL,
	"renovacao_cifrada" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"escopos" text NOT NULL,
	"deere_org_id" text,
	"deere_org_nome" text,
	"precisa_liberar" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conexoes_deere" ADD CONSTRAINT "conexoes_deere_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;