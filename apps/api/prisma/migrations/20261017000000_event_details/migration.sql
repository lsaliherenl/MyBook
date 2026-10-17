-- Event kinds for the events page filters, bilingual locations, notices without sign-up and an event waitlist.

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('BOOK_CLUB', 'WORKSHOP', 'TALK', 'NOTICE');

-- AlterTable
ALTER TABLE "events" RENAME COLUMN "location" TO "location_tr";
ALTER TABLE "events"
ADD COLUMN "kind" "EventKind" NOT NULL DEFAULT 'TALK',
ADD COLUMN "location_en" TEXT,
ADD COLUMN "rsvp_required" BOOLEAN NOT NULL DEFAULT true;
UPDATE "events" SET "location_en" = "location_tr";
ALTER TABLE "events" ALTER COLUMN "location_en" SET NOT NULL;

ALTER TABLE "events" ADD CONSTRAINT "events_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "events" ADD CONSTRAINT "events_ends_after_start" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

-- AlterTable
ALTER TABLE "event_registrations" ADD COLUMN "waitlisted" BOOLEAN NOT NULL DEFAULT false;
