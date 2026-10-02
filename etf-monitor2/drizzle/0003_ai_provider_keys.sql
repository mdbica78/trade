CREATE TABLE "ai_provider_keys" (
	"provider_id" text PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"key_source" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
