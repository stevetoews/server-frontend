"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createNotificationTarget,
  deleteNotificationTarget,
  getNotificationTargetDeliveries,
  getNotificationTargets,
  type PaginationMeta,
  type NotificationDeliveryRecord,
  type NotificationTargetRecord,
  updateNotificationTarget,
} from "@/lib/api";

const DELIVERY_PAGE_SIZE = 10;
const DELIVERY_STATUSES = [
  { label: "All", value: "" },
  { label: "Delivered", value: "delivered" },
  { label: "Failed", value: "failed" },
  { label: "Skipped", value: "skipped" },
] as const;

const EMPTY_TARGET_FORM = {
  address: "",
  enabled: true,
  label: "",
};

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
  const [createForm, setCreateForm] = useState(EMPTY_TARGET_FORM);
  const [editForm, setEditForm] = useState(EMPTY_TARGET_FORM);
  const [deliveryStatus, setDeliveryStatus] = useState<"" | "delivered" | "failed" | "skipped">("");

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === selectedTargetId) ?? null,
    [selectedTargetId, targets],
  );

  useEffect(() => {
    if (selectedTarget) {
      setEditForm({
        address: selectedTarget.address,
        enabled: selectedTarget.enabled,
        label: selectedTarget.label,
      });
    }
  }, [selectedTarget]);

  function loadDeliveries(
    targetId: string,
    offset = deliveryOffset,
    status: "" | "delivered" | "failed" | "skipped" = deliveryStatus,
  ) {
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
          ...(status ? { status } : {}),
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

  function loadTargets(selectTargetId?: string) {
    setError(null);
    setIsLoadingTargets(true);

    startTransition(async () => {
      try {
        const payload = await getNotificationTargets({ channel: "email", limit: 20 });
        setTargets(payload.data.targets);

        const nextTargetId = selectTargetId ?? selectedTargetId ?? payload.data.targets[0]?.id ?? "";
        const nextTargetOffset = nextTargetId === selectedTargetId ? deliveryOffset : 0;
        setSelectedTargetId(nextTargetId);
        setDeliveryOffset(nextTargetOffset);

        if (nextTargetId) {
          const deliveryPayload = await getNotificationTargetDeliveries(nextTargetId, {
            limit: DELIVERY_PAGE_SIZE,
            offset: nextTargetOffset,
            ...(deliveryStatus ? { status: deliveryStatus } : {}),
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

  function handleCreateTarget() {
    if (!createForm.label.trim() || !createForm.address.trim()) {
      setError("Label and address are required to create a notification target.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        await createNotificationTarget({
          channel: "email",
          address: createForm.address.trim(),
          enabled: createForm.enabled,
          label: createForm.label.trim(),
        });
        setCreateForm(EMPTY_TARGET_FORM);
        loadTargets(selectedTargetId);
      } catch (createError) {
        setError(
          createError instanceof Error
            ? createError.message
            : "Unable to create notification target",
        );
      }
    });
  }

  function handleSaveTarget() {
    if (!selectedTarget) {
      setError("Select a target before saving changes.");
      return;
    }

    if (!editForm.label.trim() || !editForm.address.trim()) {
      setError("Label and address are required to update a notification target.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        await updateNotificationTarget({
          id: selectedTarget.id,
          address: editForm.address.trim(),
          enabled: editForm.enabled,
          label: editForm.label.trim(),
        });
        loadTargets(selectedTarget.id);
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Unable to update notification target",
        );
      }
    });
  }

  function handleDeleteTarget() {
    if (!selectedTarget) {
      setError("Select a target before deleting it.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        await deleteNotificationTarget(selectedTarget.id);
        setSelectedTargetId("");
        setDeliveryOffset(0);
        setDeliveries([]);
        setDeliveryPagination(null);
        setHistoryLabel("No target selected");
        loadTargets();
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Unable to delete notification target",
        );
      }
    });
  }

  function handleDeliveryStatusChange(value: "" | "delivered" | "failed" | "skipped") {
    setDeliveryStatus(value);
    setDeliveryOffset(0);

    if (selectedTargetId) {
      loadDeliveries(selectedTargetId, 0, value);
    }
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

        <Button
          disabled={isPending || isLoadingTargets}
          onClick={() => loadTargets(selectedTargetId)}
          type="button"
          variant="secondary"
        >
          {isLoadingTargets ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/12 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Create Target</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a new email notification target.
              </p>
            </div>

            <div className="space-y-3">
              <input
                className="h-11 w-full rounded-xl border border-border bg-background/70 px-4 text-sm text-foreground"
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, label: event.target.value }))
                }
                placeholder="Label"
                value={createForm.label}
              />
              <input
                className="h-11 w-full rounded-xl border border-border bg-background/70 px-4 text-sm text-foreground"
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, address: event.target.value }))
                }
                placeholder="Email address"
                type="email"
                value={createForm.address}
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  checked={createForm.enabled}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, enabled: event.target.checked }))
                  }
                  type="checkbox"
                />
                Enabled on create
              </label>
              <Button disabled={isPending} onClick={handleCreateTarget} type="button">
                Create Target
              </Button>
            </div>
          </Card>

          <div className="space-y-2">
            {targets.length === 0 ? (
              <div className="rounded-xl border border-border bg-card/70 p-4 text-sm text-muted-foreground">
                No notification targets are configured.
              </div>
            ) : (
              targets.map((target) => {
                const isActive = target.id === selectedTargetId;

                return (
                  <button
                    className={[
                      "w-full rounded-xl border px-4 py-4 text-left transition",
                      isActive
                        ? "border-primary bg-primary/10 shadow-[0_16px_40px_-26px_rgba(0,0,0,0.6)]"
                        : "border-border bg-card/70 hover:border-primary/40 hover:bg-accent/40",
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
        </div>

        <div className="space-y-4">
          <Card className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Edit Target</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Update the selected target or disable it without deleting.
              </p>
            </div>

            {selectedTarget ? (
              <div className="space-y-3">
                <input
                  className="h-11 w-full rounded-xl border border-border bg-background/70 px-4 text-sm text-foreground"
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, label: event.target.value }))
                  }
                  value={editForm.label}
                />
                <input
                  className="h-11 w-full rounded-xl border border-border bg-background/70 px-4 text-sm text-foreground"
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, address: event.target.value }))
                  }
                  type="email"
                  value={editForm.address}
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    checked={editForm.enabled}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, enabled: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  Enabled
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button disabled={isPending} onClick={handleSaveTarget} type="button">
                    Save Target
                  </Button>
                  <Button disabled={isPending} onClick={handleDeleteTarget} type="button" variant="secondary">
                    Delete Target
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a target from the list to edit it.
              </p>
            )}
          </Card>

          <div className="rounded-xl border border-border bg-card/70 p-4">
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

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {DELIVERY_STATUSES.map((statusOption) => (
                <Button
                  key={statusOption.value || "all"}
                  disabled={isPending}
                  onClick={() =>
                    handleDeliveryStatusChange(
                      statusOption.value as "" | "delivered" | "failed" | "skipped",
                    )
                  }
                  type="button"
                  variant={deliveryStatus === statusOption.value ? "primary" : "secondary"}
                >
                  {statusOption.label}
                </Button>
              ))}
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
              <div className="rounded-xl border border-border bg-card/70 p-4 text-sm text-muted-foreground">
                No deliveries loaded for this target yet.
              </div>
            ) : (
              deliveries.map((delivery) => (
                <div
                  className="rounded-xl border border-border bg-card/70 p-4 text-sm text-foreground"
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
