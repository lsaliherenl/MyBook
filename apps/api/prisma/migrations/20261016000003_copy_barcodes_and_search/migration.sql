-- Sequential copy barcodes: BK0000001, BK0000002, …
CREATE SEQUENCE "copy_barcode_seq";
ALTER TABLE "book_copies"
  ALTER COLUMN "barcode" SET DEFAULT ('BK'::text || lpad((nextval('copy_barcode_seq'::regclass))::text, 7, '0'::text));
REVOKE USAGE, SELECT ON SEQUENCE "public"."copy_barcode_seq" FROM anon, authenticated;

-- Turkish-insensitive search: the API stores foldForSearch(...) of the searchable fields and
-- queries it with LIKE '%term%', which this trigram index serves.
ALTER TABLE "books" ADD COLUMN "search_text" TEXT NOT NULL DEFAULT '';
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";
CREATE INDEX "books_search_text_trgm" ON "books" USING gin ("search_text" "extensions"."gin_trgm_ops");
