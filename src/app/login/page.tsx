"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import styles from "./login.module.css";
// import { useSearchParams } from "next/navigation"; 

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (res?.error) {
        setStatus("error");
        setErrorMessage("Neplatné heslo nebo email.");
      } else if (res?.ok) {
        setStatus("success");
        window.location.href = "/dashboard";
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage("Nepodařilo se připojit k serveru.");
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <h1 className={styles.title}>Přihlášení</h1>
        <p className={styles.subtitle}>Vítejte zpět v Questea</p>

        {status === "error" && (
          <div className={styles.error}>{errorMessage}</div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>Emailová adresa</label>
            <input
              id="email"
              type="email"
              required
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "loading"}
              autoComplete="email"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Heslo</label>
            <input
              id="password"
              type="password"
              required
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === "loading"}
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitBtn}
            disabled={status === "loading" || !email || !password}
          >
            {status === "loading" ? "Přihlašuji..." : "Přihlásit se"}
          </button>
        </form>
        
        <div className={styles.registerLink}>
          Nemáte účet? <Link href="/register" className={styles.link}>Vytvořit</Link>
        </div>
      </div>
    </div>
  );
}
