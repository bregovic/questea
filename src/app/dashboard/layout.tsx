"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import styles from "./layout.module.css";
import React from "react";

import { ChevronLeft, ChevronRight, CheckCircle, List, Settings, LogOut, Plus } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = React.useState(true); // Default to collapsed
  const [isZenMode, setIsZenMode] = React.useState(false);

  React.useEffect(() => {
    const handleZenEvent = (e: any) => setIsZenMode(e.detail);
    window.addEventListener("toggleZen", handleZenEvent as any);
    return () => window.removeEventListener("toggleZen", handleZenEvent as any);
  }, []);

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  const handleAddTask = () => {
    window.dispatchEvent(new CustomEvent("addTask"));
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Sidebar */}
      {!isZenMode && (
        <nav className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={styles.toggleBtn}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          
          <button 
            onClick={handleAddTask}
            className={styles.sidebarAddBtn}
            title="Nový úkol"
          >
            <Plus size={20} />
            <span>Nový úkol</span>
          </button>

          <div className={styles.brand}>
            <div className={styles.brandIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="currentColor" fillOpacity="0.2"/>
                <path d="M11.5 17V7M11.5 7L7 11.5M11.5 7L16 11.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className={styles.brandText}>Questea</span>
          </div>

          <div className={styles.nav}>
            <Link href="/dashboard" className={`${styles.navItem} ${pathname === "/dashboard" ? styles.active : ""}`}>
              <CheckCircle className={styles.navIcon} />
              <span>Úkoly</span>
            </Link>

            <Link href="/dashboard/codelists" className={`${styles.navItem} ${pathname?.includes("/codelists") ? styles.active : ""}`}>
              <List className={styles.navIcon} />
              <span>Číselníky</span>
            </Link>

            <Link href="/dashboard/settings" className={`${styles.navItem} ${pathname?.includes("/settings") ? styles.active : ""}`}>
              <Settings className={styles.navIcon} />
              <span>Nastavení</span>
            </Link>
          </div>

          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{session?.user?.name || session?.user?.email || "Uživatel"}</span>
            </div>

            <button onClick={handleLogout} className={styles.logoutBtn}>
              <LogOut className={styles.navIcon} />
              <span>Odhlásit se</span>
            </button>
          </div>
        </nav>
      )}

      <main className={`${styles.mainContent} ${isZenMode ? styles.zenMain : (isCollapsed ? styles.collapsed : "")}`}>
        {children}
      </main>
    </div>
  );
}
