import { AppNav } from "@/components/SiteChrome";
import { BillApp } from "@/components/BillApp";

export const metadata = { title: "This month" };

export default function AppHomePage() {
  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <AppNav current="bill" />
      </div>
      <BillApp />
    </>
  );
}
