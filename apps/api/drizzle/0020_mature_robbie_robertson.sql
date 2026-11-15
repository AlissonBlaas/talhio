ALTER TABLE "combustivel_importado" ADD COLUMN "litros_trabalhando" double precision;--> statement-breakpoint
ALTER TABLE "combustivel_importado" ADD COLUMN "litros_ocioso" double precision;--> statement-breakpoint
ALTER TABLE "combustivel_importado" ADD COLUMN "litros_transporte" double precision;--> statement-breakpoint
ALTER TABLE "combustivel_importado" ADD COLUMN "horas_trabalhando" double precision;--> statement-breakpoint
ALTER TABLE "combustivel_importado" ADD COLUMN "horas_ocioso" double precision;--> statement-breakpoint
ALTER TABLE "combustivel_importado" ADD COLUMN "horas_transporte" double precision;--> statement-breakpoint
ALTER TABLE "combustivel_importado" ADD COLUMN "fonte" text DEFAULT 'csv' NOT NULL;