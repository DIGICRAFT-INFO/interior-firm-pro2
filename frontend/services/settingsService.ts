// ============================================================
// ⚙️ SETTINGS SERVICE
// GST, Bank, Brand, Numbering, Milestones ke sare API calls yahan.
// ============================================================

import API_BASE_URL from "@/lib/config";

const SETTINGS_URL = `${API_BASE_URL}/settings`;

// ─── Types ────────────────────────────────────────────────────────────────────

export type GSTData = {
  gst_enabled?: boolean; 
  firm_gstin?: string;
  place_of_supply?: string;
  default_cgst?: number;
  default_sgst?: number;
  default_igst?: number;
  sac_code?: string;
};

export type Milestone = {
  id?: number;
  label: string;
  percentage: number;
};

export type AllSettings = {
  gst: GSTData;
  bank: Record<string, any>;
  brand: Record<string, any>;
  numbering: Record<string, any>;
  milestones: Milestone[];
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function handleUnauthorized(status: number) {
  if (status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
}

// ─── GET: Sab settings ek saath lao ──────────────────────────────────────────

export async function getAllSettings(): Promise<AllSettings> {
  const endpoints = ["tax", "bank", "brand", "numbering", "milestones"];

  const responses = await Promise.all(
    endpoints.map((ep) =>
      fetch(`${SETTINGS_URL}/${ep}/`, {
        method: "GET",
        headers: getAuthHeaders(),
      })
    )
  );

  responses.forEach((res) => handleUnauthorized(res.status));

  const [gst, bank, brand, numbering, milestonesRaw] = await Promise.all(
    responses.map((res) => res.json())
  );

  return {
    gst,
    bank,
    brand,
    numbering,
    milestones: milestonesRaw.results ?? milestonesRaw,
  };
}

// ─── Generic: Koi bhi settings endpoint save karo ────────────────────────────

export async function saveSettings(endpoint: string, data: Record<string, any>): Promise<void> {
  const response = await fetch(`${SETTINGS_URL}/${endpoint}/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  handleUnauthorized(response.status);
  if (!response.ok) throw new Error(`Failed to save ${endpoint} settings`);
}
