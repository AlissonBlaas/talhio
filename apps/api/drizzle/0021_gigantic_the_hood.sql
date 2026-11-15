CREATE TABLE "dispositivos_push" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"org_id" text NOT NULL,
	"token" text NOT NULL,
	"plataforma" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispositivos_push_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"chave" text NOT NULL,
	"tipo" text NOT NULL,
	"severidade" text NOT NULL,
	"maquina_id" text,
	"maquina_nome" text,
	"titulo" text NOT NULL,
	"texto" text NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvida_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notificacoes_lidas" (
	"usuario_id" text PRIMARY KEY NOT NULL,
	"lido_ate" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dispositivos_push" ADD CONSTRAINT "dispositivos_push_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispositivos_push" ADD CONSTRAINT "dispositivos_push_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes_lidas" ADD CONSTRAINT "notificacoes_lidas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispositivos_push_org_idx" ON "dispositivos_push" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "notificacoes_org_criada_idx" ON "notificacoes" USING btree ("org_id","criada_em");--> statement-breakpoint
CREATE INDEX "notificacoes_org_chave_idx" ON "notificacoes" USING btree ("org_id","chave");