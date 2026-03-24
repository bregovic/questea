import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      {/* Decorative Orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      
      <div className={styles.contentWrapper}>
        <section className={styles.heroSection}>
          <div className={styles.badge}>✨ Nová éra produktivity</div>
          <h1 className={styles.title}>
            Questea <br/> <span className={styles.highlight}>Reimagined.</span>
          </h1>
          <p className={styles.subtitle}>
            Zahoďte nudné to-do listy. Questea je váš dynamický prostor pro 
            úkoly, myšlenky a projekty, obohacený o moderní řízení s kalendářem, 
            hlasovými úkoly a přehledným swipováním.
          </p>
        </section>

        <section className={styles.actionSection}>
          <div className={styles.glassCard}>
            <div className={styles.logoWrapper}>
              <Image 
                src="/logo.png" 
                alt="Questea Logo" 
                width={70} 
                height={70} 
                priority
                className={styles.logo} 
              />
            </div>
            
            <h2 className={styles.cardHeader}>Vítejte zpět</h2>
            <p className={styles.cardSub}>Pokračujte přesně tam, kde jste skončili.</p>

            <div className={styles.links}>
              <Link href="/login" className={styles.primaryLink}>
                <span className={styles.iconBox}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                </span>
                <span className={styles.linkText}>
                  <strong>Přihlásit se</strong>
                  <small>Mám již vytvořený účet</small>
                </span>
                <span className={styles.arrow}>→</span>
              </Link>

              <Link href="/register" className={styles.secondaryLink}>
                <span className={styles.iconBox}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                </span>
                <span className={styles.linkText}>
                  <strong>Vytvořit účet</strong>
                  <small>Začít zcela zdarma</small>
                </span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
