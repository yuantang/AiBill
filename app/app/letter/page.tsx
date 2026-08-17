import { AppNav } from "@/components/SiteChrome";
import { LetterView } from "@/components/LetterView";

export const metadata = { title: "Monday" };

export default function LetterPage() {
  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <AppNav current="letter" />
      </div>
      <LetterView />
    </>
  );
}
