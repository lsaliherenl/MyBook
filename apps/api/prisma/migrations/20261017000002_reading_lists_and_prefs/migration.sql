-- Members' own reading lists and their notification preferences.
-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "notification_prefs" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "reading_lists" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reading_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_list_items" (
    "list_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_list_items_pkey" PRIMARY KEY ("list_id","book_id")
);

-- CreateIndex
CREATE INDEX "reading_lists_member_id_idx" ON "reading_lists"("member_id");

-- AddForeignKey
ALTER TABLE "reading_lists" ADD CONSTRAINT "reading_lists_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_list_items" ADD CONSTRAINT "reading_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "reading_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_list_items" ADD CONSTRAINT "reading_list_items_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "reading_lists" ADD CONSTRAINT "reading_lists_name_length" CHECK (char_length(trim("name")) BETWEEN 1 AND 80);
CREATE INDEX "reading_list_items_book_id_idx" ON "reading_list_items"("book_id");

-- Like every public table, reachable only through the API (see 20261016000002_supabase_auth_and_rls).
ALTER TABLE "reading_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reading_list_items" ENABLE ROW LEVEL SECURITY;
