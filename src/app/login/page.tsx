"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import styles from "./login.module.css";
// import { useSearchParams } from "next/navigation"; 

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (res?.error) {
        setStatus("error");
        setErrorMessage("Něco se pokazilo, zkuste to prosím znovu.");
      } else {
        setStatus("success");
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
      <div className={`${styles.loginCard} glass-panel`}>
        <h1 className={styles.title}>Vítejte zpět</h1>
        <p className={styles.subtitle}>Přihlaste se do Questea pro správu svých úkolů a projektů</p>

        {status === "success" && (
          <div className={styles.message}>
            <strong>🪄 Odkaz byl odeslán!</strong>
            <br />
            Zkontrolujte si email ({email}) pro magický přihlašovací odkaz.
          </div>
        )}

        {status === "error" && (
          <div className={styles.error}>{errorMessage}</div>
        )}

        {status !== "success" && (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>Emailová adresa</label>
              <input
                id="email"
                type="email"
                required
                className={styles.input}
                placeholder="vy@email.cz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "loading"}
                autoComplete="email"
              />
            </div>
            <button 
              type="submit" 
              className={styles.submitBtn}
              disabled={status === "loading" || !email}
            >
              {status === "loading" ? "Odesílám..." : "Přihlásit se přes Email"}
            </button>
          </form>
        )}

        <div className={styles.divider}>nebo</div>

        <button 
          onClick={handleGoogleSignIn}
          className={styles.googleBtn}
          type="button"
        >
          {/* Jednoduchá Google ikona (SVG) */}
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Pokračovat přes Google
        </button>
      </div>
    </div>
  );
}
