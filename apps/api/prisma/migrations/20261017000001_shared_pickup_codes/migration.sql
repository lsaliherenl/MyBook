-- Books reserved together share one pickup code, so the code is no longer unique per reservation.
DROP INDEX "reservations_code_key";
CREATE INDEX "reservations_code_idx" ON "reservations"("code");
