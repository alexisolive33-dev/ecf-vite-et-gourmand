-- =============================================================================
-- Jeu d'essai (Fixtures) : Vite & Gourmand
-- Données de test conformes aux maquettes Figma Desktop & Mobile
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `avis`;
TRUNCATE TABLE `ligne_commande`;
TRUNCATE TABLE `commande`;
TRUNCATE TABLE `plat_allergene`;
TRUNCATE TABLE `allergene`;
TRUNCATE TABLE `menu_plat`;
TRUNCATE TABLE `plat`;
TRUNCATE TABLE `menu`;
TRUNCATE TABLE `utilisateur`;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 1. Nomenclature officielle des 14 allergènes (Règlement européen INCO)
-- -----------------------------------------------------------------------------
INSERT INTO `allergene` (`id`, `code`, `nom`) VALUES
(1,  'GLUTEN',     'Gluten'),
(2,  'CRUSTACES',  'Crustacés'),
(3,  'OEUFS',      'Œufs'),
(4,  'POISSONS',   'Poissons'),
(5,  'ARACHIDES',  'Arachides'),
(6,  'SOJA',       'Soja'),
(7,  'LAIT',       'Lait'),
(8,  'FRUITS_COQ', 'Fruits à coque'),
(9,  'CELERI',     'Céleri'),
(10, 'MOUTARDE',   'Moutarde'),
(11, 'SESAME',     'Graines de sésame'),
(12, 'SULFITES',   'Sulfites'),
(13, 'LUPIN',      'Lupin'),
(14, 'MOLLUSQUES', 'Mollusques');

-- -----------------------------------------------------------------------------
-- 2. Comptes utilisateurs
-- Mot de passe de test : Password123!
-- Hash Bcrypt : $2y$10$eACCYoNOHEqgkVE8aGY2A.k0d5I7Zk7d3f8a4V2f0QoE3gVzDkIWS
-- -----------------------------------------------------------------------------
INSERT INTO `utilisateur` (`id`, `nom`, `prenom`, `email`, `mot_de_passe`, `telephone`, `role`, `date_creation`) VALUES
-- Administrateurs (Julie & José)
(1, 'Gourmand', 'Julie', 'julie@vitegourmand.fr', '$2y$10$eACCYoNOHEqgkVE8aGY2A.k0d5I7Zk7d3f8a4V2f0QoE3gVzDkIWS', '0556000001', 'admin', '2026-01-10 09:00:00'),
(2, 'Gourmand', 'José',  'jose@vitegourmand.fr',  '$2y$10$eACCYoNOHEqgkVE8aGY2A.k0d5I7Zk7d3f8a4V2f0QoE3gVzDkIWS', '0556000002', 'admin', '2026-01-10 09:00:00'),
-- Employé cuisine & livraison
(3, 'Lemoine',  'Thomas', 'thomas.livraison@vitegourmand.fr', '$2y$10$eACCYoNOHEqgkVE8aGY2A.k0d5I7Zk7d3f8a4V2f0QoE3gVzDkIWS', '0601020304', 'employe', '2026-02-01 08:30:00'),
-- Clients du portfolio
(4, 'Dubois',   'Mathieu', 'mathieu.dubois@email.fr', '$2y$10$eACCYoNOHEqgkVE8aGY2A.k0d5I7Zk7d3f8a4V2f0QoE3gVzDkIWS', '0611223344', 'client', '2026-08-15 14:20:00'),
(5, 'Aquitaine Conseil', 'Cabinet', 'contact@aquitaine-conseil.fr', '$2y$10$eACCYoNOHEqgkVE8aGY2A.k0d5I7Zk7d3f8a4V2f0QoE3gVzDkIWS', '0557889900', 'client', '2026-09-01 10:15:00'),
(6, 'Martin',   'Claire',  'claire.martin@email.fr', '$2y$10$eACCYoNOHEqgkVE8aGY2A.k0d5I7Zk7d3f8a4V2f0QoE3gVzDkIWS', '0699887766', 'client', '2026-10-05 16:40:00');

