import { prisma } from "./db";
import { lineWrite } from "./lines";
import { CASH_SOURCES } from "./store";
import type { Line } from "./types";

export async function saveReceiptLines(userId: string, lines: Line[]): Promise<Line[]> {
  const saved: Line[] = [];
  for (const line of lines) {
    const existing = await prisma.billLine.findFirst({
      where: { userId, name: line.name, kind: line.kind, source: { in: [...CASH_SOURCES] } },
    });
    if (existing) {
      const row = await prisma.billLine.update({
        where: { id: existing.id },
        data: lineWrite({ ...line, id: existing.id }),
      });
      saved.push({ ...line, id: row.id });
    } else {
      const row = await prisma.billLine.create({
        data: { userId, ...lineWrite(line) },
      });
      saved.push({ ...line, id: row.id });
    }
  }
  return saved;
}
