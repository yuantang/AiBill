import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatCny } from "@/lib/ledger";

export const metadata = {
  title: "Statement",
  robots: { index: false, follow: false },
};

export default async function SharedStatementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await prisma.shareLink.findUnique({ where: { token } });
  if (!row || row.expiresAt.getTime() < Date.now()) notFound();
  return (
    <main className="page">
      <article className="statement-sheet">
        <p className="kicker">AI Bill · {row.month}</p>
        <h1>{formatCny(row.totalCny)}</h1>
        <p className="hint">Read-only statement. Expires in 14 days. Not a bank receipt.</p>
        <pre>{row.statement}</pre>
      </article>
    </main>
  );
}
