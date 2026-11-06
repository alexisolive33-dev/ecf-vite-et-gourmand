# Dictionnaire de données — Vite & Gourmand

Base relationnelle : MariaDB / MySQL (InnoDB, UTF8mb4)

---

### 1. Table `utilisateur`
Comptes clients, employés et Julie & José (admin).

| Champ | Type SQL | Contraintes | Description / Métier |
| :--- | :--- | :--- | :--- |
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identifiant |
| `nom` | VARCHAR(50) | NOT NULL | Nom |
| `prenom` | VARCHAR(50) | NOT NULL | Prénom |
| `email` | VARCHAR(120) | NOT NULL, UNIQUE | E-mail de connexion |
| `mot_de_passe` | VARCHAR(255) | NOT NULL | Hash (Bcrypt / Argon2) |
| `telephone` | VARCHAR(20) | NOT NULL | Contact livraison |
| `role` | ENUM('client','employe','admin') | NOT NULL, DEFAULT 'client' | Droits d'accès |
| `date_creation` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Date inscription |

---

### 2. Table `menu`
Offre commerciale traiteur.

| Champ | Type SQL | Contraintes | Description / Métier |
| :--- | :--- | :--- | :--- |
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identifiant |
| `titre` | VARCHAR(100) | NOT NULL, UNIQUE | Intitulé de la formule |
| `description` | TEXT | NOT NULL | Présentation globale |
| `image_url` | VARCHAR(255) | NOT NULL | Chemin de l'asset |
| `prix_unitaire_ttc`| DECIMAL(6,2) | NOT NULL, CHECK > 0 | Tarif / convive TTC |
| `convives_min` | TINYINT UNSIGNED | NOT NULL, DEFAULT 4 | Seuil min. commande |
| `stock_disponible`| SMALLINT UNSIGNED| NOT NULL, DEFAULT 0 | Stock restant |
| `theme` | ENUM('noel','paques','classique','evenement') | NOT NULL | Thème d'événement |
| `regime` | ENUM('classique','vegetarien','vegan') | NOT NULL | Régime alimentaire |
| `delai_min_jours` | TINYINT UNSIGNED | NOT NULL, DEFAULT 7 | Préavis obligatoire (7j) |
| `conditions_stockage` | VARCHAR(255) | NOT NULL | Consigne chaîne du froid |
| `est_actif` | BOOLEAN | NOT NULL, DEFAULT 1 | Visible au catalogue |

---

### 3. Tables `plat`, `allergene` et liaisons
Découpage du menu et liste INCO des 14 allergènes.

* **Table `plat` :**
  * `id` : `INT UNSIGNED`, PK, AUTO_INCREMENT
  * `nom` : `VARCHAR(120)`, NOT NULL
  * `description` : `TEXT`, NULL
  * `categorie` : `ENUM('entree','plat','dessert')`, NOT NULL

* **Table `allergene` :**
  * `id` : `TINYINT UNSIGNED`, PK, AUTO_INCREMENT
  * `code` : `VARCHAR(20)`, NOT NULL, UNIQUE (ex: GLUTEN, LAIT)
  * `nom` : `VARCHAR(50)`, NOT NULL (ex: Gluten, Lait)

* **Jointure `menu_plat` :**
  * `menu_id` (FK), `plat_id` (FK) — PK composite `(menu_id, plat_id)`

* **Jointure `plat_allergene` :**
  * `plat_id` (FK), `allergene_id` (FK) — PK composite `(plat_id, allergene_id)`

---

### 4. Table `commande`
Réservations et calculs de facturation.

| Champ | Type SQL | Contraintes | Description / Métier |
| :--- | :--- | :--- | :--- |
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identifiant |
| `numero_commande` | VARCHAR(20) | NOT NULL, UNIQUE | Réf (ex: CMD-2026-0001) |
| `utilisateur_id` | INT UNSIGNED | FK -> utilisateur(id) | Client |
| `date_commande` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Date d'achat |
| `date_livraison_souhaitee` | DATETIME | NOT NULL | Date de l'événement |
| `adresse_livraison` | VARCHAR(255) | NOT NULL | Voie et numéro |
| `ville_livraison` | VARCHAR(80) | NOT NULL | Ville de livraison |
| `distance_km` | DECIMAL(5,1) | NOT NULL, DEFAULT 0.0 | Distance depuis atelier (0 = Bordeaux) |
| `frais_livraison` | DECIMAL(6,2) | NOT NULL, DEFAULT 0.00 | Calcul : 5€ + (km * 0.59€) |
| `sous_total_repas`| DECIMAL(8,2) | NOT NULL | Total repas brut |
| `montant_remise` | DECIMAL(8,2) | NOT NULL, DEFAULT 0.00 | -10% si convives >= min + 5 |
| `total_ttc` | DECIMAL(8,2) | NOT NULL | Sous-total - remise + livraison |
| `statut` | ENUM('en_attente','validee','en_preparation','livree','annulee') | NOT NULL, DEFAULT 'en_attente' | Suivi de commande |

---

### 5. Table `ligne_commande`
Détail figé à la commande (maintien de l'historique comptable).

| Champ | Type SQL | Contraintes | Description / Métier |
| :--- | :--- | :--- | :--- |
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identifiant |
| `commande_id` | INT UNSIGNED | FK -> commande(id) | Commande parente (CASCADE) |
| `menu_id` | INT UNSIGNED | FK -> menu(id) | Menu sélectionné (RESTRICT) |
| `nb_convives` | SMALLINT UNSIGNED | NOT NULL | Nombre de personnes |
| `prix_unitaire_facture` | DECIMAL(6,2) | NOT NULL | Prix / pers. au moment de l'achat |
| `taux_remise_applique` | DECIMAL(4,2) | NOT NULL, DEFAULT 0.00 | 0.00 ou 0.10 |

---

### 6. Table `avis`
Avis clients déposés après livraison avec modération obligatoire.

| Champ | Type SQL | Contraintes | Description / Métier |
| :--- | :--- | :--- | :--- |
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identifiant |
| `utilisateur_id` | INT UNSIGNED | FK -> utilisateur(id) | Auteur |
| `commande_id` | INT UNSIGNED | FK -> commande(id), UNIQUE | 1 seul avis par commande livrée |
| `note` | TINYINT UNSIGNED | NOT NULL, CHECK 1..5 | Étoiles (1 à 5) |
| `commentaire` | TEXT | NOT NULL | Témoignage client |
| `est_valide` | BOOLEAN | NOT NULL, DEFAULT 0 | 0 = en attente modération, 1 = publié |
| `date_creation` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Date de soumission |