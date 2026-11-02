import "./globals.css";

export const metadata = {
  title: "Nova",
  description: "Nova, a simple AI chatbot",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
