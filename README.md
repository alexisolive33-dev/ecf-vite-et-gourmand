# Vite & Gourmand — Traiteur Événementiel

Application web de devis en ligne et de gestion de commandes pour traiteur événementiel (**Julie & José**, Bordeaux — 25 ans d'expérience).  
Projet réalisé dans le cadre de l'**ECF Développeur Web et Web Mobile** (Niveau 5) par **Alexis OLIVE**.

---

## Accès & Comptes de démonstration

### Environnement en ligne (Cloud)
- **Application & API :** `https://<votre-url-render>.onrender.com` *(remplacer par votre URL Render exacte)*
- **Connexion / Back-Office :** `https://<votre-url-render>.onrender.com/login.html`

### Comptes de test (Jeu d'essai officiel)

| Rôle | Utilisateur | Adresse e-mail | Mot de passe | Accès |
| :--- | :--- | :--- | :--- | :--- |
| **Administrateur** | José Gourmand | `jose@vitegourmand.fr` | `Password123!` | Back-office complet (commandes, avis, messages, stats NoSQL) |
| **Administrateur** | Julie Gourmand | `julie@vitegourmand.fr` | `Password123!` | Back-office complet |
| **Employé** | Thomas Lemoine | `thomas.livraison@vitegourmand.fr` | `Password123!` | Suivi des commandes, modération des avis et messages |
| **Client** | Mathieu Dubois | `mathieu.dubois@email.fr` | `Password123!` | Espace personnel, commandes, dépôt d'avis vérifiés |

---

## Démarrage rapide en local (Docker)

### Prérequis
- Docker & Docker Compose installés.
- Ports libres : `8000` (Apache/PHP), `8080` (phpMyAdmin), `3306` (MariaDB), `27017` (MongoDB).

### Lancement du projet
```bash
docker compose up -d
```

### Accès locaux
- **Site client :** http://localhost:8000
- **Connexion / Back-Office :** http://localhost:8000/login.html
- **phpMyAdmin :** http://localhost:8080

---

## Stack technique

- **Back-End :** PHP 8.2 natif (architecture MVC / Services, API REST JSON, sans framework lourd).
- **Front-End :** HTML5 sémantique, CSS3 (variables CSS, responsive mobile/desktop, contrastes RGAA / WCAG 2.1 AA), JavaScript Vanilla (`Fetch API`).
- **API Externe :** Référentiel géographique national `geo.api.gouv.fr` (auto-complétion des communes par code postal et calcul kilométrique).
- **Bases de données :** MariaDB 11.4 / TiDB Cloud (SQL) + MongoDB 7.0 / MongoDB Atlas (NoSQL).
- **Tests :** PHPUnit 11.5.
- **Déploiement :** Docker Compose (local) & Render + TiDB Cloud + MongoDB Atlas (production).

---

## Architecture de données : Approche polyglotte

Le projet sépare les données transactionnelles critiques des données analytiques de consultation :

| Besoin | Base choisie | Justification technique |
| :--- | :--- | :--- |
| **Commandes, menus, stocks, utilisateurs, avis & messages** | **MariaDB / TiDB (SQL)** | Intégrité référentielle et transactions ACID obligatoires. Verrouillage pessimiste (`SELECT ... FOR UPDATE`) sur les stocks pour empêcher tout surbooking lors des réservations simultanées. Mots de passe hachés en `bcrypt`. |
| **Télémétrie et popularité des formules** | **MongoDB Atlas (NoSQL)** | Débit d'écriture rapide sans impact sur la base SQL. Stockage orienté documents des consultations de fiches menus (`menu_views`) avec calcul de popularité en temps réel via pipeline d'agrégation (`$group`, `$sort`) et tolérance aux pannes. |

---

## Règles métier & Fonctionnalités implémentées

- **Préavis minimum de 7 jours :** Toute commande passée à moins de 7 jours de l'événement est rejetée côté client et côté serveur.
- **Géolocalisation & Barème de livraison :**
  - Sélection dynamique de la commune à partir du code postal (`geo.api.gouv.fr`) à l'inscription et lors de la commande.
  - Gratuit (0 €) dans Bordeaux intra-muros (0 km).
  - Hors Bordeaux métropole : 5,00 € forfaitaires + 0,59 € / km calculés depuis l'atelier (12 Cours de l'Intendance, Bordeaux).
- **Remise de groupe (-10 %) :** Appliquée automatiquement dès que le nombre de convives atteint le minimum du menu + 5 personnes, avec double validation serveur (`OrderCalculatorService`).
- **Allergènes & Conformité légale :** Affichage des 14 allergènes obligatoires (Règlement européen INCO) et exclusion explicite du droit de rétractation (art. L. 221-28 4° du Code de la Consommation) liée aux denrées périssables préparées à la commande.
- **Back-Office complet :** Gestion des statuts de commandes, modération des avis clients avant publication, suivi des demandes de devis issues du formulaire de contact et indicateurs de consultation NoSQL.

---

## Tests unitaires

Les règles de calcul (préavis, barème kilométrique, seuils de remise) sont couvertes par PHPUnit.

Pour exécuter la suite de tests :
```bash
docker compose exec backend vendor/bin/phpunit tests/OrderCalculatorServiceTest.php
```

Résultat attendu :
```text
PHPUnit 11.5.57 by Sebastian Bergmann and contributors.

Runtime:       PHP 8.2.35
.......                                                             7 / 7 (100%)

Time: 00:00.497, Memory: 8.00 MB

OK (7 tests, 21 assertions)
```