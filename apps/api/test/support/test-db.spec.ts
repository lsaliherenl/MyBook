import { createBook, createMember, createTestDb, type TestDb } from './test-db.js';

describe('test database', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(() => db.close());

  it('applies the migrations, the sign-up trigger and the sequences', async () => {
    const member = await createMember(db);
    expect(member.cardNumber).toBe('MB00000001');
    const book = await createBook(db, 'Tutunamayanlar', 2);
    expect(book.copies.map((c) => c.barcode)).toEqual(['BK0000001', 'BK0000002']);
    const settings = await db.prisma.librarySettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(settings.loanDays).toBe(14);
  });

  it('enforces one active loan per copy', async () => {
    const [a, b] = [await createMember(db), await createMember(db)];
    const book = await createBook(db);
    const loan = (memberId: string) =>
      db.prisma.loan.create({
        data: { copyId: book.copies[0].id, memberId, checkedOutById: memberId, dueAt: new Date(Date.now() + 86_400_000) },
      });
    await loan(a.id);
    await expect(loan(b.id)).rejects.toThrow();
  });
});
