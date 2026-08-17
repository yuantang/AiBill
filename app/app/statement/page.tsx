import { AppNav } from "@/components/SiteChrome";
import { StatementView } from "@/components/StatementView";

export const metadata = { title: "Statement" };

export default function StatementPage() {
  return (
    <>
      <div className="page no-print" style={{ paddingBottom: 0 }}>
        <AppNav current="statement" />
      </div>
      <StatementView />
    </>
  );
}
