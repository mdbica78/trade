CREATE TABLE "ai_custom_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_custom_providers_name_length" CHECK (char_length("ai_custom_providers"."name") between 1 and 40),
	CONSTRAINT "ai_custom_providers_base_url_https" CHECK ("ai_custom_providers"."base_url" like 'https://%' and char_length("ai_custom_providers"."base_url") <= 200)
);
