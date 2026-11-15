CREATE TABLE "conexoes_whatsapp" (
	"org_id" text PRIMARY KEY NOT NULL,
	"pareado" boolean DEFAULT false NOT NULL,
	"numero" text,
	"conectado_em" timestamp with time zone,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conexoes_whatsapp" ADD CONSTRAINT "conexoes_whatsapp_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;