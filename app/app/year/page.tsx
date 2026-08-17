import { AppNav } from "@/components/SiteChrome";
import { YearView } from "@/components/YearView";

export const metadata = { title: "This year" };

export default function YearPage() {
  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <AppNav current="year" />
      </div>
      <YearView />
    </>
  );
}
