import "./globals.css";

export const metadata = {
  title: "Xura Lab — Fragrance beyond familiarity",
  description: "Discover Arven, Velor, and Nyra by Xura Lab. Fragrance with character, intention, and a connection that feels like you."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
