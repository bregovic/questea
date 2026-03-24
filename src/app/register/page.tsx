"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import styles from "../login/login.module.css";
import Link from "next/link";

export default function RegisterPage() {
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Něco se pokazilo, zkuste to prosím znovu.");
      } else {
        // Automatically sign in after registration
        const signInRes = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (signInRes?.ok) {
          window.location.href = "/dashboard";
        } else {
          setStatus("success");
        }
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
        <h1 className={styles.title}>Vytvořit účet</h1>
        <p className={styles.subtitle}>Získejte kontrolu nad svým dnem i projekty</p>

        {status === "success" && (
          <div className={styles.message}>
            <strong>🪄 Účet úspěšně vytvořen!</strong>
            <br />
            Můžete se přihlásit.
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
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            <button 
              type="submit" 
              className={styles.submitBtn}
              disabled={status === "loading" || !email || !password}
            >
              {status === "loading" ? "Zpracovávám..." : "Vytvořit účet s heslem"}
            </button>
          </form>
        )}

        <p className={styles.divider} style={{ marginTop: '2rem' }}>
          Už máte účet? <Link href="/login" style={{ color: 'var(--accent-primary)', marginLeft: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>Přihlaste se</Link>
        </p>
      </div>
    </div>
  );
}
