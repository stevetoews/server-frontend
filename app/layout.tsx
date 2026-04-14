import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Server Maintenance Platform",
  description: "Internal admin UI for deterministic server checks, incidents, and onboarding.",
};

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/servers/new", label: "Add Server" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
            <header className="mb-8 flex flex-col gap-4 rounded-[1.75rem] border border-border/70 bg-white/70 px-6 py-5 backdrop-blur md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.38em] text-muted-foreground">
                  Internal Platform
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  Server Maintenance Console
                </p>
              </div>

              <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {navigation.map((item) => (
                  <Link
                    className="rounded-full px-4 py-2 transition hover:bg-accent hover:text-foreground"
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </header>

            <main className="flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
