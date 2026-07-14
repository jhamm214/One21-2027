import "./globals.css";
import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import { CONTACT, CONFERENCE } from "@/lib/config";

const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-display",
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: `${CONFERENCE.name} — Registration`,
  description: "Register for the CENTURY 21 Judge Fite Company Conference.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <div className="shell">
          <header className="masthead">
            <div className="brand">
              <b>CENTURY 21 Judge Fite Company</b> — No. 1 in Texas and Oklahoma
            </div>
          </header>

          <main>{children}</main>

          {/* One contact. Every page. This is the whole point. */}
          <footer className="contact">
            <p>
              <b>Questions? {CONTACT.name}</b> is {CONTACT.role}.
              <br />
              C {CONTACT.mobile} &nbsp;|&nbsp; O {CONTACT.office}
              <br />
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
