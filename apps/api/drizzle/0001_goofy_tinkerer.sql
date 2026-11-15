CREATE TABLE "conversas" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"titulo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensagens" (
	"id" text PRIMARY KEY NOT NULL,
	"conversa_id" text NOT NULL,
	"papel" text NOT NULL,
	"texto" text NOT NULL,
	"ordem" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversa_id_conversas_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."conversas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversas_usuario_idx" ON "conversas" USING btree ("usuario_id","atualizado_em");--> statement-breakpoint
CREATE INDEX "mensagens_conversa_idx" ON "mensagens" USING btree ("conversa_id","ordem");