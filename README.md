# Vite & Gourmand — Traiteur Événementiel

Application web de devis en ligne et de gestion de commandes pour traiteur événementiel (**Julie & José**, Bordeaux — 25 ans d'expérience).  
Projet réalisé dans le cadre de l'**ECF Développeur Web et Web Mobile** (Niveau 5) par **Alexis OLIVE**.

---

## Accès & Liens du projet

### Environnement en ligne (Cloud)
- **Application & API :** https://vite-gourmand-a0uf.onrender.com/
- **Connexion / Back-Office :** https://vite-gourmand-a0uf.onrender.com/login.html
- **Dépôt GitHub :** https://github.com/alexisolive33-dev/ecf-vite-et-gourmand
- **Gestion de projet (Trello) :** https://trello.com/b/fs0YJgQr/ecf-vite-gourmand-suivi-de-projet
- **Maquettes UI/UX (Figma) :** https://www.figma.com/design/72yLGYmORYYlpJF9mNEuQo/ECF---Vite---Gourmand---Maquettes-UI?node-id=0-1&t=oXEFxgmTBhlp2kld-1

### Comptes de test (Jeu d'essai officiel)

| Rôle | Utilisateur | Adresse e-mail | Mot de passe | Accès |
| :--- | :--- | :--- | :--- | :--- |
| **Administratrice** | Julie Gourmand | `julie@vitegourmand.fr` | `Admin2026!` | Back-office complet (gestion employés, commandes, menus, avis, CA & stats NoSQL) |
| **Administrateur** | José Gourmand | `jose@vitegourmand.fr` | `Admin2026!` | Back-office complet |
| **Employé** | Thomas Lemoine | `thomas.livraison@vitegourmand.fr` | `Employe2026!` | Gestion des menus, plats et horaires, suivi des commandes, modération des avis |
| **Client** | Mathieu Dubois | `mathieu.dubois@email.fr` | `Client2026!` | Espace personnel, commandes, dépôt d'avis vérifiés |
| **Cliente** | Claire Martin | `claire.martin@email.fr` | `Client2026!` | Espace personnel, commandes, dépôt d'avis vérifiés |
| **Client Pro** | Cabinet Aquitaine Conseil | `contact@aquitaine-conseil.fr` | `Client2026!` | Espace professionnel, commandes |

---

## Démarrage rapide en local (Docker)

### Prérequis
- Docker & Docker Compose installés.
- Ports libres : `8000` (Apache/PHP), `8080` (phpMyAdmin), `3306` (MariaDB), `27017` (MongoDB).

### Installation et lancement
```bash
git clone [https://github.com/alexisolive33-dev/ecf-vite-et-gourmand.git](https://github.com/alexisolive33-dev/ecf-vite-et-gourmand.git)
cd ecf-vite-et-gourmand
docker compose up -d --build
```

### Accès locaux
- **Site client :** http://localhost:8000
- **Connexion / Back-Office :** http://localhost:8000/login.html
- **phpMyAdmin :** http://localhost:8080

---

## Stack technique

- **Back-End :** PHP 8.2 natif (architecture MVC / Services, API REST JSON, sans framework lourd).
- **Front-End :** HTML5 sémantique, CSS3 (variables CSS, responsive mobile/desktop, contrastes RGAA / WCAG 2.1 AA), JavaScript Vanilla (`Fetch API`).
- **API Externe :** Référentiel géographique national `geo.api.gouv.fr` (auto-complétion des communes par code postal et calcul kilométrique par formule de Haversine).
- **Bases de données :** MariaDB 11.4 / TiDB Cloud (SQL) + MongoDB 7.0 / MongoDB Atlas (NoSQL).
- **Tests :** PHPUnit 11.5.
- **Déploiement :** Docker Compose (local) & Render + TiDB Cloud + MongoDB Atlas (production).

---

## Architecture de données : Approche polyglotte

Le projet sépare les données transactionnelles critiques des données analytiques :

| Besoin | Base choisie | Justification technique |
| :--- | :--- | :--- |
| **Commandes, historique, menus, stocks, utilisateurs, avis, horaires & messages** | **MariaDB / TiDB (SQL — 12 tables)** | Intégrité référentielle et transactions ACID obligatoires (`beginTransaction` / `commit` / `rollBack`). Verrouillage pessimiste (`SELECT ... FOR UPDATE`) sur les stocks pour empêcher tout surbooking lors des réservations simultanées. Mots de passe hachés en `bcrypt`. |
| **Télémétrie et statistiques de commandes par menu** | **MongoDB Atlas (NoSQL)** | Débit d'écriture rapide sans impact sur la base SQL. Stockage orienté documents (`menu_views`, `menu_orders`) avec calcul en temps réel via pipeline d'agrégation (`$group`, `$sort`) et mécanisme de repli automatique. |

---

## Règles métier, sécurité & fonctionnalités

- **Sécurité applicative :** Authentification par jetons signés `HMAC-SHA256` (`Authorization: Bearer`), contrôle d'accès par rôle (`AuthGuard`), requêtes préparées PDO contre les injections SQL et échappement des sorties contre les failles XSS.
- **Préavis minimum de 7 jours :** Toute commande passée à moins de 7 jours de l'événement est rejetée côté client et côté serveur.
- **Géolocalisation & Barème de livraison :**
  - Sélection dynamique de la commune à partir du code postal (`geo.api.gouv.fr`) à l'inscription et lors de la commande.
  - Gratuit (0 €) dans Bordeaux intra-muros (0 km).
  - Hors Bordeaux métropole : 5,00 € forfaitaires + 0,59 € / km calculés depuis l'atelier (12 Cours de l'Intendance, Bordeaux).
- **Remise de groupe (-10 %) :** Appliquée automatiquement dès que le nombre de convives atteint le minimum du menu + 5 personnes, avec double validation serveur (`OrderCalculatorService`).
- **Formulaire de contact conforme :** Saisie dédiée (`titre`, `description`, `email`), enregistrement en base (`contact_message`) et notification par e-mail à l'entreprise.
- **Allergènes & Conformité légale :** Affichage des 14 allergènes obligatoires (Règlement européen INCO) et exclusion explicite du droit de rétractation (art. L. 221-28 4° du Code de la Consommation).
- **Back-Office complet :** Gestion des statuts de commandes avec historique horodaté (`commande_historique`), modération des avis clients avant publication, suivi des messages de contact et indicateurs analytiques NoSQL.

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

---

## Livrables documentaires (`docs/`)

- `docs/Documentation_Gestion_Projet_OLIVE_Alexis.pdf` — Suivi Agile/Kanban, planning sur 70 h, Git Flow et gestion des risques.
- `docs/Documentation_Technique_OLIVE_Alexis.pdf` — Choix technologiques, environnement Docker, MCD Merise, diagrammes UML (cas d'utilisation & séquence) et déploiement.
- `docs/Charte_Graphique_Maquettes_OLIVE_Alexis.pdf` — Palette RGAA, typographie, 3 maquettes bureautiques et 3 maquettes mobiles Figma.
- `docs/Manuel_Utilisation_OLIVE_Alexis.pdf` — Guide utilisateur complet par profil.