-- -----------------------------------------------------------------------------
-- 3. Les 4 Menus événementiels du catalogue Figma
-- -----------------------------------------------------------------------------
INSERT INTO `menu` (`id`, `titre`, `description`, `image_url`, `prix_unitaire_ttc`, `convives_min`, `stock_disponible`, `theme`, `regime`, `delai_min_jours`, `conditions_stockage`, `est_actif`) VALUES
(1, 'Menu Festif du Réveillon', 
    'Création gastronomique de fin d\'année, produits du Sud-Ouest cuisinés le jour même dans notre atelier.', 
    '/assets/images/menus/menu-reveillon.webp', 48.00, 6, 5, 'noel', 'classique', 7, 
    'Conserver obligatoirement entre 0°C et +4°C dès réception. À consommer dans les 24h.', TRUE),

(2, 'Menu Printanier Pascal', 
    'Saveurs printanières autour des primeurs girondins et herbes fraîches du potager.', 
    '/assets/images/menus/menu-paques.webp', 36.00, 4, 8, 'paques', 'vegetarien', 7, 
    'Conserver entre 0°C et +4°C. Réchauffage doux au bain-marie recommandé.', TRUE),

(3, 'Buffet Réception & Cocktails', 
    'Sélection dînatoire raffinée : pièces cocktail terre-mer et mignardises artisanales.', 
    '/assets/images/menus/buffet-cocktail.webp', 55.00, 10, 3, 'evenement', 'classique', 7, 
    'Maintenir au frais jusqu\'au dressage final. Consommer sous 12h après ouverture.', TRUE),

(4, 'Découverte Terroir Végétal', 
    'Menu 100% végétal avec maraîchers bio de Gironde, graines anciennes et émulsions légères.', 
    '/assets/images/menus/terroir-vegetal.webp', 32.00, 4, 12, 'classique', 'vegan', 7, 
    'Conserver entre +2°C et +4°C. Sans aucun dérivé animal.', TRUE);

-- -----------------------------------------------------------------------------
-- 4. Préparations culinaires (Plats)
-- -----------------------------------------------------------------------------
INSERT INTO `plat` (`id`, `nom`, `description`, `categorie`) VALUES
-- Plats Menu 1 (Noël)
(1, 'Médaillon de foie gras maison', 'Chutney de figues et brioche dorée.', 'entree'),
(2, 'Suprême de volaille fermière aux morilles', 'Écrasé de grenailles truffé et petits légumes glacés.', 'plat'),
(3, 'Bûche pâtissière marrons & chocolat grand cru', 'Praliné croustillant et ganache noire 70%.', 'dessert'),

-- Plats Menu 2 (Pâques)
(4, 'Asperges blanches rôties du Blayais', 'Mousseline d\'herbes fraîches et tomme de brebis.', 'entree'),
(5, 'Risotto crémeux aux morilles', 'Riz Carnaroli lié au parmesan 24 mois.', 'plat'),
(6, 'Nid croustillant au chocolat grand cru', 'Sablé cacao et ganache guanaja.', 'dessert'),

-- Plats Menus 3 & 4 (Buffet & Végétal)
(7, 'Assortiment de 12 pièces cocktails salées', 'Canapés terre-mer et navettes briochées.', 'entree'),
(8, 'Poêlée festive terre-mer marinée', 'Mini-brochettes de volaille et crevettes persillées.', 'plat'),
(9, 'Plateau de mignardises artisanales', 'Macarons, tartelettes citron et choux vanille.', 'dessert'),
(10, 'Déclinaison de légumes anciens rôtis au thym', 'Panais, carottes pourpres et éclats de noisettes.', 'plat'),
(11, 'Tartelette acidulée citron-basilic', 'Sablé sarrasin et crème citron jaune.', 'dessert');

-- -----------------------------------------------------------------------------
-- 5. Composition des Menus (menu_plat)
-- -----------------------------------------------------------------------------
INSERT INTO `menu_plat` (`menu_id`, `plat_id`) VALUES
(1, 1), (1, 2), (1, 3),    -- Menu 1 : Foie gras + Volaille + Bûche
(2, 4), (2, 5), (2, 6),    -- Menu 2 : Asperges + Risotto + Nid chocolat
(3, 7), (3, 8), (3, 9),    -- Menu 3 : Pièces cocktail + Terre-mer + Mignardises
(4, 4), (4, 10), (4, 11);  -- Menu 4 : Asperges + Légumes anciens + Tartelette

