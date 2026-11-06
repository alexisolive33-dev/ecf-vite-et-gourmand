# Vite & Gourmand — Traiteur Événementiel

Application web de devis et gestion de commandes pour traiteur événementiel (Julie & José, Bordeaux).
Projet réalisé dans le cadre de l'**ECF Développeur Web et Web Mobile** (Niveau 5) par **Alexis OLIVE**.

---

## Démarrage rapide

### Prérequis
* Docker & Docker Compose installés.
* Ports libres : `8000` (Apache/PHP), `8080` (phpMyAdmin), `3306` (MariaDB), `27017` (MongoDB).

### Lancement du projet
```bash
docker compose up -d
```

### Accès
* **Site client :** http://localhost:8000
* **Back-Office :** http://localhost:8000/login.html
* **phpMyAdmin :** http://localhost:8080

### Identifiants Administrateur
* **Email :** `jose@vitegourmand.fr`
* **Mot de passe :** `Admin2026!`

---

## Stack technique

* **Back-End :** PHP 8.2 natif (architecture MVC / Services, sans framework lourd).
* **Front-End :** HTML5 sémantique, CSS3 (variables CSS, respect des contrastes WCAG AA), JavaScript Vanilla (Fetch API asynchrone).
* **Bases de données :** MariaDB 11.4 + MongoDB 7.0.
* **Tests :** PHPUnit 11.5.
* **Environnement :** Docker Compose (4 services conteneurisés).

---

## Architecture de données : Approche polyglotte

Le projet sépare les données transactionnelles critiques des données analytiques de consultation :

| Besoin | Base choisie | Justification technique |
| :---   | :---         | :---                    |
| **Commandes, menus, stocks** | **MariaDB (SQL)** | Transactions ACID obligatoires. Verrouillage pessimiste (`SELECT ... FOR UPDATE`) sur les stocks pour empêcher tout surbooking lors des réservations simultanées. Mots de passe hachés en `bcrypt`. |
| **Télémétrie et popularité** | **MongoDB (NoSQL)** | Débit d'écriture rapide sans impact sur la base SQL. Stockage orienté documents des consultations de menus avec calcul de popularité via pipeline d'agrégation (`$group`, `$sort`). |

---

## Règles métier implémentées

* **Préavis minimum de 7 jours :** Toute commande passée à moins de 7 jours de l'événement est rejetée.
* **Barème de livraison :**
  * Gratuit (0 €) dans Bordeaux intra-muros (0 km).
  * Hors Bordeaux métropole : 5,00 € forfaitaires + 0,59 € / km.
* **Remise de groupe (-10 %) :** Appliquée automatiquement si le nombre de convives est supérieur ou égal au minimum du menu + 5 personnes.
* **Affichage des allergènes :** Intégration des 14 allergènes obligatoires (Directive européenne INCO).
* **Droit de rétractation :** Exclusion légale explicite (art. L. 221-28 4° du Code de la Consommation) liée à la nature périssable des denrées préparées à la commande.

---

## Tests unitaires

Les règles de calcul (préavis, barème kilométrique, seuils de remise) sont testées avec PHPUnit.

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