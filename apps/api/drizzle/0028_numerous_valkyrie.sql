CREATE TABLE "traducoes" (
	"chave" text PRIMARY KEY NOT NULL,
	"original" text NOT NULL,
	"traducao" text NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notificacoes" ADD COLUMN "texto_original" text;