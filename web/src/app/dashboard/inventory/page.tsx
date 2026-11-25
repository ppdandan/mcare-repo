"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorState, LoadingState } from "@/components/ui/AsyncStates";
import { formatManilaDate, formatManilaDateTime, userFacingErrorMessage } from "@m-care/shared";
import Modal from "@/components/ui/Modal";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  location: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  last_updated: string;
}

interface StockMovement {
  id: string;
  item_id: string;
  movement_type: "in" | "out" | "adjustment";
  quantity: number;
  used_by: string | null;
  reason: string;
  notes: string | null;
  stock_after: number;
  created_at: string;
  item: { name: string; unit: string } | null;
}

type StockStatus = "out" | "low" | "ok";

function stockStatus(current: number, minimum: number): StockStatus {
  if (current <= 0) return "out";
  if (current <= minimum) return "low";
  return "ok";
}

export default function AdminInventoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Dialog state: which dialog is open, plus shared movement form fields.
  const [dialog, setDialog] = useState<"none" | "in" | "out" | "adjust" | "item">("none");
  const [formItemId, setFormItemId] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formUsedBy, setFormUsedBy] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // New item form fields.
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("General");
  const [itemUnit, setItemUnit] = useState("piece");
  const [itemStock, setItemStock] = useState("0");
  const [itemMinStock, setItemMinStock] = useState("5");
  const [itemLocation, setItemLocation] = useState("");
  const [itemBatch, setItemBatch] = useState("");
  const [itemExpiry, setItemExpiry] = useState("");

  // Consumption report state.
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [reportRows, setReportRows] = useState<
    { name: string; category: string; unit: string; totalUsed: number; days: number; avgDaily: string; trend: string }[]
  >([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!userData.user) throw new Error("Sign in required");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();
      if (profileError) throw profileError;
      if (profile.role !== "admin") {
        setLoadError("Inventory management is available to the clinic admin only.");
        return;
      }

      const [itemsResult, movementsResult] = await Promise.all([
        supabase.from("inventory_items").select("*").order("name", { ascending: true }),
        supabase.from("stock_movements").select(`
          *,
          item:inventory_items (name, unit)
        `).order("created_at", { ascending: false }).limit(100),
      ]);
      if (itemsResult.error) throw itemsResult.error;
      if (movementsResult.error) throw movementsResult.error;
      setItems((itemsResult.data ?? []) as InventoryItem[]);
      setMovements((movementsResult.data ?? []) as StockMovement[]);
    } catch (cause) {
      console.error("Unable to load inventory workspace:", cause);
      setLoadError("We couldn't load inventory records. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  const resetMovementForm = () => {
    setFormItemId("");
    setFormQuantity("");
    setFormUsedBy("");
    setFormReason("");
    setFormNotes("");
  };

  const recordMovement = async (movementType: "in" | "out" | "adjustment") => {
    setActionError(null);
    setNotice(null);
    const qty = Number(formQuantity);
    if (!formItemId || formQuantity.trim() === "" || !Number.isInteger(qty) || qty <= 0 || !formReason.trim()) {
      setActionError("Choose an item, enter a whole-number quantity, and provide a reason.");
      return;
    }
    if (movementType === "adjustment" && formReason.trim().length < 3) {
      setActionError("Describe the reason for the correction (at least 3 characters).");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("record_stock_movement", {
        p_item_id: formItemId,
        p_movement_type: movementType,
        p_quantity: qty,
        p_reason: formReason.trim(),
        p_used_by: formUsedBy.trim() || null,
        p_notes: formNotes.trim() || null,
      });
      if (error) throw error;
      setDialog("none");
      resetMovementForm();
      setNotice(`Stock ${movementType === "in" ? "added" : movementType === "out" ? "used" : "adjusted"}. The movement is logged in the history.`);
      await loadData();
    } catch (cause) {
      console.error("Unable to record stock movement:", cause);
      setActionError(userFacingErrorMessage(cause, "We couldn't record this stock movement. Refresh and retry."));
    } finally {
      setSaving(false);
    }
  };

  const saveNewItem = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);
    setNotice(null);
    const stock = Number(itemStock);
    const minStock = Number(itemMinStock);
    if (!itemName.trim() || itemStock.trim() === "" || !Number.isInteger(stock) || stock < 0
      || itemMinStock.trim() === "" || !Number.isInteger(minStock) || minStock < 0) {
      setActionError("Enter an item name and whole-number stock and minimum-stock values.");
      return;
    }
    setSaving(true);
    try {
      const { data: newItemId, error } = await supabase.rpc("create_inventory_item", {
        p_name: itemName.trim(),
        p_category: itemCategory.trim() || "General",
        p_unit: itemUnit.trim() || "piece",
        p_current_stock: stock,
        p_minimum_stock: minStock,
        p_location: itemLocation.trim() || null,
        p_batch_number: itemBatch.trim() || null,
        p_expiry_date: itemExpiry || null,
      });
      if (error) throw error;
      setDialog("none");
      setItemName("");
      setItemCategory("General");
      setItemUnit("piece");
      setItemStock("0");
      setItemMinStock("5");
      setItemLocation("");
      setItemBatch("");
      setItemExpiry("");
      if (!newItemId) throw new Error("The item was saved but no record came back.");
      setNotice("Item added to the inventory list.");
      await loadData();
    } catch (cause) {
      console.error("Unable to save item:", cause);
      setActionError(userFacingErrorMessage(cause, "We couldn't save this item. Refresh and retry."));
    } finally {
      setSaving(false);
    }
  };

  const buildConsumptionReport = () => {
    setActionError(null);
    if (!reportStart || !reportEnd) {
      setActionError("Choose a start and end date for the report.");
      return;
    }
    if (reportStart > reportEnd) {
      setActionError("The start date must be on or before the end date.");
      return;
    }
    const startMs = new Date(`${reportStart}T00:00:00+08:00`).getTime();
    const endMs = new Date(`${reportEnd}T00:00:00+08:00`).getTime();
    const days = Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);

    // Only "out" movements count as consumption.
    const inRange = movements.filter((movement) => {
      const movedDay = movement.created_at.slice(0, 10);
      return movement.movement_type === "out"
        && movement.created_at >= `${reportStart}T00:00:00+08:00`
        && movement.created_at <= `${reportEnd}T23:59:59+08:00`;
    });

    const byItem = new Map<string, { name: string; category: string; unit: string; totalUsed: number }>();
    for (const movement of inRange) {
      const key = movement.item_id;
      const existing = byItem.get(key) ?? {
        name: movement.item?.name ?? "Unknown item",
        category: items.find((item) => item.id === movement.item_id)?.category ?? "General",
        unit: movement.item?.unit ?? "piece",
        totalUsed: 0,
      };
      existing.totalUsed += movement.quantity;
      byItem.set(key, existing);
    }

    const rows = [...byItem.values()]
      .map((row) => {
        const avgDaily = row.totalUsed / days;
        return {
          ...row,
          days,
          avgDaily: avgDaily.toFixed(1),
          trend: avgDaily > 1 ? "High use" : avgDaily >= 0.2 ? "Steady" : "Light",
        };
      })
      .sort((a, b) => b.totalUsed - a.totalUsed);

    setReportRows(rows);
    if (rows.length === 0) {
      setNotice("No stock usage recorded in this date range.");
    }
  };

  const exportReportCsv = () => {
    const headers = ["Item", "Category", "Total Used", "Unit", "Days in Range", "Average Daily", "Trend"];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      headers.join(","),
      ...reportRows.map((row) =>
        [escape(row.name), escape(row.category), String(row.totalUsed), escape(row.unit), String(row.days), row.avgDaily, escape(row.trend)].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `mcare_consumption_${reportStart}_to_${reportEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  if (loading) {
    return <LoadingState label="Loading inventory records…" />;
  }
  if (loadError) {
    return <ErrorState title="" description={loadError} onRetry={() => void loadData()} />;
  }

  const lowStockItems = items.filter((item) => stockStatus(item.current_stock, item.minimum_stock) !== "ok");

  const openDialogForItem = (item: InventoryItem, which: "in" | "out" | "adjust") => {
    setFormItemId(item.id);
    resetMovementForm();
    setDialog(which);
  };

  const dialogTitle = dialog === "in"
    ? "Add Stock"
    : dialog === "out"
      ? "Use Stock"
      : dialog === "adjust"
        ? "Stock Adjustment"
        : "Add Inventory Item";

  const itemLabel = (item: InventoryItem) =>
    `${item.name} (${item.category}) · ${item.current_stock} ${item.unit}${stockStatus(item.current_stock, item.minimum_stock) !== "ok" ? " · LOW" : ""}`;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight text-base-content">Inventory Management</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-base-content">
          Track medical consumables, record stock in and out, and catch shortages before they interrupt care.
        </p>
        <p className="mt-1 text-sm text-base-content/75">
          {items.length} items tracked · {lowStockItems.length} at or below minimum stock
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => { resetMovementForm(); setDialog("item"); }} className="rounded-xl bg-rose-800 px-5 py-3 font-bold text-white hover:bg-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-800 focus:ring-offset-2">+ Add Item</button>
          <button type="button" onClick={() => { resetMovementForm(); setDialog("in"); }} className="rounded-xl border border-gray-400 px-5 py-3 font-semibold text-base-content hover:bg-base-200">Add Stock</button>
          <button type="button" onClick={() => { resetMovementForm(); setDialog("out"); }} className="rounded-xl border border-gray-400 px-5 py-3 font-semibold text-base-content hover:bg-base-200">Use Stock</button>
          <button type="button" onClick={() => { resetMovementForm(); setDialog("adjust"); }} className="rounded-xl border border-gray-400 px-5 py-3 font-semibold text-base-content hover:bg-base-200">Adjustment</button>
        </div>
      </header>

      {notice && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-semibold text-emerald-950">{notice}</p>}
      {actionError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950">{actionError}</p>}

      {dialog !== "none" && (
        <Modal
          open
          title={dialogTitle}
          onClose={() => { setDialog("none"); setActionError(null); }}
        >
          {dialog === "item" ? (
            <form onSubmit={saveNewItem} className="grid gap-4">
              <div>
                <label htmlFor="item-name" className="mb-1 block text-sm font-semibold text-base-content">Item name</label>
                <input id="item-name" required maxLength={120} value={itemName} onChange={(event) => setItemName(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" placeholder="e.g. Nitrile gloves (M)" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="item-category" className="mb-1 block text-sm font-semibold text-base-content">Category</label>
                  <select id="item-category" value={itemCategory} onChange={(event) => setItemCategory(event.target.value)} className="w-full rounded-xl border border-gray-400 bg-base-100 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800">
                    <option>General</option><option>PPE</option><option>Syringes &amp; Needles</option><option>Ultrasound</option><option>Laboratory</option><option>Office</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="item-unit" className="mb-1 block text-sm font-semibold text-base-content">Unit</label>
                  <select id="item-unit" value={itemUnit} onChange={(event) => setItemUnit(event.target.value)} className="w-full rounded-xl border border-gray-400 bg-base-100 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800">
                    <option>piece</option><option>box</option><option>pack</option><option>bottle</option><option>vial</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="item-stock" className="mb-1 block text-sm font-semibold text-base-content">Current stock</label>
                  <input id="item-stock" type="number" inputMode="numeric" min="0" step="1" required value={itemStock} onChange={(event) => setItemStock(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
                <div>
                  <label htmlFor="item-min-stock" className="mb-1 block text-sm font-semibold text-base-content">Minimum stock level</label>
                  <input id="item-min-stock" type="number" inputMode="numeric" min="0" step="1" required value={itemMinStock} onChange={(event) => setItemMinStock(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="item-location" className="mb-1 block text-sm font-semibold text-base-content">Location (optional)</label>
                  <input id="item-location" maxLength={120} value={itemLocation} onChange={(event) => setItemLocation(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" placeholder="e.g. Cabinet A" />
                </div>
                <div>
                  <label htmlFor="item-batch" className="mb-1 block text-sm font-semibold text-base-content">Batch number (optional)</label>
                  <input id="item-batch" maxLength={60} value={itemBatch} onChange={(event) => setItemBatch(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
              </div>
              <div>
                <label htmlFor="item-expiry" className="mb-1 block text-sm font-semibold text-base-content">Expiry date (optional)</label>
                <input id="item-expiry" type="date" value={itemExpiry} onChange={(event) => setItemExpiry(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="rounded-xl bg-rose-800 px-5 py-3 font-bold text-white hover:bg-rose-900 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? "Saving…" : "Save item"}
                </button>
                <button type="button" onClick={() => { setDialog("none"); setActionError(null); }} className="rounded-xl border border-gray-400 px-5 py-3 font-semibold text-base-content hover:bg-base-200">Cancel</button>
              </div>
            </form>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); void recordMovement(dialog as "in" | "out" | "adjustment"); }} className="grid gap-4">
              <div>
                <label htmlFor="movement-item" className="mb-1 block text-sm font-semibold text-base-content">Item</label>
                <select id="movement-item" required value={formItemId} onChange={(event) => setFormItemId(event.target.value)} className="w-full rounded-xl border border-gray-400 bg-base-100 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800">
                  <option value="">Select an item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{itemLabel(item)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="movement-quantity" className="mb-1 block text-sm font-semibold text-base-content">
                  {dialog === "adjust" ? "Counted stock (actual quantity on hand)" : dialog === "in" ? "Quantity added" : "Quantity used"}
                </label>
                <input id="movement-quantity" type="number" inputMode="numeric" min={dialog === "adjust" ? 0 : 1} step="1" required value={formQuantity} onChange={(event) => setFormQuantity(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" />
                {dialog === "adjust" && <p className="mt-1 text-sm text-base-content/75">Adjustment replaces the recorded stock with the actual count. Use a physical count as the value.</p>}
              </div>
              {dialog === "out" && (
                <div>
                  <label htmlFor="movement-used-by" className="mb-1 block text-sm font-semibold text-base-content">Used by (optional)</label>
                  <input id="movement-used-by" maxLength={120} value={formUsedBy} onChange={(event) => setFormUsedBy(event.target.value)} className="w-full rounded-xl border px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" placeholder="e.g. Dr. Paule · ultrasound room" />
                </div>
              )}
              <div>
                <label htmlFor="movement-reason" className="mb-1 block text-sm font-semibold text-base-content">
                  {dialog === "adjust" ? "Reason for adjustment" : "Reason"}
                </label>
                <textarea id="movement-reason" rows={2} maxLength={300} required value={formReason} onChange={(event) => setFormReason(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" placeholder={dialog === "adjust" ? "e.g. Damaged during sterilization" : "e.g. Weekly restock"} />
              </div>
              <div>
                <label htmlFor="movement-notes" className="mb-1 block text-sm font-semibold text-base-content">Notes (optional)</label>
                <textarea id="movement-notes" rows={2} maxLength={500} value={formNotes} onChange={(event) => setFormNotes(event.target.value)} className="w-full rounded-xl border border-gray-400 px-3 py-3 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="rounded-xl bg-rose-800 px-5 py-3 font-bold text-white hover:bg-rose-900 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? "Saving…" : dialog === "in" ? "Add stock" : dialog === "out" ? "Record use" : "Save adjustment"}
                </button>
                <button type="button" onClick={() => { setDialog("none"); setActionError(null); }} className="rounded-xl border border-gray-400 px-5 py-3 font-semibold text-base-content hover:bg-base-200">Cancel</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-base-content">Inventory list</h2>
            <p className="mt-1 text-sm text-base-content">Items at or below their minimum stock level are flagged.</p>
          </div>
          <button type="button" onClick={() => void loadData()} className="rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold text-base-content hover:bg-base-200">Refresh</button>
        </div>
        {items.length === 0 ? (
          <p className="mt-4 rounded-xl bg-base-200 p-4 text-sm text-base-content">No items tracked yet. Use “+ Add Item” to record your first consumable.</p>
        ) : (
          <div className="mt-4 w-full overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra w-full">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-base-content/60">
                  <th>Item</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Minimum</th>
                  <th>Location</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = stockStatus(item.current_stock, item.minimum_stock);
                  return (
                    <tr key={item.id}>
                      <td className="font-semibold text-base-content">
                        {item.name}
                        {item.batch_number && <span className="block text-xs text-base-content/60">Batch {item.batch_number}</span>}
                        {item.expiry_date && <span className="block text-xs text-base-content/60">Exp {formatManilaDate(item.expiry_date)}</span>}
                      </td>
                      <td className="text-sm text-base-content">{item.category}</td>
                      <td className="text-sm font-bold text-base-content">
                        {item.current_stock} {item.unit}
                        {status !== "ok" && (
                          <span className={`badge ml-2 min-h-6 px-2.5 font-semibold ${status === "out" ? "badge-error" : "badge-warning"}`}>
                            {status === "out" ? "Out of stock" : "Low"}
                          </span>
                        )}
                      </td>
                      <td className="text-sm text-base-content">{item.minimum_stock}</td>
                      <td className="text-sm text-base-content">{item.location ?? "—"}</td>
                      <td className="text-sm text-base-content">{formatManilaDateTime(item.last_updated)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => openDialogForItem(item, "in")} className="rounded-lg border border-gray-400 px-2.5 py-2 text-sm font-semibold text-base-content hover:bg-base-200">In</button>
                          <button type="button" onClick={() => openDialogForItem(item, "out")} className="rounded-lg border border-gray-400 px-2.5 py-2 text-sm font-semibold text-base-content hover:bg-base-200">Out</button>
                          <button type="button" onClick={() => openDialogForItem(item, "adjust")} className="rounded-lg border border-gray-400 px-2.5 py-2 text-sm font-semibold text-base-content hover:bg-base-200">Adjust</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-base-content">Consumption report</h2>
        <p className="mt-1 text-sm text-base-content">Total stock used in a date range, with average daily use and a trend label.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="report-start" className="mb-1 block text-sm font-semibold text-base-content">Start date</label>
            <input id="report-start" type="date" value={reportStart} onChange={(event) => setReportStart(event.target.value)} className="rounded-xl border border-gray-400 px-3 py-2.5 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" />
          </div>
          <div>
            <label htmlFor="report-end" className="mb-1 block text-sm font-semibold text-base-content">End date</label>
            <input id="report-end" type="date" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} className="rounded-xl border border-gray-400 px-3 py-2.5 text-base-content focus:outline-none focus:ring-2 focus:ring-rose-800" />
          </div>
          <button type="button" onClick={buildConsumptionReport} className="rounded-xl border border-gray-400 px-5 py-2.5 font-semibold text-base-content hover:bg-base-200">Generate</button>
          {reportRows.length > 0 && (
            <button type="button" onClick={exportReportCsv} className="rounded-xl bg-rose-800 px-5 py-2.5 font-bold text-white hover:bg-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-800 focus:ring-offset-2">Export CSV</button>
          )}
        </div>
        {reportRows.length === 0 ? (
          <p className="mt-4 rounded-xl bg-base-200 p-4 text-sm text-base-content">Pick a date range and generate the report to see totals per item.</p>
        ) : (
          <div className="mt-4 w-full overflow-x-auto rounded-box border border-base-300">
            <table className="table table-zebra w-full">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-base-content/60">
                  <th>Item</th>
                  <th>Category</th>
                  <th>Total Used</th>
                  <th>Average Daily</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={row.name}>
                    <td className="font-semibold text-base-content">{row.name}</td>
                    <td className="text-sm text-base-content">{row.category}</td>
                    <td className="text-sm font-bold text-base-content">{row.totalUsed} {row.unit}</td>
                    <td className="text-sm text-base-content">{row.avgDaily} / day</td>
                    <td className="text-sm text-base-content">{row.trend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-base-content">Recent stock movements</h2>
        <p className="mt-1 text-sm text-base-content">The 100 most recent in, out, and adjustment records. Every change is logged with who made it.</p>
        {movements.length === 0 ? (
          <p className="mt-4 rounded-xl bg-base-200 p-4 text-sm text-base-content">No stock movements recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-base-300">
            {movements.map((movement) => (
              <li key={movement.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-base-content">
                      {movement.movement_type === "in" ? "Added" : movement.movement_type === "out" ? "Used" : "Adjusted"} {movement.quantity} {movement.item?.unit ?? ""} · {movement.item?.name ?? "Unknown item"}
                    </p>
                    <p className="mt-1 text-sm text-base-content/75">
                      {formatManilaDateTime(movement.created_at)} · Reason: {movement.reason}
                      {movement.used_by ? ` · Used by ${movement.used_by}` : ""}
                      {movement.notes ? ` · ${movement.notes}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-base-content/75">Stock after: {movement.stock_after}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
