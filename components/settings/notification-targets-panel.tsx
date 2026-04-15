"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getNotificationTargetDeliveries,
  getNotificationTargets,
  type PaginationMeta,
  type NotificationDeliveryRecord,
  type NotificationTargetRecord,
} from "@/lib/api";

const DELIVERY_PAGE_SIZE = 10;

export function NotificationTargetsPanel() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<NotificationTargetRecord[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [deliveryOffset, setDeliveryOffset] = useState(0);
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRecord[]>([]);
  const [deliveryPagination, setDeliveryPagination] = useState<PaginationMeta | null>(null);
  const [historyLabel, setHistoryLabel] = useState<string>("No target selected");
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === selectedTargetId) ?? null,
    [selectedTargetId, targets],
  );

  function loadDeliveries(targetId: string, offset = deliveryOffset) {
    if (!targetId) {
      return;
    }

    setError(null);
    setHistoryLabel("Loading delivery history...");

    startTransition(async () => {
      try {
        const payload = await getNotificationTargetDeliveries(targetId, {
          limit: DELIVERY_PAGE_SIZE,
          offset,
        });
        setDeliveries(payload.data.deliveries);
        setDeliveryPagination(payload.data.pagination ?? null);
        setHistoryLabel(
          `${payload.data.target.label} • ${payload.data.pagination?.total ?? payload.data.deliveries.length} deliveries`,
        );
      } catch (deliveryError) {
        setError(
          deliveryError instanceof Error
            ? deliveryError.message
            : "Unable to load notification delivery history",
        );
      }
    });
  }

  function loadTargets() {
    setError(null);
    setIsLoadingTargets(true);

    startTransition(async () => {
      try {
        const payload = await getNotificationTargets({ channel: "email", limit: 20 });
        setTargets(payload.data.targets);

        const nextTargetId = selectedTargetId || payload.data.targets[0]?.id || "";
        const nextTargetOffset = nextTargetId === selectedTargetId ? deliveryOffset : 0;
        setSelectedTargetId(nextTargetId);
        setDeliveryOffset(nextTargetOffset);

        if (nextTargetId) {
          const nextTarget = payload.data.targets.find((target) => target.id === nextTargetId);
          setHistoryLabel(nextTarget ? `${nextTarget.label} • loading…` : "Loading delivery history...");
          const deliveryPayload = await getNotificationTargetDeliveries(nextTargetId, {
            limit: DELIVERY_PAGE_SIZE,
            offset: nextTargetOffset,
          });
          setDeliveries(deliveryPayload.data.deliveries);
          setDeliveryPagination(deliveryPayload.data.pagination ?? null);
          setHistoryLabel(
            `${deliveryPayload.data.target.label} • ${deliveryPayload.data.pagination?.total ?? deliveryPayload.data.deliveries.length} deliveries`,
          );
        } else {
          setDeliveries([]);
          setDeliveryPagination(null);
          setHistoryLabel("No notification targets found");
        }
      } catch (targetError) {
        setError(
          targetError instanceof Error ? targetError.message : "Unable to load notification targets",
        );
      } finally {
        setIsLoadingTargets(false);
      }
    });
  }

  useEffect(() => {
    loadTargets();
    // The panel loads once on mount; subsequent refreshes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Notification Targets</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a target to review recent SMTP or simulated delivery history.
          </p>
        </div>

        <Button disabled={isPending || isLoadingTargets} onClick={loadTargets} type="button" variant="secondary">
          {isLoadingTargets ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-2">
          {targets.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-muted-foreground">
              No notification targets are configured.
            </div>
          ) : (
            targets.map((target) => {
              const isActive = target.id === selectedTargetId;

              return (
                <button
                  className={[
                    "w-full rounded-2xl border px-4 py-4 text-left transition",
                    isActive
                      ? "border-primary bg-primary/5 shadow-[0_16px_40px_-26px_rgba(18,61,54,0.45)]"
                      : "border-border bg-white/80 hover:border-primary/40 hover:bg-accent/40",
                  ].join(" ")}
                  key={target.id}
                  onClick={() => {
                    setSelectedTargetId(target.id);
                    setDeliveryOffset(0);
                    loadDeliveries(target.id, 0);
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-foreground">{target.label}</div>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      {target.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{target.address}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Updated {new Date(target.updatedAt).toLocaleString()}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Delivery History
                </div>
                <div className="mt-2 text-sm text-foreground">{historyLabel}</div>
                {selectedTarget ? (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedTarget.channel} • {selectedTarget.address}
                  </div>
                ) : null}
              </div>

              <Button
                disabled={!selectedTargetId || isPending}
                onClick={() => loadDeliveries(selectedTargetId, deliveryOffset)}
                type="button"
                variant="secondary"
              >
                Refresh History
              </Button>
            </div>

            {deliveryPagination ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                <div>
                  Showing {deliveryPagination.offset + 1}-
                  {deliveryPagination.offset + deliveryPagination.returned} of {deliveryPagination.total}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={isPending || deliveryOffset === 0}
                    onClick={() => {
                      const nextOffset = Math.max(0, deliveryOffset - DELIVERY_PAGE_SIZE);
                      setDeliveryOffset(nextOffset);
                      loadDeliveries(selectedTargetId, nextOffset);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={isPending || !deliveryPagination.hasMore}
                    onClick={() => {
                      const nextOffset = deliveryOffset + DELIVERY_PAGE_SIZE;
                      setDeliveryOffset(nextOffset);
                      loadDeliveries(selectedTargetId, nextOffset);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {deliveries.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-muted-foreground">
                No deliveries loaded for this target yet.
              </div>
            ) : (
              deliveries.map((delivery) => (
                <div
                  className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-foreground"
                  key={delivery.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{delivery.subject}</div>
                      <div className="mt-1 text-muted-foreground">{delivery.eventType}</div>
                    </div>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      {delivery.status}
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-muted-foreground">{delivery.bodyText}</div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <div>{new Date(delivery.createdAt).toLocaleString()}</div>
                    <div>{delivery.transportKind ?? "unknown"} transport</div>
                    {delivery.transportResponse ? (
                      <div>{delivery.transportResponse}</div>
                    ) : null}
                    {delivery.errorMessage ? <div>{delivery.errorMessage}</div> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
