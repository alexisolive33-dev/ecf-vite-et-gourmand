# Modèle Logique de Données (MLD) — Vite & Gourmand

Structure relationnelle normalisée en 3ᵉ Forme Normale (3NF).

---

### 1. Structure des tables

* **UTILISATEUR** (id, nom, prenom, email, mot_de_passe, telephone, role, date_creation)
  * Clé primaire : `id`
  * Contrainte d'unicité : `email`

* **MENU** (id, titre, description, image_url, prix_unitaire_ttc, convives_min, stock_disponible, theme, regime, delai_min_jours, conditions_stockage, est_actif)
  * Clé primaire : `id`
  * Contrainte d'unicité : `titre`

* **PLAT** (id, nom, description, categorie)
  * Clé primaire : `id`

* **MENU_PLAT** (#menu_id, #plat_id)
  * Clé primaire composite : `(menu_id, plat_id)`
  * Clés étrangères :
    * `#menu_id` en référence à `MENU(id)` ON DELETE CASCADE
    * `#plat_id` en référence à `PLAT(id)` ON DELETE RESTRICT

* **ALLERGENE** (id, code, nom)
  * Clé primaire : `id`
  * Contrainte d'unicité : `code`

* **PLAT_ALLERGENE** (#plat_id, #allergene_id)
  * Clé primaire composite : `(plat_id, allergene_id)`
  * Clés étrangères :
    * `#plat_id` en référence à `PLAT(id)` ON DELETE CASCADE
    * `#allergene_id` en référence à `ALLERGENE(id)` ON DELETE RESTRICT

* **COMMANDE** (id, numero_commande, #utilisateur_id, date_commande, date_livraison_souhaitee, adresse_livraison, ville_livraison, distance_km, frais_livraison, sous_total_repas, montant_remise, total_ttc, statut)
  * Clé primaire : `id`
  * Contrainte d'unicité : `numero_commande`
  * Clé étrangère :
    * `#utilisateur_id` en référence à `UTILISATEUR(id)` ON DELETE RESTRICT

* **LIGNE_COMMANDE** (id, #commande_id, #menu_id, nb_convives, prix_unitaire_facture, taux_remise_applique)
  * Clé primaire : `id`
  * Clés étrangères :
    * `#commande_id` en référence à `COMMANDE(id)` ON DELETE CASCADE
    * `#menu_id` en référence à `MENU(id)` ON DELETE RESTRICT

* **AVIS** (id, #utilisateur_id, #commande_id, note, commentaire, est_valide, date_creation)
  * Clé primaire : `id`
  * Contrainte d'unicité : `#commande_id` (un avis max par commande livrée)
  * Clés étrangères :
    * `#utilisateur_id` en référence à `UTILISATEUR(id)` ON DELETE CASCADE
    * `#commande_id` en référence à `COMMANDE(id)` ON DELETE CASCADE

---

### 2. Règles de gestion traduites

* **Historisation financière :** `LIGNE_COMMANDE` stocke `prix_unitaire_facture` et `taux_remise_applique` au moment de la commande pour figer le montant facturé si le catalogue change ultérieurement.
* **Sécurité des données :** L'intégrité référentielle en `ON DELETE RESTRICT` sur les clients et menus empêche toute suppression accidentelle d'une entrée liée à un historique de vente.