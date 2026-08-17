import { ImageResponse } from "next/og";

export const alt = "AI Bill — what you actually paid this month across every AI tool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#efe6d6",
          color: "#1c1712",
          padding: "64px 72px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 2, textTransform: "uppercase", color: "#6a6156" }}>
          AI Bill
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 64, lineHeight: 1.1, maxWidth: 900 }}>What you actually paid this month.</div>
          <div style={{ fontSize: 28, color: "#6a6156", maxWidth: 820 }}>
            Claude, Cursor, ChatGPT, and API invoices. One USD number that matches the card.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#8a3414" }}>
          <span>$184 this month</span>
          <span>Not token × list price</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
