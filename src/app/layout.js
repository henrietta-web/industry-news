import { Inter } from "next/font/google";
import "./globals.css";

// This pulls in the sleek, modern font
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Industry Radar",
  description: "Curated TV & Film News",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* This applies the font and a very subtle off-white background */}
      <body className={`${inter.className} bg-slate-50 text-slate-800 antialiased`}>
        {children}
      </body>
    </html>
  );
}