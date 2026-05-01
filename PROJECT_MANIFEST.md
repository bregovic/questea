# 🍵 QUEASTEA PROJECT MANIFEST

> **Vize**: Vytvořit ultimátní "Life OS" – inteligentní organizér, který kombinuje správu úkolů, AI asistentku, finance a plánování akcí do jednoho plynulého zážitku.

## 🎯 KLÍČOVÉ CÍLE (Core Mission)
1. **Inbox Zero skrze AI**: Automatické zpracování e-mailů a hlasových poznámek na strukturované úkoly (ChatGPT výcuc).
2. **Hierarchie & Flow**: Podpora komplexních projektů (Sub-úkoly, blokace, progress bary).
3. **Sdílená realita**: SettleUp styl dluhů, Doodle styl plánování a sdílené úkoly bez nutnosti složitého nastavování.
4. **Kontextuální evidence**: Kniha jízd (check-iny), evidence času a zápůjčky na jednom místě.

## 🛠️ TECHNICKÝ STACK (Manifest)
- **Framework**: Next.js (App Router, Turbopack).
- **Databáze**: PostgreSQL + Prisma.
- **Styling**: Tailwind CSS (Rich Aesthetics: Vibrant colors, glassmorphism, dynamic animations).
- **Auth**: NextAuth.js.
- **Logika**: Deklarativní React, čisté serverové akce, typová bezpečnost (TypeScript).

## 📊 DATOVÝ MODEL (High-Level)
- **Task**: Centrální entita. Typy: `TASK`, `BUG`, `IDEA`, `EXPENSE`, `LOCATION_HISTORY`.
- **Hierarchy**: Rekurzivní vazba `parentId` pro nekonečné podúkoly.
- **Actors**: `Owner` (tvůrce), `Delegate` (řešitel), `Guarantor` (ručitel), `Approver` (schvalovatel).
- **Finances**: Integrovaný model `Payee` a pole `amount`/`currency` přímo v úkolech typu EXPENSE.
- **Context**: `LocationCheckIn` (GPS, adresa, fotka, tachometr) a `AliasEmail` (pro AI processing).

## 📜 PRAVIDLA SPOLUPRÁCE
1. **Design First**: Každé UI musí vypadat prémiově. Používáme moderní typografii, plynulé animace a barevné palety, které "vau-nou" uživatele.
2. **Kvalita dat**: Automaticky čistíme vstupy (junk detection) a normalizujeme metadata.
3. **Žádné placeholdery**: Vždy reálné assety nebo AI generované obrázky.
4. **Mobile First**: Vše musí být perfektně ovladatelné palcem na cestách.

## 📍 AKTUÁLNÍ STAV (Status: Initialized)
- [x] Prisma schéma (v2 - komplexní model)
- [x] Next.js inicializace
- [x] Základní pravidla projektu (AGENTS.md)
- [ ] Implementace AI zpracování e-mailů
- [ ] Hlavní dashboard se statistikami
- [ ] Implementace Location Check-inů
