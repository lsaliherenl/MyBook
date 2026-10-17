-- Event pages: the book to bring, programme/host/directions details, and RSVP reminders.
-- AlterTable
ALTER TABLE "events" ADD COLUMN     "book_id" UUID,
ADD COLUMN     "details" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "event_registrations" ADD COLUMN     "remind" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

