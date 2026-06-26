"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  FileText,
  Receipt,
  CreditCard,
  History,
  BellRing,
  Layers,
  Settings,
  LogOut,
  Lock,
  Menu,
  X,
  ShieldAlert,
  MessageSquare
} from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import "./../globals.css";

// Nav items with role-based access control
interface NavItem {
  label: string;
  href: string;
  icon: any;
  roles?: string[]; // undefined = all roles can see
  managerOnly?: boolean;
  accountantOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/dashboard/clients", icon: Users, roles: ["owner", "manager", "designer"] },
  { label: "Projects", href: "/dashboard/projects", icon: FolderOpen, roles: ["owner", "manager", "designer"] },
  { label: "Proposals", href: "/dashboard/proposals", icon: FileText, roles: ["owner", "manager", "designer"] },
  { label: "Quotations", href: "/dashboard/quotations", icon: Receipt, roles: ["owner", "manager"] },
  { label: "Invoices", href: "/dashboard/invoices", icon: Receipt, roles: ["owner", "manager", "accountant"] },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: Receipt, roles: ["owner", "manager"] },
  { label: "Payments", href: "/dashboard/payments", icon: CreditCard, roles: ["owner", "manager", "accountant"] },
  { label: "Pending Users", href: "/dashboard/pending-users", icon: ShieldAlert, roles: ["owner", "manager"] },

  { label: "Enquiries", href: "/dashboard/enquiry", icon: MessageSquare },
  { label: "History", href: "/dashboard/history", icon: History },
  { label: "Notifications", href: "/dashboard/notifications", icon: BellRing },
  { label: "Master Services", href: "/dashboard/services", icon: Layers, roles: ["owner", "manager", "designer"] },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [authChecked, setAuthChecked] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Secure Role Verification
  const adminRoles = ["owner", "manager", "accountant"];
  const isAdmin = userRole ? adminRoles.includes(userRole) : false;

  useEffect(() => {
    const token = localStorage.getItem("access") || localStorage.getItem("token");
    if (!token) {
      localStorage.clear(); // Clear any corrupted/stale data
      router.replace("/login");
      return;
    }

    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        
        // Basic sanitization: Ensure role is lowercase and valid string
        const role = typeof user.role === "string" ? user.role.toLowerCase().trim() : "designer";
        
        setUserRole(role);
        setUserName(user.full_name || "User");
      } else {
        setUserRole("designer");
        setUserName("User");
      }
    } catch (error) {
      // If JSON parsing fails, log out to be safe
      localStorage.clear();
      router.replace("/login");
      return;
    }

    setAuthChecked(true);
  }, [router, pathname]); // Added pathname to re-verify token state on page navigation

  // Close sidebar on mobile route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.clear();
    router.replace("/login");
  };

  // 1. Loading State Screen
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAF8F5]">
        <div className="animate-spin w-8 h-8 border-4 border-[#C8922A] border-t-transparent rounded-full" />
      </div>
    );
  }

  // 2. Strict URL Security Check (Pre-render Gate) - Role-based path access
  const checkPathAccess = (): boolean => {
    // Settings: admin only
    if (pathname.includes("/settings")) return isAdmin;
    
    // Quotations, Portfolio, Pending Users: manager/owner only
    if (pathname.includes("/quotations") || pathname.includes("/portfolio") || pathname.includes("/pending-users")) {
      return userRole === "owner" || userRole === "manager";
    }
    
    // Invoices, Payments: admin (manager/owner) or accountant
    if (pathname.includes("/invoices") || pathname.includes("/payments")) {
      return userRole === "owner" || userRole === "manager" || userRole === "accountant";
    }
    
    return true;
  };

  if (!checkPathAccess()) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full text-center bg-[#FAF8F5] p-6">
        <Lock size={50} className="text-[#D04040] mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-[#1C1C1C] mb-2">Access Denied (403)</h2>
        <p className="text-[#6B6259] max-w-sm mb-6">
          You don&apos;t have permission to access this secure zone. Your attempt has been logged.
        </p>
        <button 
          onClick={() => router.replace("/dashboard")} 
          className="px-5 py-2.5 bg-[#C8922A] text-white rounded-lg font-medium text-sm hover:bg-[#b07f22] transition-colors"
        >
          Back to Safe Zone
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FAF8F5] font-sans overflow-hidden relative">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[220px] bg-white border-r border-[#EDE8DF] flex flex-col shrink-0
        transform transition-transform duration-300 ease-in-out
        md:relative md:transform-none
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#EDE8DF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="rounded-lg object-contain" 
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
            />
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 text-[#6B6259] hover:bg-[#FAF8F5] rounded-md md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {navItems.map((item) => {
            // Check if current user role can see this item
            if (item.roles && userRole && !item.roles.includes(userRole)) {
              return null;
            }

            const Icon = item.icon;
            const active = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-[13px] font-medium transition-all ${
                  active
                    ? "bg-[#FDF3E3] text-[#C8922A] font-semibold"
                    : "text-[#6B6259] hover:bg-[#FAF8F5] hover:text-[#1C1C1C]"
                }`}
              >
                <Icon size={16} className={active ? "text-[#C8922A]" : "text-[#9A8F82]"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="px-3 pb-5 border-t border-[#EDE8DF] pt-4 space-y-0.5">
          {isAdmin && (
            <Link
              href="/dashboard/settings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                pathname === "/dashboard/settings" ? "bg-[#FDF3E3] text-[#C8922A]" : "text-[#6B6259] hover:bg-[#FAF8F5]"
              }`}
            >
              <Settings size={16} className="text-[#9A8F82]" />
              Settings
            </Link>
          )}
          
          {userRole === "accountant" && (
            <Link
              href="/dashboard/settings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                pathname === "/dashboard/settings" ? "bg-[#FDF3E3] text-[#C8922A]" : "text-[#6B6259] hover:bg-[#FAF8F5]"
              }`}
            >
              <Settings size={16} className="text-[#9A8F82]" />
              Settings
            </Link>
          )}
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-[#D04040] hover:bg-[#FFF0F0]"
          >
            <LogOut size={16} />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="h-[60px] bg-white border-b border-[#EDE8DF] flex items-center px-4 md:px-6 gap-4 shrink-0 justify-between md:justify-end">
          
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-[#6B6259] hover:bg-[#FAF8F5] rounded-lg md:hidden"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-3 ml-auto">
            <NotificationBell isReady={authChecked} />

            <div className="flex items-center gap-2 px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg bg-[#FAF8F5] border border-[#EDE8DF]">
              <div className="w-7 h-7 rounded-full bg-[#C8922A] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {userName?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex flex-col max-w-[100px] sm:max-w-none overflow-hidden">
                <span className="text-[12px] font-bold text-[#1C1C1C] leading-none truncate">
                  {userName}
                </span>
                <span className="text-[10px] text-[#9A8F82] capitalize truncate">{userRole}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#FAF8F5]">
          {children}
        </main>
      </div>
    </div>
  );
}