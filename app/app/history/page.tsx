import { AppNav } from "@/components/SiteChrome";
import { HistoryIntro } from "@/components/HistoryIntro";
import { HistoryList } from "@/components/HistoryList";

export const metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <main className="page">
      <AppNav current="history" />
      <HistoryIntro />
      <HistoryList />
    </main>
  );
}
