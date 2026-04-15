import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Link from "next/link";

import { AccountMenu } from "@/components/auth/account-menu";
import { getCurrentUser, type AuthSession, type AuthUser } from "@/lib/api";

import "./globals.css";

export const metadata: Metadata = {
  title: "Server Maintenance Platform",
  description: "Internal admin UI for deterministic server checks, incidents, and onboarding.",
};

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/servers", label: "Servers" },
  { href: "/servers/new", label: "Add Server" },
  { href: "/settings", label: "Settings" },
];

function isAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /authentication is required|session was not valid/i.test(error.message)
  );
}

async function getAuthenticatedUser(): Promise<{ session: AuthSession; user: AuthUser } | null> {
  const cookieStore = await cookies();

  try {
    const payload = await getCurrentUser({
      cookie: cookieStore.toString(),
    });

    return payload.data;
  } catch (error) {
    if (isAuthError(error)) {
      return null;
    }

    throw error;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const currentUser = await getAuthenticatedUser();
  const visibleNavigation = currentUser ? navigation : [{ href: "/login", label: "Sign In" }];

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
            <header className="mb-8 flex items-center justify-between gap-4 overflow-x-auto rounded-2xl border border-border/70 bg-card/85 px-5 py-4 backdrop-blur">
              <div className="shrink-0">
                <p className="text-xs font-semibold uppercase tracking-[0.38em] text-muted-foreground">
                  Internal Platform
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  Server Maintenance Console
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <nav className="flex flex-nowrap items-center gap-1.5 text-sm text-muted-foreground">
                  {visibleNavigation.map((item) => (
                    <Link
                      className="rounded-full px-3.5 py-2 transition hover:bg-accent hover:text-foreground"
                      href={item.href}
                      key={item.href}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>

                {currentUser ? (
                  <AccountMenu session={currentUser.session} user={currentUser.user} />
                ) : (
                  <div className="rounded-full border border-dashed border-border/80 bg-background/60 px-4 py-2 text-xs text-muted-foreground">
                    Restricted access
                  </div>
                )}
              </div>
            </header>

            <main className="flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
