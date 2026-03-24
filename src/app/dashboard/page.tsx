import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import layoutStyles from "./layout.module.css";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <>
      <header className={layoutStyles.pageHeader}>
        <h1 className={layoutStyles.pageTitle}>Dashboard</h1>
        <p className={layoutStyles.pageSubtitle}>
          Vítej zpět, <strong>{session.user?.name || session.user?.email || "cestovateli"}</strong>!
        </p>
      </header>
      
      <div className={styles.card}>
        <h2 className={styles.cardHeader}>Tvoje úkoly</h2>
        <p className={styles.cardBody}>
          Zde brzy uvidíme seznam tvých úkolek ke splnění s možností je rychle oddělit (swipe) jako přes Tinder. Brzy přidáme i integraci na číselníky!
        </p>
      </div>
    </>
  );
}
