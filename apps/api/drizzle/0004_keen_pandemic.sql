CREATE TABLE "fazendas_importadas" (
	"org_id" text PRIMARY KEY NOT NULL,
	"dados" jsonb NOT NULL,
	"importada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fazendas_importadas" ADD CONSTRAINT "fazendas_importadas_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;