-- Business rules the database enforces on its own, so concurrent desk actions cannot break them.
-- (Prisma's schema language cannot express partial indexes or check constraints, hence raw SQL.)

-- A copy can be in at most one active loan.
CREATE UNIQUE INDEX "loans_one_active_per_copy" ON "loans" ("copy_id") WHERE "status" = 'ACTIVE';

-- A copy can be on hold for at most one reservation.
CREATE UNIQUE INDEX "reservations_one_ready_per_copy" ON "reservations" ("copy_id") WHERE "status" = 'READY';

-- A member cannot queue twice for the same title.
CREATE UNIQUE INDEX "reservations_one_open_per_member_book" ON "reservations" ("member_id", "book_id")
  WHERE "status" IN ('PENDING', 'READY');

ALTER TABLE "loans"
  ADD CONSTRAINT "loans_due_after_checkout" CHECK ("due_at" > "checked_out_at"),
  ADD CONSTRAINT "loans_renew_count_non_negative" CHECK ("renew_count" >= 0),
  ADD CONSTRAINT "loans_returned_has_date" CHECK (("status" = 'RETURNED') = ("returned_at" IS NOT NULL));

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_ready_has_copy" CHECK ("status" <> 'READY' OR ("copy_id" IS NOT NULL AND "expires_at" IS NOT NULL));

ALTER TABLE "fines"
  ADD CONSTRAINT "fines_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "books"
  ADD CONSTRAINT "books_isbn13_format" CHECK ("isbn13" IS NULL OR "isbn13" ~ '^97[89][0-9]{10}$'),
  ADD CONSTRAINT "books_page_count_positive" CHECK ("page_count" IS NULL OR "page_count" > 0);

ALTER TABLE "library_settings"
  ADD CONSTRAINT "library_settings_single_row" CHECK ("id" = 1),
  ADD CONSTRAINT "library_settings_positive_rules" CHECK (
    "loan_days" > 0 AND "max_active_loans" > 0 AND "max_renewals" >= 0
    AND "pickup_window_hours" > 0 AND "fine_per_day" >= 0 AND "fine_block_threshold" >= 0
  );

INSERT INTO "library_settings" ("id", "updated_at") VALUES (1, now());
