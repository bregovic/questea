import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import layoutStyles from "./layout.module.css";
import { TaskList } from "@/components/TaskList/TaskList";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <>
      <header className={layoutStyles.pageHeader}>
        <h1 className={layoutStyles.pageTitle}>Moje Úkoly</h1>
        <p className={layoutStyles.pageSubtitle}>
          Vítej zpět, <strong>{session.user?.name || session.user?.email || "cestovateli"}</strong>! Dnes máš skvělý den na plnění cílů.
        </p>
      </header>
      
      <TaskList />
    </>
  );
}
