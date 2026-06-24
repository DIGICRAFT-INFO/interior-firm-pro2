"use client";

import React, { useEffect, useState } from "react";
import {
  Banknote, Trash2, Edit3, Check, X, Loader2,
  CreditCard, Landmark, Smartphone, Coins, MoreHorizontal
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentRecord {
  id: string;
  invoice: string;
  invoice_number: string;
  client_name: string;
  amount_paid: string;
  payment_date: string;
  payment_mode: string;
  reference_number: string;
  notes: string;
  created_at: string;
}

interface PaymentHistoryPanelProps {
  invoiceId: string;
  grandTotal: number;
  onPaymentChange?: () => void; // callback to refresh parent invoice data
}

// ── API Helpers ───────────────────────────────────────────────────────────────

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
}

async function fetchPaymentsByInvoice(invoiceId: string): Promise<PaymentRecord[]> {
  const res = await fetch(`/api/v1/payments/?invoice=${invoiceId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch payments");
  return res.json();
}

async function updatePaymentNotes(paymentId: string, notes: string): Promise<void> {
  const res = await fetch(`/api/v1/payments/${paymentId}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error("Failed to update");
}

async function deletePayment(paymentId: string): Promise<void> {
  const res = await fetch(`/api/v1/payments/${paymentId}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to delete");
}

// ── Mode label + icon ─────────────────────────────────────────────────────────

const MODE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  bank_transfer: { label: "Bank Transfer", icon: <Landmark size={12} />, color: "#3B82F6" },
  upi:           { label: "UPI",           icon: <Smartphone size={12} />, color: "#8B5CF6" },
  cheque:        { label: "Cheque",        icon: <CreditCard size={12} />, color: "#6B7280" },
  cash:          { label: "Cash",          icon: <Coins size={12} />,      color: "#10B981" },
  neft:          { label: "NEFT / RTGS",   icon: <Landmark size={12} />,  color: "#3B82F6" },
  other:         { label: "Other",         icon: <MoreHorizontal size={12} />, color: "#9A8F82" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PaymentHistoryPanel({
  invoiceId,
  grandTotal,
  onPaymentChange,
}: PaymentHistoryPanelProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editNotes, setEditNotes]   = useState("");
  const [savingId, setSavingId]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchPaymentsByInvoice(invoiceId)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [invoiceId]);

  const totalPaid    = payments.reduce((s, p) => s + parseFloat(p.amount_paid), 0);
  const balanceDue   = Math.max(0, grandTotal - totalPaid);
  const paidPercent  = grandTotal > 0 ? Math.min(100, (totalPaid / grandTotal) * 100) : 0;

  async function handleSaveNotes(paymentId: string) {
    setSavingId(paymentId);
    try {
      await updatePaymentNotes(paymentId, editNotes);
      setPayments(prev =>
        prev.map(p => p.id === paymentId ? { ...p, notes: editNotes } : p)
      );
      setEditingId(null);
      onPaymentChange?.();
    } catch {
      // silently fail — could add toast
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(paymentId: string) {
    setDeletingId(paymentId);
    try {
      await deletePayment(paymentId);
      setPayments(prev => prev.filter(p => p.id !== paymentId));
      setConfirmDelete(null);
      onPaymentChange?.();
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2">
        <Loader2 size={18} className="animate-spin text-[#C8922A]" />
        <span className="text-[13px] text-[#9A8F82]">Loading payment history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white border border-[#EDE8DF] rounded-xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-2 bg-[#F5F2ED]">
          <div
            className="h-2 bg-[#10B981] transition-all duration-700"
            style={{ width: `${paidPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-3 divide-x divide-[#EDE8DF]">
          <div className="px-5 py-3.5 text-center">
            <p className="text-[11px] text-[#9A8F82] font-medium uppercase tracking-wide mb-0.5">
              Total Invoiced
            </p>
            <p className="text-[16px] font-bold text-[#1C1C1C]">
              ₹{grandTotal.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="px-5 py-3.5 text-center">
            <p className="text-[11px] text-[#10B981] font-medium uppercase tracking-wide mb-0.5">
              Collected
            </p>
            <p className="text-[16px] font-bold text-[#10B981]">
              ₹{totalPaid.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="px-5 py-3.5 text-center">
            <p className="text-[11px] text-[#EF4444] font-medium uppercase tracking-wide mb-0.5">
              Balance Due
            </p>
            <p className={`text-[16px] font-bold ${balanceDue > 0 ? "text-[#EF4444]" : "text-[#10B981]"}`}>
              {balanceDue > 0 ? `₹${balanceDue.toLocaleString("en-IN")}` : "Fully Paid ✓"}
            </p>
          </div>
        </div>
      </div>

      {/* Payment records */}
      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 bg-[#FAF8F5] rounded-xl border border-dashed border-[#EDE8DF]">
          <div className="w-12 h-12 rounded-full bg-[#EDE8DF] flex items-center justify-center mb-3">
            <Banknote size={22} className="text-[#9A8F82]" />
          </div>
          <p className="text-[13px] font-medium text-[#6B6259]">No payments recorded yet</p>
          <p className="text-[12px] text-[#9A8F82] mt-1">Click "Record Payment" to log a payment</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((payment, idx) => {
            const modeConf = MODE_CONFIG[payment.payment_mode] || MODE_CONFIG.other;
            const isEditing  = editingId  === payment.id;
            const isDeleting = deletingId === payment.id;
            const isConfirm  = confirmDelete === payment.id;

            return (
              <div
                key={payment.id}
                className="bg-white border border-[#EDE8DF] rounded-xl px-5 py-4 hover:border-[#D4C5A9] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left — amount + mode */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${modeConf.color}15`, color: modeConf.color }}>
                      {modeConf.icon}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-[#1C1C1C]">
                        ₹{parseFloat(payment.amount_paid).toLocaleString("en-IN")}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ color: modeConf.color, backgroundColor: `${modeConf.color}15` }}>
                          {modeConf.label}
                        </span>
                        <span className="text-[11px] text-[#9A8F82]">
                          {formatDate(payment.payment_date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right — entry # + actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-[#9A8F82] font-mono">
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                    {!isConfirm && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(payment.id);
                            setEditNotes(payment.notes);
                          }}
                          className="p-1.5 rounded-lg hover:bg-[#EDE8DF] text-[#9A8F82] hover:text-[#C8922A] transition-colors"
                          title="Edit notes"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(payment.id)}
                          className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#9A8F82] hover:text-[#EF4444] transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                    {isConfirm && (
                      <div className="flex items-center gap-1.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-2 py-1">
                        <span className="text-[11px] text-[#EF4444] font-medium">Delete?</span>
                        <button
                          onClick={() => handleDelete(payment.id)}
                          disabled={isDeleting}
                          className="p-1 rounded text-[#EF4444] hover:bg-[#FECACA] transition-colors"
                        >
                          {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="p-1 rounded text-[#9A8F82] hover:bg-[#EDE8DF] transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reference number */}
                {payment.reference_number && (
                  <p className="mt-2 text-[11px] text-[#9A8F82] font-mono bg-[#FAF8F5] rounded-lg px-3 py-1.5">
                    Ref: {payment.reference_number}
                  </p>
                )}

                {/* Notes — view or edit */}
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      rows={2}
                      placeholder="Add notes..."
                      className="w-full text-[12px] px-3 py-2 border border-[#C8922A] rounded-lg outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveNotes(payment.id)}
                        disabled={savingId === payment.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C8922A] text-white text-[12px] font-semibold rounded-lg hover:bg-[#B07A20] transition-colors"
                      >
                        {savingId === payment.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-[12px] text-[#6B6259] hover:bg-[#EDE8DF] rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : payment.notes ? (
                  <p className="mt-2 text-[12px] text-[#6B6259] italic">
                    "{payment.notes}"
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}