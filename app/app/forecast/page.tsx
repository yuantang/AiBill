import { AppNav } from "@/components/SiteChrome";
import { ForecastView } from "@/components/ForecastView";

export const metadata = { title: "Forecast" };

export default function ForecastPage() {
  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <AppNav current="forecast" />
      </div>
      <ForecastView />
    </>
  );
}
