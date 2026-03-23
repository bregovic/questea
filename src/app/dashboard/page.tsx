import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div style={{ padding: '2rem', color: '#e5e1f0', background: '#0f0d1a', minHeight: '100vh', fontFamily: 'Inter' }}>
      <h1>Dashboard</h1>
      <p>Vítej v zabezpečené zóně, {session.user?.email}!</p>
      
      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(124, 58, 237, 0.1)', borderRadius: '12px', border: '1px solid rgba(124, 58, 237, 0.3)' }}>
        <h2>Tvoje úkoly</h2>
        <p style={{ color: '#9ca3af' }}>Zde brzy uvidíme seznam tvých úkolů ke splnění s možností je oddělit jako přes Tinder.</p>
      </div>
    </div>
  );
}
