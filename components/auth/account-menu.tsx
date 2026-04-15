"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, Clock3, LogOut, ShieldUser } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { logout, type AuthSession, type AuthUser } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  session: AuthSession;
  user: AuthUser;
}

function getInitials(email: string): string {
  const prefix = email.split("@")[0] ?? "";
  const parts = prefix
    .split(/[\.\-_]+/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 0) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  return email.slice(0, 2).toUpperCase();
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AccountMenu({ session, user }: AccountMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initials = useMemo(() => getInitials(user.email), [user.email]);
  const accountSinceLabel = useMemo(() => formatDateTime(user.createdAt), [user.createdAt]);
  const sessionStartedLabel = useMemo(() => formatDateTime(session.issuedAt), [session.issuedAt]);
  const sessionExpiresLabel = useMemo(() => formatDateTime(session.expiresAt), [session.expiresAt]);

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, []);

  function handleLogout() {
    setError(null);

    startTransition(async () => {
      try {
        await logout();
        router.replace("/login");
        router.refresh();
      } catch (logoutError) {
        setError(logoutError instanceof Error ? logoutError.message : "Logout failed");
      }
    });
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="gap-3 border border-border/80 bg-card/90 px-4 hover:bg-accent"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
        variant="secondary"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initials}
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-sm font-semibold text-foreground">{user.email}</span>
          <span className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {user.role}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition duration-200",
            isOpen && "rotate-180",
          )}
        />
      </Button>

      <div
        className={cn(
          "absolute right-0 top-[calc(100%+0.75rem)] z-50 w-80 overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-3 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.75)] backdrop-blur transition duration-150",
          isOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        )}
        role="menu"
      >
        <div className="rounded-xl border border-border/70 bg-background/45 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{user.email}</p>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <ShieldUser className="h-3.5 w-3.5" />
                {user.role}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <ShieldUser className="h-3.5 w-3.5" />
                Account since
              </div>
              <p className="mt-1 text-sm text-foreground">{accountSinceLabel}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Session
              </div>
              <p className="mt-1 text-sm text-foreground">Started {sessionStartedLabel}</p>
              <p className="text-[11px] text-muted-foreground">Expires {sessionExpiresLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <button
            className="flex w-full items-center gap-3 rounded-[1rem] px-4 py-3 text-left text-sm text-foreground transition hover:bg-accent"
            onClick={handleLogout}
            type="button"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{isPending ? "Logging out..." : "Log out"}</span>
          </button>

          {error ? <p className="px-4 pb-1 text-xs text-rose-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
