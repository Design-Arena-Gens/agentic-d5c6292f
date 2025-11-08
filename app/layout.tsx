export const metadata = {
  title: "Reel Agent",
  description: "AI-powered reel creator agent",
};

import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
