"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryWithDetails | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const supabase = createClient();

  const fetchInquiries = useCallback(async () => {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Patient Inquiries Desk</h1>
          <p className="text-sm text-gray-500 mt-1">
            Live patient messages, scheduling questions, and receptionist replies
          </p>
        </div>
      </div>

      {/* Inquiries Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-4">Date Received</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Message</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    Loading patient inquiries...
                  </td>
                </tr>
              ) : inquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No inquiries received from mobile patients.
                  </td>
                </tr>
              ) : (
                inquiries.map((inq) => (
                  <tr key={inq.id} className="hover:bg-pink-50/25 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap text-gray-500 font-mono">
                      {formatManilaDateTime(inq.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      {inq.patient?.profile?.full_name || "Patient"}
                      <span className="block text-xs text-gray-400 font-normal">
                        📞 {inq.patient?.profile?.phone || "No phone"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-gray-800">
                      {inq.subject}
                    </td>

                    <td className="py-3.5 px-4 max-w-sm truncate text-gray-600">
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
                        className="px-3 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 font-semibold rounded text-xs border border-pink-200 transition"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Reply to Patient Inquiry
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Patient: <strong>{selectedInquiry.patient?.profile?.full_name}</strong>
            </p>

            <div className="space-y-3 text-xs mb-4">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="font-bold text-gray-800 mb-1">{selectedInquiry.subject}</p>
                <p className="text-gray-600 leading-relaxed">{selectedInquiry.message}</p>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Reception Staff Response
                </label>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your official clinic response here..."
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setSelectedInquiry(null)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReply}
                disabled={sending}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 transition"
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

