export type Language = "en" | "de" | "it" | "fr"

export const DEFAULT_LANGUAGE: Language = "en"
export const LANGUAGE_COOKIE_NAME = "cashtrack_language"
export const LANGUAGE_STORAGE_KEY = "cashtrack.language"

export const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "fr", label: "Français" },
]

const translations: Record<Language, Record<string, string>> = {
  en: {
    // English uses source strings as-is.
  },
  de: {
    "Language": "Sprache",
    "Toggle Menu": "Menü umschalten",
    "Signed in as": "Angemeldet als",
    "Logout": "Abmelden",
    "Toggle theme": "Design umschalten",
    "Light": "Hell",
    "Dark": "Dunkel",
    "System": "System",
    "Dashboard": "Übersicht",
    "Transactions": "Transaktionen",
    "Categories": "Kategorien",
    "Reports": "Berichte",
    "Settings": "Einstellungen",
    "Add Transaction": "Transaktion hinzufügen",
    "Overview of your finances": "Überblick über Ihre Finanzen",
    "No previous month data": "Keine Daten zum Vormonat",
    "{{sign}}{{value}}% from last month": "{{sign}}{{value}} % gegenüber dem Vormonat",
    "Set category budgets to track progress": "Legen Sie Kategorienbudgets fest, um Ihren Fortschritt zu verfolgen",
    "Spent {{percent}}% of monthly budget": "{{percent}} % des Monatsbudgets ausgegeben",
    "Budget Warning": "Budgetwarnung",
    "On Track": "Im Plan",
    "You're at {{usage}}% of your {{category}} budget this month. Plan upcoming purchases carefully.":
      "Sie haben diesen Monat {{usage}} % Ihres Budgets für {{category}} erreicht. Planen Sie kommende Ausgaben sorgfältig.",
    "All categories are within budget so far this month. Keep up the great work!":
      "Alle Kategorien liegen bisher in diesem Monat im Budget. Weiter so!",
    "Total Balance": "Gesamtsaldo",
    "Net {{amount}} this month": "Netto {{amount}} in diesem Monat",
    "Monthly Income": "Monatliche Einnahmen",
    "Monthly Expenses": "Monatliche Ausgaben",
    "Budget Remaining": "Verbleibendes Budget",
    "Spending Trend": "Ausgabentrend",
    "Income vs expenses over the last {{months}} months": "Einnahmen vs. Ausgaben der letzten {{months}} Monate",
    "Spending by Category": "Ausgaben nach Kategorie",
    "Current month breakdown": "Aufschlüsselung des aktuellen Monats",
    "Recent Transactions": "Letzte Transaktionen",
    "Your latest financial activity": "Ihre neuesten Finanzaktivitäten",
    "Add your first transaction to see it here.": "Fügen Sie Ihre erste Transaktion hinzu, um sie hier zu sehen.",
    "Budget Overview": "Budgetübersicht",
    "Monthly spending by category": "Monatliche Ausgaben nach Kategorie",
    "Set category budgets to monitor your progress throughout the month.":
      "Legen Sie Kategorienbudgets fest, um Ihren Fortschritt im Laufe des Monats zu verfolgen.",
    "{{value}}% of budget used": "{{value}} % des Budgets verbraucht",
    "No budget set": "Kein Budget festgelegt",
    "Add transactions to see your income and expense trends.":
      "Fügen Sie Transaktionen hinzu, um Ihre Einnahmen- und Ausgabentrends zu sehen.",
    "Income:": "Einnahmen:",
    "Expenses:": "Ausgaben:",
    "Add categorized expenses to see your spending breakdown.":
      "Fügen Sie kategorisierte Ausgaben hinzu, um Ihre Ausgabenaufteilung zu sehen.",
    "Add transactions to compare income and expenses.":
      "Fügen Sie Transaktionen hinzu, um Einnahmen und Ausgaben zu vergleichen.",
    "Net:": "Netto:",
    "Year-over-year comparison becomes available once you have at least two years of spending data.":
      "Der Jahresvergleich ist verfügbar, sobald mindestens zwei Jahre an Ausgabendaten vorliegen.",
    "Income": "Einnahmen",
    "Expenses": "Ausgaben",
    "Current": "Aktuell",
    "Previous": "Vorjahr",
    "Select categories to generate a spending trend.":
      "Wählen Sie Kategorien aus, um einen Ausgabentrend zu erstellen.",
    "Not enough data to build a category trend yet.":
      "Noch nicht genügend Daten, um einen Kategorietrend zu erstellen.",
    "Failed to load categories": "Kategorien konnten nicht geladen werden",
    "Unable to load categories": "Kategorien konnten nicht geladen werden",
    "Failed to load transactions": "Transaktionen konnten nicht geladen werden",
    "Unable to load transactions": "Transaktionen konnten nicht geladen werden",
    "Delete this transaction?": "Diese Transaktion löschen?",
    "Unable to delete transaction": "Transaktion konnte nicht gelöscht werden",
    "Transaction deleted": "Transaktion gelöscht",
    "Delete failed": "Löschen fehlgeschlagen",
    "{{count}} transactions imported": "{{count}} Transaktionen importiert",
    "No new transactions imported": "Keine neuen Transaktionen importiert",
    "Loading transactions...": "Transaktionen werden geladen...",
    "No transactions found. Try adjusting your filters.":
      "Keine Transaktionen gefunden. Passen Sie Ihre Filter an.",
    "Manage and track your financial transactions":
      "Verwalten und verfolgen Sie Ihre Finanztransaktionen",
    "Import CSV": "CSV importieren",
    "Filter Transactions": "Transaktionen filtern",
    "Search and filter your transactions": "Transaktionen durchsuchen und filtern",
    "Search transactions...": "Transaktionen suchen...",
    "All Categories": "Alle Kategorien",
    "Uncategorized": "Ohne Kategorie",
    "All Transactions": "Alle Transaktionen",
    "Showing {{visible}} of {{total}} transactions · Income: {{income}} · Expenses: {{expenses}}":
      "{{visible}} von {{total}} Transaktionen · Einnahmen: {{income}} · Ausgaben: {{expenses}}",
    "Date": "Datum",
    "Description": "Beschreibung",
    "Category": "Kategorie",
    "Account": "Konto",
    "Amount": "Betrag",
    "Status": "Status",
    "Actions": "Aktionen",
    "Pending": "Ausstehend",
    "Cleared": "Ausgeglichen",
    "Completed": "Abgeschlossen",
    "Transaction added": "Transaktion hinzugefügt",
    "Transaction updated": "Transaktion aktualisiert",
    "Unable to create transaction": "Transaktion konnte nicht erstellt werden",
    "Unable to update transaction": "Transaktion konnte nicht aktualisiert werden",
    "Amount must be a number": "Betrag muss eine Zahl sein",
    "Categories & Rules": "Kategorien & Regeln",
    "Manage spending categories and automation rules":
      "Verwalten Sie Ausgabenkategorien und Automatisierungsregeln",
    "Add Rule": "Regel hinzufügen",
    "Add Category": "Kategorie hinzufügen",
    "Automation Rules": "Automatisierungsregeln",
    "Manage your CashTrack household preferences":
      "Verwalten Sie Ihre CashTrack-Haushaltseinstellungen",
    "Loading settings…": "Einstellungen werden geladen…",
    "Unable to load settings. Please refresh.":
      "Einstellungen konnten nicht geladen werden. Bitte aktualisieren.",
    "Manage household access, backups, and LAN sync for CashTrack":
      "Verwalten Sie Haushaltszugriff, Backups und LAN-Synchronisierung für CashTrack",
  },
  it: {
    "Language": "Lingua",
    "Toggle Menu": "Apri/chiudi menu",
    "Signed in as": "Connesso come",
    "Logout": "Disconnetti",
    "Toggle theme": "Cambia tema",
    "Light": "Chiaro",
    "Dark": "Scuro",
    "System": "Sistema",
    "Dashboard": "Dashboard",
    "Transactions": "Transazioni",
    "Categories": "Categorie",
    "Reports": "Report",
    "Settings": "Impostazioni",
    "Add Transaction": "Aggiungi transazione",
    "Overview of your finances": "Panoramica delle tue finanze",
    "No previous month data": "Nessun dato per il mese precedente",
    "{{sign}}{{value}}% from last month": "{{sign}}{{value}} % rispetto al mese scorso",
    "Set category budgets to track progress": "Imposta budget per categoria per monitorare i progressi",
    "Spent {{percent}}% of monthly budget": "Speso il {{percent}} % del budget mensile",
    "Budget Warning": "Avviso budget",
    "On Track": "In linea",
    "You're at {{usage}}% of your {{category}} budget this month. Plan upcoming purchases carefully.":
      "Hai raggiunto il {{usage}} % del budget {{category}} questo mese. Pianifica con attenzione i prossimi acquisti.",
    "All categories are within budget so far this month. Keep up the great work!":
      "Tutte le categorie sono entro il budget per questo mese. Continua così!",
    "Total Balance": "Saldo totale",
    "Net {{amount}} this month": "Saldo netto {{amount}} questo mese",
    "Monthly Income": "Entrate mensili",
    "Monthly Expenses": "Spese mensili",
    "Budget Remaining": "Budget rimanente",
    "Spending Trend": "Andamento delle spese",
    "Income vs expenses over the last {{months}} months": "Entrate vs spese negli ultimi {{months}} mesi",
    "Spending by Category": "Spese per categoria",
    "Current month breakdown": "Dettaglio del mese corrente",
    "Recent Transactions": "Transazioni recenti",
    "Your latest financial activity": "Le tue attività finanziarie più recenti",
    "Add your first transaction to see it here.": "Aggiungi la tua prima transazione per vederla qui.",
    "Budget Overview": "Panoramica budget",
    "Monthly spending by category": "Spese mensili per categoria",
    "Set category budgets to monitor your progress throughout the month.":
      "Imposta budget per categoria per monitorare i progressi durante il mese.",
    "{{value}}% of budget used": "{{value}} % del budget utilizzato",
    "No budget set": "Nessun budget impostato",
    "Add transactions to see your income and expense trends.":
      "Aggiungi transazioni per vedere l'andamento di entrate e spese.",
    "Income:": "Entrate:",
    "Expenses:": "Spese:",
    "Add categorized expenses to see your spending breakdown.":
      "Aggiungi spese categorizzate per vedere la ripartizione delle spese.",
    "Add transactions to compare income and expenses.":
      "Aggiungi transazioni per confrontare entrate e spese.",
    "Net:": "Saldo:",
    "Year-over-year comparison becomes available once you have at least two years of spending data.":
      "Il confronto annuale sarà disponibile quando avrai almeno due anni di dati sulle spese.",
    "Income": "Entrate",
    "Expenses": "Spese",
    "Current": "Anno corrente",
    "Previous": "Anno precedente",
    "Select categories to generate a spending trend.":
      "Seleziona categorie per generare un andamento delle spese.",
    "Not enough data to build a category trend yet.":
      "Non ci sono ancora dati sufficienti per creare un andamento per categoria.",
    "Failed to load categories": "Impossibile caricare le categorie",
    "Unable to load categories": "Impossibile caricare le categorie",
    "Failed to load transactions": "Impossibile caricare le transazioni",
    "Unable to load transactions": "Impossibile caricare le transazioni",
    "Delete this transaction?": "Eliminare questa transazione?",
    "Unable to delete transaction": "Impossibile eliminare la transazione",
    "Transaction deleted": "Transazione eliminata",
    "Delete failed": "Eliminazione non riuscita",
    "{{count}} transactions imported": "{{count}} transazioni importate",
    "No new transactions imported": "Nessuna nuova transazione importata",
    "Loading transactions...": "Caricamento delle transazioni...",
    "No transactions found. Try adjusting your filters.":
      "Nessuna transazione trovata. Prova a modificare i filtri.",
    "Manage and track your financial transactions":
      "Gestisci e monitora le tue transazioni finanziarie",
    "Import CSV": "Importa CSV",
    "Filter Transactions": "Filtra transazioni",
    "Search and filter your transactions": "Cerca e filtra le tue transazioni",
    "Search transactions...": "Cerca transazioni...",
    "All Categories": "Tutte le categorie",
    "Uncategorized": "Senza categoria",
    "All Transactions": "Tutte le transazioni",
    "Showing {{visible}} of {{total}} transactions · Income: {{income}} · Expenses: {{expenses}}":
      "Mostrando {{visible}} di {{total}} transazioni · Entrate: {{income}} · Spese: {{expenses}}",
    "Date": "Data",
    "Description": "Descrizione",
    "Category": "Categoria",
    "Account": "Conto",
    "Amount": "Importo",
    "Status": "Stato",
    "Actions": "Azioni",
    "Pending": "In sospeso",
    "Cleared": "Registrata",
    "Completed": "Completata",
    "Transaction added": "Transazione aggiunta",
    "Transaction updated": "Transazione aggiornata",
    "Unable to create transaction": "Impossibile creare la transazione",
    "Unable to update transaction": "Impossibile aggiornare la transazione",
    "Amount must be a number": "L'importo deve essere un numero",
    "Categories & Rules": "Categorie e regole",
    "Manage spending categories and automation rules":
      "Gestisci le categorie di spesa e le regole automatiche",
    "Add Rule": "Aggiungi regola",
    "Add Category": "Aggiungi categoria",
    "Automation Rules": "Regole automatiche",
    "Manage your CashTrack household preferences":
      "Gestisci le preferenze della famiglia su CashTrack",
    "Loading settings…": "Caricamento delle impostazioni…",
    "Unable to load settings. Please refresh.":
      "Impossibile caricare le impostazioni. Aggiorna la pagina.",
    "Manage household access, backups, and LAN sync for CashTrack":
      "Gestisci accesso familiare, backup e sincronizzazione LAN per CashTrack",
  },
  fr: {
    "Language": "Langue",
    "Toggle Menu": "Afficher/masquer le menu",
    "Signed in as": "Connecté en tant que",
    "Logout": "Se déconnecter",
    "Toggle theme": "Changer de thème",
    "Light": "Clair",
    "Dark": "Sombre",
    "System": "Système",
    "Dashboard": "Tableau de bord",
    "Transactions": "Transactions",
    "Categories": "Catégories",
    "Reports": "Rapports",
    "Settings": "Paramètres",
    "Add Transaction": "Ajouter une transaction",
    "Overview of your finances": "Vue d'ensemble de vos finances",
    "No previous month data": "Aucune donnée pour le mois précédent",
    "{{sign}}{{value}}% from last month": "{{sign}}{{value}} % par rapport au mois dernier",
    "Set category budgets to track progress": "Définissez des budgets par catégorie pour suivre vos progrès",
    "Spent {{percent}}% of monthly budget": "{{percent}} % du budget mensuel dépensé",
    "Budget Warning": "Alerte budget",
    "On Track": "Dans les temps",
    "You're at {{usage}}% of your {{category}} budget this month. Plan upcoming purchases carefully.":
      "Vous avez atteint {{usage}} % de votre budget {{category}} ce mois-ci. Planifiez soigneusement vos prochains achats.",
    "All categories are within budget so far this month. Keep up the great work!":
      "Toutes les catégories respectent le budget pour l'instant ce mois-ci. Continuez ainsi !",
    "Total Balance": "Solde total",
    "Net {{amount}} this month": "Solde net de {{amount}} ce mois-ci",
    "Monthly Income": "Revenus mensuels",
    "Monthly Expenses": "Dépenses mensuelles",
    "Budget Remaining": "Budget restant",
    "Spending Trend": "Tendance des dépenses",
    "Income vs expenses over the last {{months}} months": "Revenus vs dépenses sur les {{months}} derniers mois",
    "Spending by Category": "Dépenses par catégorie",
    "Current month breakdown": "Répartition du mois en cours",
    "Recent Transactions": "Transactions récentes",
    "Your latest financial activity": "Vos dernières activités financières",
    "Add your first transaction to see it here.": "Ajoutez votre première transaction pour la voir ici.",
    "Budget Overview": "Aperçu du budget",
    "Monthly spending by category": "Dépenses mensuelles par catégorie",
    "Set category budgets to monitor your progress throughout the month.":
      "Définissez des budgets par catégorie pour suivre vos progrès pendant le mois.",
    "{{value}}% of budget used": "{{value}} % du budget utilisé",
    "No budget set": "Aucun budget défini",
    "Add transactions to see your income and expense trends.":
      "Ajoutez des transactions pour voir vos tendances de revenus et dépenses.",
    "Income:": "Revenus :",
    "Expenses:": "Dépenses :",
    "Add categorized expenses to see your spending breakdown.":
      "Ajoutez des dépenses catégorisées pour voir la répartition de vos dépenses.",
    "Add transactions to compare income and expenses.":
      "Ajoutez des transactions pour comparer revenus et dépenses.",
    "Net:": "Net :",
    "Year-over-year comparison becomes available once you have at least two years of spending data.":
      "La comparaison annuelle est disponible une fois que vous disposez d'au moins deux ans de données de dépenses.",
    "Income": "Revenus",
    "Expenses": "Dépenses",
    "Current": "Année en cours",
    "Previous": "Année précédente",
    "Select categories to generate a spending trend.":
      "Sélectionnez des catégories pour générer une tendance des dépenses.",
    "Not enough data to build a category trend yet.":
      "Pas encore assez de données pour établir une tendance par catégorie.",
    "Failed to load categories": "Impossible de charger les catégories",
    "Unable to load categories": "Impossible de charger les catégories",
    "Failed to load transactions": "Impossible de charger les transactions",
    "Unable to load transactions": "Impossible de charger les transactions",
    "Delete this transaction?": "Supprimer cette transaction ?",
    "Unable to delete transaction": "Impossible de supprimer la transaction",
    "Transaction deleted": "Transaction supprimée",
    "Delete failed": "Échec de la suppression",
    "{{count}} transactions imported": "{{count}} transactions importées",
    "No new transactions imported": "Aucune nouvelle transaction importée",
    "Loading transactions...": "Chargement des transactions...",
    "No transactions found. Try adjusting your filters.":
      "Aucune transaction trouvée. Essayez d'ajuster vos filtres.",
    "Manage and track your financial transactions":
      "Gérez et suivez vos transactions financières",
    "Import CSV": "Importer un CSV",
    "Filter Transactions": "Filtrer les transactions",
    "Search and filter your transactions": "Recherchez et filtrez vos transactions",
    "Search transactions...": "Rechercher des transactions...",
    "All Categories": "Toutes les catégories",
    "Uncategorized": "Sans catégorie",
    "All Transactions": "Toutes les transactions",
    "Showing {{visible}} of {{total}} transactions · Income: {{income}} · Expenses: {{expenses}}":
      "Affichage de {{visible}} sur {{total}} transactions · Revenus : {{income}} · Dépenses : {{expenses}}",
    "Date": "Date",
    "Description": "Description",
    "Category": "Catégorie",
    "Account": "Compte",
    "Amount": "Montant",
    "Status": "Statut",
    "Actions": "Actions",
    "Pending": "En attente",
    "Cleared": "Pointée",
    "Completed": "Terminée",
    "Transaction added": "Transaction ajoutée",
    "Transaction updated": "Transaction mise à jour",
    "Unable to create transaction": "Impossible de créer la transaction",
    "Unable to update transaction": "Impossible de mettre à jour la transaction",
    "Amount must be a number": "Le montant doit être un nombre",
    "Categories & Rules": "Catégories et règles",
    "Manage spending categories and automation rules":
      "Gérez les catégories de dépenses et les règles d'automatisation",
    "Add Rule": "Ajouter une règle",
    "Add Category": "Ajouter une catégorie",
    "Automation Rules": "Règles d'automatisation",
    "Manage your CashTrack household preferences":
      "Gérez les préférences de votre foyer dans CashTrack",
    "Loading settings…": "Chargement des paramètres…",
    "Unable to load settings. Please refresh.":
      "Impossible de charger les paramètres. Veuillez actualiser.",
    "Manage household access, backups, and LAN sync for CashTrack":
      "Gérez l'accès du foyer, les sauvegardes et la synchronisation LAN pour CashTrack",
  },
}

export interface TranslateOptions {
  fallback?: string
  values?: Record<string, string | number>
}

function formatTemplate(template: string, values?: Record<string, string | number>): string {
  if (!values) {
    return template
  }
  return template.replace(/\{\{(.*?)\}\}/g, (match, token) => {
    const key = token.trim()
    const value = values[key]
    if (value === undefined || value === null) {
      return match
    }
    return String(value)
  })
}

export function translate(language: Language, key: string, options: TranslateOptions = {}): string {
  const dictionary = translations[language] ?? translations.en
  const fallback = options.fallback ?? key
  const template = dictionary[key] ?? translations.en[key] ?? fallback
  return formatTemplate(template, options.values)
}

export function isSupportedLanguage(value: string | undefined): value is Language {
  return value === "en" || value === "de" || value === "it" || value === "fr"
}

export function matchSupportedLanguage(input: string | undefined): Language {
  if (isSupportedLanguage(input)) {
    return input
  }
  return DEFAULT_LANGUAGE
}
