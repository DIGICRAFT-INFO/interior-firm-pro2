"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Eye, Trash2, Loader2, Edit3, X,
  FileSpreadsheet, Printer, Mail, MessageCircle,
  CheckCircle, RotateCcw, Search, ChevronDown,
  User, Building2, UserPlus, FolderPlus, Library,
  ArrowRight, Save, Package
} from "lucide-react";
import { getGstEnabledLocal } from "@/lib/gstToggle";


const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return { "Content-Type": "application/json" };
  const token = localStorage.getItem("access") || localStorage.getItem("access_token") || localStorage.getItem("token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function handleUnauth(status: number) {
  if (status === 401 && typeof window !== "undefined") window.location.href = "/login";
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Client { id: string; full_name: string; email: string; phone: string; billing_address: string; gstin: string; projects: Project[]; }
interface Project { id: string; name: string; property_type: string; status: string; }
interface LineLibraryItem { id: string; category: string; name: string; description: string; default_rate: string; unit: string; }
interface QuotationItem { id?: string; description: string; category: string; quantity: string; unit: string; rate: string; sort_order: number; }
interface Quotation { id: string; quote_number: string; version: number; project: string; project_name: string; client_name: string; status: string; grand_total: string; subtotal: string; discount_type: string; discount_value: string; discount_amount: string; taxable_amount: string; cgst_rate: string; sgst_rate: string; igst_rate: string; cgst_amount: string; sgst_amount: string; igst_amount: string; total_tax: string; valid_until: string; notes: string; items: QuotationItem[]; created_at: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "Approved", color: "#10B981", bg: "#ECFDF5" },
  sent: { label: "Sent", color: "#3B82F6", bg: "#EFF6FF" },
  draft: { label: "Draft", color: "#6B7280", bg: "#F3F4F6" },
  rejected: { label: "Rejected", color: "#EF4444", bg: "#FEF2F2" },
  superseded: { label: "Superseded", color: "#9CA3AF", bg: "#F9FAFB" },
};
const EMPTY_ITEM: QuotationItem = { description: "", category: "", quantity: "1", unit: "lot", rate: "", sort_order: 0 };

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg = { success: "#10B981", error: "#EF4444", info: "#C8922A" }[type];
  return (
    <div className="fixed bottom-6 right-6 z-[300] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl text-white text-[13px] font-semibold animate-in slide-in-from-bottom-4"
      style={{ backgroundColor: bg }}>
      {message}<button onClick={onClose}><X size={14} /></button>
    </div>
  );
}

