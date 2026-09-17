import type { Metadata } from "next";
import { Archivo_Black, Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
});

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start-2p",
  subsets: ["latin"],
  weight: "400",
});

const vt323 = VT323({
  variable: "--font-vt323",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Happy Birthday, Audrey!",
  description:
    "A birthday website for Audrey's 24th — sign the guestbook, add a song to her playlist, and drop a photo in the album.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivoBlack.variable} ${pressStart2P.variable} ${vt323.variable}`}>
      <body>{children}</body>
    </html>
  );
}
