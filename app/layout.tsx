import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import "./globals.css";
import { LanguageProvider } from "./language-provider";

export const metadata: Metadata = {
  title: "Badminton Court Booking",
  description: "Online badminton court booking system",
};

function getInitialLocale(value: string | undefined): Locale {
  return value === "th" || value === "en" ? value : "en";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLocale = getInitialLocale(cookieStore.get("locale")?.value);

  return (
    <html
      lang={initialLocale}
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider initialLocale={initialLocale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
