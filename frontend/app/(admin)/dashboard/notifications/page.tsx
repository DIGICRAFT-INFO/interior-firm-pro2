"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Receipt,
  FileText,
  IndianRupee,
  ScrollText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  InAppNotification,
} from "@/lib/notifications";

const EVENT_TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  client_created: { icon: Users, color: "#D97706", bg: "#FEF3C7" },
  invoice_created: { icon: Receipt, color: "#059669", bg: "#D1FAE5" },
  invoice_sent: { icon: Receipt, color: "#059669", bg: "#D1FAE5" },
  invoice_paid: { icon: Receipt, color: "#059669", bg: "#D1FAE5" },
  quotation_created: { icon: FileText, color: "#2563EB", bg: "#DBEAFE" },
  quotation_approved: { icon: FileText, color: "#2563EB", bg: "#DBEAFE" },
  quotation_rejected: { icon: FileText, color: "#2563EB", bg: "#DBEAFE" },
  payment_received: { icon: IndianRupee, color: "#7C3AED", bg: "#EDE9FE" },
  proposal_created: { icon: ScrollText, color: "#0D9488", bg: "#CCFBF1" },
  proposal_sent: { icon: ScrollText, color: "#0D9488", bg: "#CCFBF1" },
  proposal_accepted: { icon: ScrollText, color: "#0D9488", bg: "#CCFBF1" },
  proposal_rejected: { icon: ScrollText, color: "#0D9488", bg: "#CCFBF1" },
};

const EVENT_TYPE_FILTERS = [
  { label: "All", value: "" },
  { label: "Client", value: "client_created" },
  { label: "Invoice", value: "invoice" },
  { label: "Quotation", value: "quotation" },
  { label: "Payment", value: "payment_received" },
  { label: "Proposal", value: "proposal" },
];

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { page?: number; limit?: number; type?: string; is_read?: boolean } = {
        page,
        limit: 20,
      };
      if (typeFilter) params.type = typeFilter;
      if (readFilter === "unread") params.is_read = false;
      if (readFilter === "read") params.is_read = true;

      const data = await fetchNotifications(params);
      setNotifications(data.notifications || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load notifications");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, readFilter]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await fetchUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  const getIconConfig = (eventType: string) => {
    return EVENT_TYPE_CONFIG[eventType] || { icon: Receipt, color: "#6B7280", bg: "#F3F4F6" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#1C1C1C] tracking-tight">
            Notifications
          </h1>
          <p className="text-[13px] text-[#9A8F82] mt-1">
            {total} total · {unreadCount} unread
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 text-[12px] font-bold text-[#C8922A] bg-[#FDF3E3] rounded-xl hover:bg-[#F5E6C8] transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="text-[12px] text-[#6B6259] bg-white border border-[#EDE8DF] rounded-lg px-3 py-2 outline-none font-medium cursor-pointer"
        >
          {EVENT_TYPE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <div className="flex items-center bg-white border border-[#EDE8DF] rounded-lg overflow-hidden">
          {(["all", "unread", "read"] as const).map((val) => (
            <button
              key={val}
              onClick={() => { setReadFilter(val); setPage(1); }}
              className={`px-3 py-2 text-[12px] font-medium capitalize transition-colors ${
                readFilter === val
                  ? "bg-[#FDF3E3] text-[#C8922A] font-bold"
                  : "text-[#6B6259] hover:bg-[#FAF8F5]"
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl border border-[#EDE8DF] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-[#C8922A] border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-[14px] text-[#D04040] font-medium">{error}</p>
            <button
              onClick={loadNotifications}
              className="mt-3 text-[12px] text-[#C8922A] font-bold hover:underline"
            >
              Try again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[14px] text-[#6B6259] font-medium">No notifications found</p>
            <p className="text-[12px] text-[#9A8F82] mt-1">
              {typeFilter || readFilter !== "all"
                ? "Try adjusting your filters"
                : "Notifications will appear here when events occur"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F5F2ED]">
            {notifications.map((notification) => {
              const config = getIconConfig(notification.event_type);
              const Icon = config.icon;
              return (
                <button
                  key={notification.id}
                  onClick={() => {
                    if (!notification.is_read) {
                      handleMarkAsRead(notification.id);
                    }
                  }}
                  className={`w-full flex items-start gap-4 px-5 py-4 hover:bg-[#FAF8F5] transition-colors text-left ${
                    !notification.is_read ? "bg-[#FDFCFA]" : ""
                  }`}
                >
                  {/* Event type icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: config.bg }}
                  >
                    <Icon size={18} style={{ color: config.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[#1C1C1C] truncate">
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#C8922A] shrink-0" />
                      )}
                    </div>
                    <p className="text-[12px] text-[#6B6259] mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-[11px] text-[#C8B89C] mt-1 font-medium">
                      {getRelativeTime(notification.created_at)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-[#9A8F82] font-medium">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 text-[12px] font-medium text-[#6B6259] bg-white border border-[#EDE8DF] rounded-lg hover:bg-[#FAF8F5] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 text-[12px] font-medium text-[#6B6259] bg-white border border-[#EDE8DF] rounded-lg hover:bg-[#FAF8F5] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
