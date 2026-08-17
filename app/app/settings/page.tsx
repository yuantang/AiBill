import { AppNav } from "@/components/SiteChrome";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SettingsIntro } from "@/components/SettingsIntro";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="page">
      <AppNav current="settings" />
      <SettingsIntro />
      <SettingsPanel />
    </main>
  );
}