// ─── QUICK ADD CLIENT MODAL ───────────────────────────────────────────────────
function QuickAddClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (client: Client) => void }) {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", billing_address: "", site_address: "", gstin: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/clients/`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(form) });
      handleUnauth(res.status);
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e)); }
      const created: Client = await res.json();
      onCreated(created);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#EDE8DF] flex justify-between items-center bg-[#FCFBF9]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FDF3E3] rounded-lg flex items-center justify-center"><UserPlus size={15} className="text-[#C8922A]" /></div>
            <h3 className="text-[16px] font-bold">Add New Client</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#F5F2ED] rounded-full text-[#9A8F82]"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-[12px] text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}
          {[
            { key: "full_name", label: "Full Name *", placeholder: "e.g. Rajesh Kumar", required: true },
            { key: "phone", label: "Phone *", placeholder: "e.g. 9876543210", required: true },
            { key: "email", label: "Email", placeholder: "client@email.com", required: false },
            { key: "billing_address", label: "Billing Address *", placeholder: "Full address...", required: true },
            { key: "site_address", label: "Site Address", placeholder: "If different from billing", required: false },
            { key: "gstin", label: "GSTIN", placeholder: "If GST registered", required: false },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">{f.label}</label>
              <input required={f.required} value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full border border-[#EDE8DF] rounded-xl p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]" />
            </div>
          ))}
          <button type="submit" disabled={saving}
            className="w-full bg-[#C8922A] hover:bg-[#B07A20] text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-[13px]">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save Client
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── QUICK ADD PROJECT MODAL ──────────────────────────────────────────────────
function QuickAddProjectModal({
  clientId,
  clientName,
  onClose,
  onCreated,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [form, setForm] = useState({
    client: clientId, // ✅ auto-fill
    name: "",
    property_type: "apartment",
    style_category: "modern",
    area_sqft: "",
    budget_range: "",
    start_date: "",
    expected_end_date: "",
    status: "active",
    notes: "",
  });

  // ✅ agar clientId change ho (rare case), form.client update
  useEffect(() => {
    setForm((prev) => ({ ...prev, client: clientId }));
  }, [clientId]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        ...form,
        client: clientId, // ✅ force (safety)
        area_sqft: form.area_sqft ? form.area_sqft : null,
      };

      const res = await fetch(`${API_BASE}/clients/${clientId}/projects/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      handleUnauth(res.status);

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(e));
      }

      const created: Project = await res.json();
      onCreated(created);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#EDE8DF] flex justify-between items-center bg-[#FCFBF9]">
          <div>
            <h3 className="text-[16px] font-bold">Add New Project</h3>
            <p className="text-[11px] text-[#9A8F82]">Client: {clientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#F5F2ED] rounded-full text-[#9A8F82]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-[12px] text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}

          {/* ✅ Client auto-filled (read-only) */}
          <div>
            <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Client</label>
            <input
              value={clientName}
              disabled
              className="w-full border border-[#EDE8DF] rounded-xl p-2.5 text-[13px] bg-[#FAF8F5] opacity-80"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Project Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-[#EDE8DF] rounded-xl p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]"
              placeholder="e.g. Living Room Redesign"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Property Type *</label>
              <select
                value={form.property_type}
                onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                className="w-full border border-[#EDE8DF] rounded-xl p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]"
              >
                {["apartment", "villa", "office", "commercial"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Style</label>
              <select
                value={form.style_category}
                onChange={(e) => setForm({ ...form, style_category: e.target.value })}
                className="w-full border border-[#EDE8DF] rounded-xl p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]"
              >
                {["modern", "traditional", "minimalist", "contemporary"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Area (sqft)</label>
              <input
                type="number"
                value={form.area_sqft}
                onChange={(e) => setForm({ ...form, area_sqft: e.target.value })}
                className="w-full border border-[#EDE8DF] rounded-xl p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Budget Range</label>
              <input
                value={form.budget_range}
                onChange={(e) => setForm({ ...form, budget_range: e.target.value })}
                className="w-full border border-[#EDE8DF] rounded-xl p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full border border-[#EDE8DF] rounded-xl p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">End Date</label>
              <input
                type="date"
                value={form.expected_end_date}
                onChange={(e) => setForm({ ...form, expected_end_date: e.target.value })}
                className="w-full border border-[#EDE8DF] rounded-xl p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-[#EDE8DF] rounded-xl p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#C8922A] hover:bg-[#B07A20] text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-[13px]"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save Project
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── LINE ITEM LIBRARY PICKER ─────────────────────────────────────────────────
function LineItemLibraryPicker({ items: libraryItems, onSelect, onClose }: {
  items: LineLibraryItem[]; onSelect: (item: LineLibraryItem) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", ...Array.from(new Set(libraryItems.map(i => i.category))).sort()];
  const filtered = libraryItems.filter(i =>
    (selectedCategory === "All" || i.category === selectedCategory) &&
    (i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#EDE8DF] flex justify-between items-center bg-[#FCFBF9]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FDF3E3] rounded-lg flex items-center justify-center"><Library size={15} className="text-[#C8922A]" /></div>
            <h3 className="text-[16px] font-bold">Line Item Library</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#F5F2ED] rounded-full text-[#9A8F82]"><X size={18} /></button>
        </div>

        <div className="p-4 border-b border-[#EDE8DF] space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8F82]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#FAF8F5] border border-[#EDE8DF] rounded-xl text-[13px] outline-none focus:border-[#C8922A]" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${selectedCategory === cat ? "bg-[#C8922A] text-white" : "bg-[#F5F2ED] text-[#6B6259] hover:bg-[#EDE8DF]"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto divide-y divide-[#F5F2ED]">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-[#9A8F82] text-[13px]">
              No items found. Add items in Settings → Line Item Library.
            </div>
          ) : filtered.map(item => (
            <button key={item.id} onClick={() => onSelect(item)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF8F5] transition-colors group text-left">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#F5F2ED] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package size={14} className="text-[#9A8F82]" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#1C1C1C] group-hover:text-[#C8922A]">{item.name}</p>
                  <p className="text-[11px] text-[#9A8F82]">{item.category} · {item.unit}</p>
                  {item.description && <p className="text-[11px] text-[#9A8F82] mt-0.5 line-clamp-1">{item.description}</p>}
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-[13px] font-bold text-[#1C1C1C]">₹{parseFloat(item.default_rate).toLocaleString("en-IN")}</p>
                <p className="text-[11px] text-[#9A8F82]">/{item.unit}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [lineLibrary, setLineLibrary] = useState<LineLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // Modals
  const [isMainModalOpen, setIsMainModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [items, setItems] = useState<QuotationItem[]>([{ ...EMPTY_ITEM }]);
  const [formMeta, setFormMeta] = useState({
    valid_until: "", discount_type: "fixed", discount_value: "0",
    cgst_rate: "9", sgst_rate: "9", igst_rate: "0", notes: "", status: "draft",
  });

  const [gstEnabled, setGstEnabled] = useState(true);

  useEffect(() => {
    setGstEnabled(getGstEnabledLocal(true));

    const handler = () => setGstEnabled(getGstEnabledLocal(true));
    window.addEventListener("gst_enabled_changed", handler);
    return () => window.removeEventListener("gst_enabled_changed", handler);
  }, []);

  const showToast = (msg: string, type: "success" | "error" | "info") => setToast({ message: msg, type });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchQuotations(), fetchClients(), fetchLineLibrary()]);
    setLoading(false);
  }

  async function fetchQuotations() {
    try {
      const res = await fetch(`${API_BASE}/quotations/`, { headers: getAuthHeaders() });
      handleUnauth(res.status);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuotations(data.results ?? data ?? []);
    } catch { showToast("Failed to load quotations", "error"); }
  }

  async function fetchClients() {
    try {
      const res = await fetch(`${API_BASE}/clients/`, { headers: getAuthHeaders() });
      handleUnauth(res.status);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClients(data.results ?? data ?? []);
    } catch { }
  }

  async function fetchLineLibrary() {
    try {
      const res = await fetch(`${API_BASE}/line-items/`, { headers: getAuthHeaders() });
      handleUnauth(res.status);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLineLibrary(data.results ?? data ?? []);
    } catch { }
  }

  // ── Client change ──────────────────────────────────────────────────────────
  function handleClientChange(clientId: string) {
    setSelectedClientId(clientId);
    setSelectedProjectId("");
    setSelectedClient(clients.find(c => c.id === clientId) || null);
  }

  // ── After quick add client ─────────────────────────────────────────────────
  function handleClientCreated(client: Client) {
    const withProjects = { ...client, projects: [] };
    setClients(prev => [...prev, withProjects]);
    setSelectedClientId(client.id);
    setSelectedClient(withProjects);
    setSelectedProjectId("");
    setShowAddClient(false);
    showToast(`Client "${client.full_name}" added!`, "success");
  }

  // ── After quick add project ────────────────────────────────────────────────
  function handleProjectCreated(project: Project) {
    setClients(prev => prev.map(c =>
      c.id === selectedClientId ? { ...c, projects: [...(c.projects || []), project] } : c
    ));
    setSelectedClient(prev => prev ? { ...prev, projects: [...(prev.projects || []), project] } : prev);
    setSelectedProjectId(project.id);
    setShowAddProject(false);
    showToast(`Project "${project.name}" added!`, "success");
  }

  // ── Line library select ────────────────────────────────────────────────────
  function handleLibrarySelect(libItem: LineLibraryItem) {
    setItems(prev => [
      ...prev,
      {
        description: libItem.name + (libItem.description ? ` — ${libItem.description}` : ""),
        category: libItem.category,
        quantity: "1",
        unit: libItem.unit,
        rate: libItem.default_rate,
        sort_order: prev.length,
      }
    ]);
    setShowLibrary(false);
    showToast(`"${libItem.name}" added!`, "success");
  }

  // ── Item helpers ───────────────────────────────────────────────────────────
  function addBlankItem() { setItems(prev => [...prev, { ...EMPTY_ITEM, sort_order: prev.length }]); }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: keyof QuotationItem, value: string) {
    setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });
  }
  function itemAmount(item: QuotationItem): number {
    const q = parseFloat(item.quantity || "0"), r = parseFloat(item.rate || "0");
    return isNaN(q) || isNaN(r) ? 0 : q * r;
  }

  // Live totals
  const computeTotals = useCallback(() => {
    const subtotal = items.reduce((s, it) => s + itemAmount(it), 0);
    const dv = parseFloat(formMeta.discount_value || "0") || 0;
    const discountAmt = formMeta.discount_type === "percentage" ? subtotal * dv / 100 : dv;
    const taxable = subtotal - discountAmt;
    const useIgst = gstEnabled && parseFloat(formMeta.igst_rate || "0") > 0;

const cgst = gstEnabled && !useIgst
  ? (taxable * parseFloat(formMeta.cgst_rate || "0")) / 100
  : 0;

const sgst = gstEnabled && !useIgst
  ? (taxable * parseFloat(formMeta.sgst_rate || "0")) / 100
  : 0;

const igst = gstEnabled && useIgst
  ? (taxable * parseFloat(formMeta.igst_rate || "0")) / 100
  : 0;
    return { subtotal, discountAmt, taxable, cgst, sgst, igst, totalTax: cgst + sgst + igst, grand: taxable + cgst + sgst + igst };
  }, [items, formMeta]);
  const totals = computeTotals();
  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Open create ────────────────────────────────────────────────────────────
  function openCreate() {
    setEditingId(null);
    setSelectedClientId(""); setSelectedClient(null); setSelectedProjectId("");
    setItems([{ ...EMPTY_ITEM }]);
    setFormMeta({ valid_until: "", discount_type: "fixed", discount_value: "0", cgst_rate: "9", sgst_rate: "9", igst_rate: "0", notes: "", status: "draft" });
    setIsMainModalOpen(true);
  }

  // ── Open edit ──────────────────────────────────────────────────────────────
  async function openEdit(id: string) {
    try {
      const res = await fetch(`${API_BASE}/quotations/${id}/`, { headers: getAuthHeaders() });
      handleUnauth(res.status);
      const q: Quotation = await res.json();

      // Match client from project
      let matchedClient: Client | null = null;
      let matchedClientId = "";
      const allClients = clients.length > 0 ? clients : await (async () => {
        const r = await fetch(`${API_BASE}/clients/`, { headers: getAuthHeaders() });
        const d = await r.json(); const list = d.results ?? d ?? [];
        setClients(list); return list;
      })();
      for (const c of allClients) {
        if ((c.projects || []).some((p: Project) => p.id === q.project)) {
          matchedClient = c; matchedClientId = c.id; break;
        }
      }

      setEditingId(id);
      setSelectedClientId(matchedClientId);
      setSelectedClient(matchedClient);
      setSelectedProjectId(q.project);
      setItems(q.items?.length ? q.items.map(it => ({
        id: it.id, description: it.description, category: it.category || "",
        quantity: String(it.quantity), unit: it.unit || "lot", rate: String(it.rate), sort_order: it.sort_order || 0,
      })) : [{ ...EMPTY_ITEM }]);
      setFormMeta({
        valid_until: q.valid_until || "", discount_type: q.discount_type || "fixed",
        discount_value: String(q.discount_value || "0"), cgst_rate: String(q.cgst_rate || "9"),
        sgst_rate: String(q.sgst_rate || "9"), igst_rate: String(q.igst_rate || "0"),
        notes: q.notes || "", status: q.status || "draft",
      });
      setIsMainModalOpen(true);
    } catch { showToast("Failed to load quotation", "error"); }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) { showToast("Please select a project", "error"); return; }
    if (!items[0]?.description) { showToast("Add at least one line item", "error"); return; }
    setSubmitting(true);
    try {
      const payload = {
        project: selectedProjectId, ...formMeta,
        items: items.map((it, idx) => ({
          ...(it.id ? { id: it.id } : {}),
          description: it.description, category: it.category,
          quantity: it.quantity, unit: it.unit, rate: it.rate, sort_order: idx,
          cgst_rate: gstEnabled ? formMeta.cgst_rate : "0",
  sgst_rate: gstEnabled ? formMeta.sgst_rate : "0",
  igst_rate: gstEnabled ? formMeta.igst_rate : "0",
        })),
      };
      const url = editingId ? `${API_BASE}/quotations/${editingId}/` : `${API_BASE}/quotations/`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(payload) });
      handleUnauth(res.status);
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e)); }
      showToast(editingId ? "Updated!" : "Created!", "success");
      setIsMainModalOpen(false);
      fetchQuotations();
    } catch (err: any) { showToast("Error: " + err.message, "error"); }
    finally { setSubmitting(false); }
  }

  // ── Delete / Approve / Revise / PDF / Excel / Email / WA ──────────────────
  async function handleDelete(id: string) {
    if (!confirm("Delete?")) return;
    try {
      const res = await fetch(`${API_BASE}/quotations/${id}/`, { method: "DELETE", headers: getAuthHeaders() });
      handleUnauth(res.status);
      showToast("Deleted", "info"); fetchQuotations();
    } catch { showToast("Delete failed", "error"); }
  }
  async function handleApprove(id: string) {
    setActionId(`approve_${id}`);
    try {
      const res = await fetch(`${API_BASE}/quotations/${id}/approve/`, { method: "POST", headers: getAuthHeaders() });
      handleUnauth(res.status);
      if (res.ok) { showToast("Approved!", "success"); fetchQuotations(); }
      else { const e = await res.json(); showToast(e.detail || "Failed", "error"); }
    } catch { showToast("Failed", "error"); } finally { setActionId(null); }
  }
  async function handleRevise(id: string) {
    if (!confirm("Create new version?")) return;
    setActionId(`revise_${id}`);
    try {
      const res = await fetch(`${API_BASE}/quotations/${id}/revise/`, { method: "POST", headers: getAuthHeaders() });
      handleUnauth(res.status);
      if (res.ok) { showToast("New version created!", "success"); fetchQuotations(); }
    } catch { showToast("Failed", "error"); } finally { setActionId(null); }
  }
  async function handlePDF(id: string, qNum: string) {
    setActionId(`pdf_${id}`);
    try {
      const res = await fetch(`${API_BASE}/quotations/${id}/pdf/`, { headers: getAuthHeaders() });
      handleUnauth(res.status);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${qNum}.pdf`; a.click();
      URL.revokeObjectURL(url); showToast("PDF downloaded!", "success");
    } catch { showToast("PDF failed", "error"); } finally { setActionId(null); }
  }
  function handleExcel(q: Quotation) {
    const rows = [
      ["QUOTATION"], [""], ["Quote #", q.quote_number], ["Version", q.version],
      ["Client", q.client_name], ["Project", q.project_name], ["Status", q.status], ["Valid Until", q.valid_until || "—"], [""],
      ["#", "Description", "Category", "Qty", "Unit", "Rate", "Amount"],
      ...(q.items || []).map((it, i) => [i + 1, it.description, it.category, it.quantity, it.unit, it.rate, (parseFloat(it.quantity || "0") * parseFloat(it.rate || "0")).toFixed(2)]),
      [""], ["Subtotal", "", "", "", "", "", q.subtotal], ["Grand Total", "", "", "", "", "", q.grand_total],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${q.quote_number}.csv`; a.click();
    URL.revokeObjectURL(url); showToast("Excel downloaded!", "success");
  }
  async function handleEmail(id: string) {
    setActionId(`email_${id}`);
    try {
      const res = await fetch(`${API_BASE}/notifications/email/quotation/${id}/send/`, { method: "POST", headers: getAuthHeaders() });
      handleUnauth(res.status);
      showToast(res.ok ? "Emailed!" : "Email failed", res.ok ? "success" : "error");
    } catch { showToast("Failed", "error"); } finally { setActionId(null); }
  }
  async function handleWA(id: string) {
    setActionId(`wa_${id}`);
    try {
      const res = await fetch(`${API_BASE}/notifications/whatsapp/quotation/${id}/send/`, { method: "POST", headers: getAuthHeaders() });
      handleUnauth(res.status);
      showToast(res.ok ? "WhatsApp sent!" : "WA failed — check ngrok", res.ok ? "success" : "error");
    } catch { showToast("Failed", "error"); } finally { setActionId(null); }
  }

  const filtered = quotations.filter(q =>
    q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
    q.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    q.project_name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedClientProjects = selectedClient?.projects || [];

  return (
    <div className="p-6 min-h-screen bg-[#FCFBF9]">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Nested modals ── */}
      {showAddClient && (
        <QuickAddClientModal onClose={() => setShowAddClient(false)} onCreated={handleClientCreated} />
      )}
      {showAddProject && selectedClient && (
        <QuickAddProjectModal clientId={selectedClientId} clientName={selectedClient.full_name}
          onClose={() => setShowAddProject(false)} onCreated={handleProjectCreated} />
      )}
      {showLibrary && (
        <LineItemLibraryPicker items={lineLibrary} onSelect={handleLibrarySelect} onClose={() => setShowLibrary(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#1C1C1C]">Quotations</h1>
          <p className="text-[13px] text-[#9A8F82] mt-0.5">Manage estimates, GST calculations & client approvals</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-[#C8922A] hover:bg-[#B07A20] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm">
          <Plus size={16} /> New Quotation
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8F82]" />
        <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#EDE8DF] rounded-xl text-[13px] outline-none focus:border-[#C8922A]" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#EDE8DF] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#FAF8F5] border-b border-[#EDE8DF]">
              {["Quote", "Client & Project", "Grand Total", "Status", "Actions"].map(h => (
                <th key={h} className={`px-6 py-4 text-[11px] font-bold text-[#9A8F82] uppercase tracking-wider ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F2ED]">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin inline text-[#C8922A]" size={24} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-20 text-center text-[#9A8F82] text-[14px]">No quotations. Create your first one!</td></tr>
            ) : filtered.map(q => {
              const st = statusConfig[q.status] || statusConfig.draft;
              return (
                <tr key={q.id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-bold text-[#C8922A]">{q.quote_number}</p>
                    <p className="text-[11px] text-[#9A8F82]">v{q.version}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-semibold text-[#1C1C1C]">{q.client_name}</p>
                    <p className="text-[12px] text-[#6B6259]">{q.project_name}</p>
                  </td>
                  <td className="px-6 py-4 font-bold text-[#1C1C1C] text-[14px]">₹{parseFloat(q.grand_total || "0").toLocaleString("en-IN")}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold px-3 py-1 rounded-full uppercase"
                      style={{ color: st.color, backgroundColor: st.bg }}>{st.label}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(q.id)} title="Edit" className="p-2 text-[#9A8F82] hover:text-[#C8922A] hover:bg-[#FDF3E3] rounded-lg transition-colors"><Edit3 size={14} /></button>
                      {["draft", "sent"].includes(q.status) && (
                        <button onClick={() => handleApprove(q.id)} title="Approve" disabled={actionId === `approve_${q.id}`} className="p-2 text-[#9A8F82] hover:text-[#10B981] hover:bg-[#ECFDF5] rounded-lg transition-colors">
                          {actionId === `approve_${q.id}` ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        </button>
                      )}
                      {["approved", "sent"].includes(q.status) && (
                        <button onClick={() => handleRevise(q.id)} title="Revise" disabled={actionId === `revise_${q.id}`} className="p-2 text-[#9A8F82] hover:text-[#C8922A] hover:bg-[#FDF3E3] rounded-lg transition-colors">
                          {actionId === `revise_${q.id}` ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        </button>
                      )}
                      <button onClick={() => handlePDF(q.id, q.quote_number)} title="PDF" disabled={actionId === `pdf_${q.id}`} className="p-2 text-[#9A8F82] hover:text-[#1C1C1C] hover:bg-[#F5F2ED] rounded-lg transition-colors">
                        {actionId === `pdf_${q.id}` ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                      </button>
                      <button onClick={() => handleExcel(q)} title="Excel" className="p-2 text-[#9A8F82] hover:text-[#10B981] hover:bg-[#ECFDF5] rounded-lg transition-colors"><FileSpreadsheet size={14} /></button>
                      <button onClick={() => handleEmail(q.id)} title="Email" disabled={actionId === `email_${q.id}`} className="p-2 text-[#9A8F82] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                        {actionId === `email_${q.id}` ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      </button>
                      <button onClick={() => handleWA(q.id)} title="WhatsApp" disabled={actionId === `wa_${q.id}`} className="p-2 text-[#9A8F82] hover:text-[#25D366] hover:bg-[#ECFDF5] rounded-lg transition-colors">
                        {actionId === `wa_${q.id}` ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                      </button>
                      <button onClick={() => handleDelete(q.id)} title="Delete" className="p-2 text-[#9A8F82] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ════════════════════════════════════════════════════════
          MAIN MODAL: Create / Edit Quotation
      ════════════════════════════════════════════════════════ */}
      {isMainModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EDE8DF] bg-[#FCFBF9] flex-shrink-0">
              <div>
                <h2 className="text-[18px] font-bold">{editingId ? "Edit Quotation" : "New Quotation"}</h2>
                <p className="text-[12px] text-[#9A8F82] mt-0.5">
                  {editingId ? "Update items, GST & discount" : "Select client, add items & compute GST"}
                </p>
              </div>
              <button onClick={() => setIsMainModalOpen(false)} className="p-2 hover:bg-[#F5F2ED] rounded-full text-[#9A8F82]"><X size={20} /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* ── Client & Project ── */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-black text-[#9A8F82] uppercase tracking-widest">Client & Project</h3>

                {/* Client row */}
                <div>
                  <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1.5">Client *</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8F82]" />
                      <select required value={selectedClientId} onChange={e => handleClientChange(e.target.value)}
                        className="w-full pl-9 pr-8 py-3 border border-[#EDE8DF] rounded-xl text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5] appearance-none">
                        <option value="">Select client...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A8F82] pointer-events-none" />
                    </div>
                    <button type="button" onClick={() => setShowAddClient(true)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-[#C8922A] text-[#C8922A] rounded-xl text-[12px] font-semibold hover:bg-[#FDF3E3] transition-colors flex-shrink-0">
                      <UserPlus size={14} /> Add Client
                    </button>
                  </div>
                </div>

                {/* Client details */}
                {selectedClient && (
                  <div className="grid grid-cols-3 gap-3 p-4 bg-[#FAF8F5] rounded-xl border border-[#EDE8DF]">
                    {[["Phone", selectedClient.phone], ["Email", selectedClient.email || "—"], ["GSTIN", selectedClient.gstin || "Not registered"]].map(([l, v]) => (
                      <div key={l}>
                        <p className="text-[10px] font-bold text-[#9A8F82] uppercase">{l}</p>
                        <p className="text-[12px] font-medium text-[#1C1C1C] mt-0.5 truncate">{v}</p>
                      </div>
                    ))}
                    <div className="col-span-3">
                      <p className="text-[10px] font-bold text-[#9A8F82] uppercase">Billing Address</p>
                      <p className="text-[12px] text-[#1C1C1C] mt-0.5">{selectedClient.billing_address}</p>
                    </div>
                  </div>
                )}

                {/* Project row */}
                <div>
                  <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1.5">Project *</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8F82]" />
                      <select required value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}
                        disabled={!selectedClientId}
                        className="w-full pl-9 pr-8 py-3 border border-[#EDE8DF] rounded-xl text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5] appearance-none disabled:opacity-50">
                        <option value="">{selectedClientId ? "Select project..." : "Select client first"}</option>
                        {selectedClientProjects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.property_type})</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A8F82] pointer-events-none" />
                    </div>
                    <button type="button" onClick={() => { if (!selectedClientId) { showToast("Select a client first", "error"); return; } setShowAddProject(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-[#C8922A] text-[#C8922A] rounded-xl text-[12px] font-semibold hover:bg-[#FDF3E3] transition-colors flex-shrink-0">
                      <FolderPlus size={14} /> Add Project
                    </button>
                  </div>
                  {selectedClientId && selectedClientProjects.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">⚠️ No projects for this client. Click "Add Project".</p>
                  )}
                </div>
              </div>

              {/* ── Line Items ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-[#9A8F82] uppercase tracking-widest">Line Items</h3>
                  <div className="flex gap-2">
                    {/* From library */}
                    <button type="button" onClick={() => setShowLibrary(true)}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6B6259] border border-[#EDE8DF] px-3 py-1.5 rounded-lg hover:border-[#C8922A] hover:text-[#C8922A] transition-colors">
                      <Library size={13} /> From Library
                    </button>
                    {/* Add blank */}
                    <button type="button" onClick={addBlankItem}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-[#C8922A] hover:text-[#B07A20] transition-colors">
                      <Plus size={13} /> Add Item
                    </button>
                  </div>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="p-4 bg-[#FAF8F5] rounded-xl border border-[#EDE8DF] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#9A8F82]">Item {idx + 1}</span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="text-[#9A8F82] hover:text-red-500"><X size={14} /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Description *</label>
                        <input required value={item.description} onChange={e => updateItem(idx, "description", e.target.value)}
                          placeholder="e.g. Modular Kitchen — L-Shape"
                          className="w-full border border-[#EDE8DF] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Category</label>
                        <input value={item.category} onChange={e => updateItem(idx, "category", e.target.value)} placeholder="e.g. Furniture"
                          className="w-full border border-[#EDE8DF] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Unit</label>
                        <select value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)}
                          className="w-full border border-[#EDE8DF] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-white">
                          {["lot", "sqft", "nos", "rft", "per_space", "piece", "kg", "meter"].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Quantity *</label>
                        <input required type="number" min="0.01" step="0.01" value={item.quantity}
                          onChange={e => updateItem(idx, "quantity", e.target.value)}
                          className="w-full border border-[#EDE8DF] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Rate (₹) *</label>
                        <input required type="number" min="0" step="0.01" value={item.rate}
                          onChange={e => updateItem(idx, "rate", e.target.value)}
                          className="w-full border border-[#EDE8DF] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#C8922A] bg-white" />
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-[13px] font-bold text-[#1C1C1C]">Amount: {fmt(itemAmount(item))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Discount & GST ── */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-black text-[#9A8F82] uppercase tracking-widest">Discount & GST</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Discount Type</label>
                    <select value={formMeta.discount_type} onChange={e => setFormMeta({ ...formMeta, discount_type: e.target.value })}
                      className="w-full border border-[#EDE8DF] rounded-xl p-3 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]">
                      <option value="fixed">Fixed (₹)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Value {formMeta.discount_type === "percentage" ? "(%)" : "(₹)"}</label>
                    <input type="number" min="0" step="0.01" value={formMeta.discount_value}
                      onChange={e => setFormMeta({ ...formMeta, discount_value: e.target.value })}
                      className="w-full border border-[#EDE8DF] rounded-xl p-3 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]" />
                  </div>
                </div>
                {gstEnabled ? (
                  <div className="grid grid-cols-3 gap-3">
                    {[["cgst_rate", "CGST (%)"], ["sgst_rate", "SGST (%)"], ["igst_rate", "IGST (%)"]].map(([k, l]) => (
                      <div key={k}>
                        <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">{l}</label>
                        <input type="number" min="0" max="28" step="0.01"
                          value={formMeta[k as keyof typeof formMeta]}
                          onChange={e => setFormMeta({ ...formMeta, [k]: e.target.value })}
                          className="w-full border border-[#EDE8DF] rounded-xl p-3 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9A8F82]">
                    GST is OFF (Settings → GST Configuration)
                  </p>
                )}
                <p className="text-[11px] text-[#9A8F82]">💡 Same state → CGST+SGST (9%+9%). Different state → IGST only (18%), set CGST & SGST to 0.</p>
              </div>

              {/* ── Live Summary ── */}
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#EDE8DF] space-y-2">
                <h3 className="text-[11px] font-black text-[#9A8F82] uppercase tracking-widest mb-3">Live Summary</h3>
                {[
                  ["Subtotal", fmt(totals.subtotal)],
                  ["Discount", `-${fmt(totals.discountAmt)}`],
                  ["Taxable Amount", fmt(totals.taxable)],
                  ...(totals.cgst > 0 ? [["CGST", fmt(totals.cgst)]] : []),
                  ...(totals.sgst > 0 ? [["SGST", fmt(totals.sgst)]] : []),
                  ...(totals.igst > 0 ? [["IGST", fmt(totals.igst)]] : []),
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-[13px]">
                    <span className="text-[#6B6259]">{l}</span><span>{v}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[15px] font-bold pt-2 border-t border-[#EDE8DF]">
                  <span>Grand Total</span><span className="text-[#C8922A]">{fmt(totals.grand)}</span>
                </div>
              </div>

              {/* ── Other Details ── */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-black text-[#9A8F82] uppercase tracking-widest">Other Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Valid Until</label>
                    <input type="date" value={formMeta.valid_until} onChange={e => setFormMeta({ ...formMeta, valid_until: e.target.value })}
                      className="w-full border border-[#EDE8DF] rounded-xl p-3 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Status</label>
                    <select value={formMeta.status} onChange={e => setFormMeta({ ...formMeta, status: e.target.value })}
                      className="w-full border border-[#EDE8DF] rounded-xl p-3 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5]">
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#9A8F82] uppercase mb-1">Notes</label>
                  <textarea value={formMeta.notes} onChange={e => setFormMeta({ ...formMeta, notes: e.target.value })} rows={3}
                    placeholder="Payment terms, conditions..."
                    className="w-full border border-[#EDE8DF] rounded-xl p-3 text-[13px] outline-none focus:border-[#C8922A] bg-[#FAF8F5] resize-none" />
                </div>
              </div>
              <div className="h-4" />
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-[#EDE8DF] bg-[#FCFBF9] flex-shrink-0">
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full bg-[#C8922A] hover:bg-[#B07A20] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-[14px]">
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {editingId ? "Update Quotation" : "Create Quotation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
