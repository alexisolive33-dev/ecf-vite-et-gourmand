# Modèle Conceptuel de Données (MCD) — Vite & Gourmand

![Schéma MCD](./mcd-vite-et-gourmand.svg)

## Script source Mocodo

```text
UTILISATEUR: id, nom, prenom, email, mot_de_passe, telephone, role, date_creation
PASSER, 0N UTILISATEUR, 11 COMMANDE
COMMANDE: id, numero_commande, date_commande, date_livraison_souhaitee, adresse_livraison, ville_livraison, distance_km, frais_livraison, sous_total_repas, montant_remise, total_ttc, statut
DÉTAILLER, 1N COMMANDE, 0N MENU: nb_convives, prix_unitaire_facture, taux_remise_applique
MENU: id, titre, description, image_url, prix_unitaire_ttc, convives_min, stock_disponible, theme, regime, delai_min_jours, conditions_stockage, est_actif

REDIGER, 0N UTILISATEUR, 11 AVIS
AVIS: id, note, commentaire, est_valide, date_creation
CONCERNER, 01 COMMANDE, 11 AVIS
COMPOSER, 1N MENU, 0N PLAT
PLAT: id, nom, description, categorie

:::
CONTENIR, 0N PLAT, 0N ALLERGENE
ALLERGENE: id, code, nom