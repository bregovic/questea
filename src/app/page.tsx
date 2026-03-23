import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container}>
      <div className={styles.logoWrapper}>
        <Image
          src="/logo.png"
          alt="Questea Logo"
          width={120}
          height={120}
          priority
          className={styles.logo}
        />
      </div>
      
      <h1 className={styles.title}>Vítejte v Questea</h1>
      <p className={styles.subtitle}>
        Vaše osobní i pracovní úkoly na jednom místě. Moderní řízení s kalendářem, 
        hlasovými úkoly a přehledným swipováním.
      </p>

      <div className={styles.actionGrid}>
        <Link href="/login" className={`${styles.card} glass-panel`}>
          <span className={styles.cardIcon}>🔐</span>
          <span className={styles.cardTitle}>Přihlásit se</span>
          <span className={styles.cardDesc}>Přístup ke svým existujícím úkolům a projektům</span>
        </Link>
        <Link href="/register" className={`${styles.card} glass-panel`}>
          <span className={styles.cardIcon}>🚀</span>
          <span className={styles.cardTitle}>Začít zdarma</span>
          <span className={styles.cardDesc}>Vytvořte si nový účet během několika sekund</span>
        </Link>
      </div>
    </main>
  );
}