-- -----------------------------------------------------------------------------
-- 6. Déclaration des allergènes par plat (plat_allergene)
-- -----------------------------------------------------------------------------
INSERT INTO `plat_allergene` (`plat_id`, `allergene_id`) VALUES
-- Plat 1 : Gluten, Lait
(1, 1), (1, 7),
-- Plat 2 : Lait
(2, 7),
-- Plat 3 : Gluten, Oeufs, Lait, Fruits à coque
(3, 1), (3, 3), (3, 7), (3, 8),
-- Plat 4 : Lait, Céleri
(4, 7), (4, 9),
-- Plat 5 : Lait, Céleri
(5, 7), (5, 9),
-- Plat 6 : Gluten, Oeufs, Lait
(6, 1), (6, 3), (6, 7),
-- Plat 7 : Gluten, Crustacés, Poissons, Lait
(7, 1), (7, 2), (7, 4), (7, 7),
-- Plat 8 : Crustacés, Moutarde
(8, 2), (8, 10),
-- Plat 9 : Gluten, Oeufs, Lait, Fruits à coque
(9, 1), (9, 3), (9, 7), (9, 8),
-- Plat 10 : Fruits à coque, Graines de sésame
(10, 8), (10, 11),
-- Plat 11 : Soja
(11, 6);

-- -----------------------------------------------------------------------------
-- 7. Commandes
-- -----------------------------------------------------------------------------
INSERT INTO `commande` (
    `id`, `numero_commande`, `utilisateur_id`, 
    `date_commande`, `date_livraison_souhaitee`, 
    `adresse_livraison`, `ville_livraison`, `distance_km`, 
    `frais_livraison`, `sous_total_repas`, `montant_remise`, `total_ttc`, `statut`
) VALUES
-- Commande 1 : Prestation passée (Mérignac)
(1, 'CMD-2026-0912', 4, 
    '2026-08-20 11:15:00', '2026-09-12 12:00:00', 
    'Domaine des Vignes, Allée des Châteaux', 'Mérignac', 12.0, 
    12.08, 1650.00, 165.00, 1497.08, 'livree'),

-- Commande 2 : Prestation entreprise passée (Bordeaux intra-muros = 0 km)
(2, 'CMD-2026-1002', 5, 
    '2026-09-22 09:30:00', '2026-10-02 11:30:00', 
    '45 Quai des Chartrons', 'Bordeaux', 0.0, 
    0.00, 825.00, 82.50, 742.50, 'livree'),

-- Commande 3 : Simulation exacte issue des maquettes Desktop et Mobile 03
-- 12 convives x 48,00 € = 576,00 € | Remise -10% = 57,60 € | Repas net = 518,40 €
-- Livraison Mérignac 15 km : 5,00 € + (15 x 0,59 €) = 13,85 € | Total TTC = 532,25 €
(3, 'CMD-2026-1224', 6, 
    '2026-11-03 14:00:00', '2026-12-24 19:00:00', 
    '15 Avenue de l\'Abreuvoir', 'Mérignac', 15.0, 
    13.85, 576.00, 57.60, 532.25, 'en_attente');

-- -----------------------------------------------------------------------------
-- 8. Lignes de commandes associées
-- -----------------------------------------------------------------------------
INSERT INTO `ligne_commande` (`id`, `commande_id`, `menu_id`, `nb_convives`, `prix_unitaire_facture`, `taux_remise_applique`) VALUES
(1, 1, 3, 30, 55.00, 0.10),
(2, 2, 3, 15, 55.00, 0.10),
(3, 3, 1, 12, 48.00, 0.10);

-- -----------------------------------------------------------------------------
-- 9. Avis clients vérifiés et modération
-- -----------------------------------------------------------------------------
INSERT INTO `avis` (`id`, `utilisateur_id`, `commande_id`, `note`, `commentaire`, `est_valide`, `date_creation`) VALUES
-- Avis 1 : visible sur Figma Accueil (Mathieu D.)
(1, 4, 1, 5, 
    'Julie et José ont assuré le repas de notre mariage. Tout était raffiné, servi chaud et les convives étaient conquis !', 
    TRUE, '2026-09-14 18:30:00'),

-- Avis 2 : visible sur Figma Accueil (Cabinet Aquitaine Conseil)
(2, 5, 2, 5, 
    'Un buffet d\'entreprise parfait, ponctuel et une gestion exemplaire des options végétariennes.', 
    TRUE, '2026-10-03 10:45:00'),

-- Avis 3 : avis en attente de validation (test du module de modération admin)
(3, 6, 3, 4, 
    'Prise de commande claire et détaillée, hâte de déguster le menu au réveillon !', 
    FALSE, '2026-11-03 14:10:00');