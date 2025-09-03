import "./globals.css";

export const metadata = {
  title: "GPT‑Chat (Ollama)",
  description: "Local Ollama‑powered chat UI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full bg-gray-50 font-sans">
        {children}
      </body>
    </html>
  );
}