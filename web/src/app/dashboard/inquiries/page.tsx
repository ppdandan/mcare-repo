"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import TableControls from "@/components/ui/TableControls";
import type { Inquiry } from "@m-care/shared";
import { formatManilaDateTime, userFacingErrorMessage } from "@m-care/shared";

interface InquiryWithDetails extends Inquiry {
  patient?: {
    profile?: {
      full_name: string;
      phone: string | null;
    };
  };
}

export default function ReceptionInquiriesPage() {
  const [inquiries, setInquiries] = useState<InquiryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryWithDetails | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const supabase = createClient();
  const filteredInquiries = inquiries.filter((inquiry) => `${inquiry.subject} ${inquiry.patient?.profile?.full_name ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const sortedInquiries = [...filteredInquiries].sort((a, b) => sort === "oldest" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
  const pageInquiries = sortedInquiries.slice((page - 1) * 10, page * 10);

  const fetchInquiries = useCallback(async () => {
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("inquiries")
        .select(`
          *,
          patient:patients (
            profile:profiles (full_name, phone)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setInquiries(data as unknown as InquiryWithDetails[]);
    } catch (err) {
      console.error("Error fetching inquiries:", err);
      setLoadError(userFacingErrorMessage(err, "We couldn’t load patient inquiries."));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchInquiries();

    // Supabase Realtime channel
    const channel = supabase
      .channel("staff_inquiries_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inquiries" },
        () => fetchInquiries()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInquiries, supabase]);

  const handleSendReply = async () => {
    if (!selectedInquiry || !replyText.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from("inquiries")
        .update({
          reply: replyText.trim(),
          status: "replied",
        })
        .eq("id", selectedInquiry.id);

      if (error) throw error;

      setSelectedInquiry(null);
      setReplyText("");
      await fetchInquiries();
    } catch (err: unknown) {
      alert(userFacingErrorMessage(err, "We couldn’t send the reply. Refresh the inquiry and try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-base-content tracking-tight">Patient Inquiries Desk</h1>
          <p className="text-sm text-base-content/70 mt-1">
            Live patient messages, scheduling questions, and receptionist replies
          </p>
        </div>
      </div>

      {/* Inquiries Table */}
      <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
        <div className="relative p-3">
          <Icon name="search" size={15} className="absolute left-6 top-6 text-base-content/60" />
          <input aria-label="Search inquiries" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="input input-bordered w-full pl-10 sm:max-w-md" />
        </div>
        <TableControls total={sortedInquiries.length} page={page} sortValue={sort} sortOptions={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} onSortChange={(value) => { setSort(value); setPage(1); }} onPageChange={setPage} />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-base-200/75 border-b border-base-300 text-base-content/60 font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-4">Date Received</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Message</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-base-content/60">
                    Loading patient inquiries...
                  </td>
                </tr>
              ) : loadError ? (
                <tr><td colSpan={6} className="p-6"><div role="alert" className="alert alert-error"><span>{loadError}</span><button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); void fetchInquiries(); }}>Retry</button></div></td></tr>
              ) : sortedInquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-base-content/60">
                    No inquiries received from mobile patients.
                  </td>
                </tr>
              ) : (
                pageInquiries.map((inq) => (
                  <tr key={inq.id} className="hover:bg-primary/10 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap text-base-content/70 font-mono">
                      {formatManilaDateTime(inq.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-base-content">
                      {inq.patient?.profile?.full_name || "Patient"}
                      <span className="block text-xs text-base-content/60 font-normal">
                        Phone: {inq.patient?.profile?.phone || "No phone"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-base-content">
                      {inq.subject}
                    </td>

                    <td className="py-3.5 px-4 max-w-sm truncate text-base-content/80">
                      {inq.message}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                          inq.status === "replied"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-amber-100 text-amber-800 border-amber-200"
                        }`}
                      >
                        {inq.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedInquiry(inq);
                          setReplyText(inq.reply || "");
                        }}
                        className="px-3 py-1 bg-primary/10 hover:bg-pink-100 text-primary font-semibold rounded text-xs border border-pink-200 transition"
                      >
                        {inq.reply ? "View / Edit Reply" : "Reply to Patient"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reply Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-base-300">
            <h3 className="text-lg font-bold text-base-content mb-1">
              Reply to Patient Inquiry
            </h3>
            <p className="text-xs text-base-content/70 mb-4">
              Patient: <strong>{selectedInquiry.patient?.profile?.full_name}</strong>
            </p>

            <div className="space-y-3 text-xs mb-4">
              <div className="p-3 bg-base-200 rounded-xl border border-base-300">
                <p className="font-bold text-base-content mb-1">{selectedInquiry.subject}</p>
                <p className="text-base-content/80 leading-relaxed">{selectedInquiry.message}</p>
              </div>

              <div>
                <label className="font-bold text-base-content block mb-1">
                  Reception Staff Response
                </label>
                <textarea
                  rows={4}
                  value={replyText}
                  aria-label="Reception Staff Response" onChange={(e) => setReplyText(e.target.value)}
                  className="w-full border border-base-300 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setSelectedInquiry(null)}
                className="px-4 py-2 border border-base-300 text-base-content/80 rounded-lg text-xs font-semibold hover:bg-base-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReply}
                disabled={sending}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-focus transition"
              >
                {sending ? "Sending..." : "Send Reply to Mobile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

