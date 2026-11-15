CREATE TABLE "linhas" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"talhao_id" text,
	"nome" text NOT NULL,
	"a" jsonb NOT NULL,
	"b" jsonb NOT NULL,
	"direcao_graus" double precision NOT NULL,
	"padrao_da_fazenda" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizacoes" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talhoes" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"nome" text NOT NULL,
	"cultura" text,
	"area_ha" double precision NOT NULL,
	"contorno" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"papel" text DEFAULT 'admin' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "linhas" ADD CONSTRAINT "linhas_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talhoes" ADD CONSTRAINT "talhoes_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_org_id_organizacoes_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "linhas_org_idx" ON "linhas" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sessoes_expira_idx" ON "sessoes" USING btree ("expira_em");--> statement-breakpoint
CREATE INDEX "talhoes_org_idx" ON "talhoes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "usuarios_org_idx" ON "usuarios" USING btree ("org_id");