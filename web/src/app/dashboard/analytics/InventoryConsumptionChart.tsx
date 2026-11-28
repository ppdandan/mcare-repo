"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addCalendarDays, designTokens, formatManilaDate, manilaDateKey, typography } from "@m-care/shared";
import { createClient } from "@/lib/supabase/client";

type Consumption = { item_id: string; name: string; unit: string; total_used: number };
type ItemTrend = Consumption & { daily: { date: string; quantity: number }[] };

async function loadTrends(): Promise<ItemTrend[]> {
  const client = createClient();
  const today = manilaDateKey();
  const dates = Array.from({ length: 7 }, (_, i) => addCalendarDays(today, i - 6));
  const { data: rankedRows } = await client.rpc("inventory_consumption", {
    p_start: dates[0], p_end: today,
  }).order("total_used", { ascending: false }).order("name").order("item_id")
    .limit(5).throwOnError();
  const topItems: Consumption[] = rankedRows ?? [];
  if (!topItems.length) return [];

  const ids = topItems.map(item => item.item_id);
  const daily = await Promise.all(dates.map(async date => {
    const { data } = await client.rpc("inventory_consumption", { p_start: date, p_end: date })
      .in("item_id", ids).throwOnError();
    const rows: Consumption[] = data ?? [];
    return { date, quantities: new Map(rows.map(item => [item.item_id, item.total_used])) };
  }));
  return topItems.map(item => ({
    ...item,
    daily: daily.map(day => ({ date: day.date, quantity: day.quantities.get(item.item_id) ?? 0 })),
  }));
}

export default function InventoryConsumptionChart() {
  const [items, setItems] = useState<ItemTrend[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadTrends().then(data => {
      if (active) setItems(data);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [attempt]);

  const selected = items?.find(item => item.item_id === selectedId) ?? items?.[0];
  const axis = { stroke: designTokens.color.textMuted, fontSize: typography.caption.fontSize };
  return (
    <section className="min-w-0 rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
      <h2 className="mb-1 text-base font-bold text-base-content">Inventory consumption by item</h2>
      <p className="mb-4 text-sm text-base-content/70">
        Top five items by quantity used in the last seven days, including today in Manila.
      </p>
      {failed ? (
        <div role="alert">Could not load inventory consumption.{" "}
          <button className="btn btn-sm btn-outline" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>Retry</button>
        </div>
      ) : selected ? (
        <>
          <label className="mb-4 block text-sm font-semibold">Inventory item
            <select className="select select-bordered mt-1 block w-full max-w-sm"
              value={selected.item_id} onChange={event => setSelectedId(event.target.value)}>
              {items?.map(item => <option key={item.item_id} value={item.item_id}>{item.name} ({item.unit})</option>)}
            </select>
          </label>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={selected.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke={designTokens.color.divider} />
                <XAxis dataKey="date" {...axis} minTickGap={8}
                  tickFormatter={date => formatManilaDate(date, { month: "short", day: "numeric" })} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip labelFormatter={date => formatManilaDate(String(date))} />
                <Bar dataKey="quantity" name={`Quantity used (${selected.unit})`}
                  fill={designTokens.color.brandStrong} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : <p role="status">{items ? "No stock usage recorded in the last seven days." : "Loading inventory consumption…"}</p>}
    </section>
  );
}
