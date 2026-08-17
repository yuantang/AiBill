import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { PRODUCT } from "@/lib/product";
import { SEO, siteUrl } from "@/lib/site";
import "./globals.css";

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: SEO.title,
    template: "%s · AI Bill",
  },
  description: SEO.description,
  applicationName: PRODUCT.name,
  openGraph: {
    title: SEO.title,
    description: SEO.description,
    siteName: PRODUCT.name,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SEO.title,
    description: SEO.description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=JSON.parse(localStorage.getItem('aibill.v1')||'{}').settings||{};if(s.theme==='dark')document.documentElement.dataset.theme='dark';var l=s.locale||localStorage.getItem('aibill.locale');if(l)document.documentElement.lang=l}catch(e){}",
          }}
        />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
