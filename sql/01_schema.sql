-- =============================================================================
-- Schéma de base de données : Vite & Gourmand (Julie & José)
-- Moteur : InnoDB | Encodage : UTF8mb4
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `avis`;
DROP TABLE IF EXISTS `ligne_commande`;
DROP TABLE IF EXISTS `commande`;
DROP TABLE IF EXISTS `plat_allergene`;
DROP TABLE IF EXISTS `allergene`;
DROP TABLE IF EXISTS `menu_plat`;
DROP TABLE IF EXISTS `plat`;
DROP TABLE IF EXISTS `menu`;
DROP TABLE IF EXISTS `utilisateur`;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 1. Table : utilisateur
-- -----------------------------------------------------------------------------
CREATE TABLE `utilisateur` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `nom` VARCHAR(50) NOT NULL,
    `prenom` VARCHAR(50) NOT NULL,
    `email` VARCHAR(120) NOT NULL UNIQUE,
    `mot_de_passe` VARCHAR(255) NOT NULL,
    `telephone` VARCHAR(20) NOT NULL,
    `role` ENUM('client', 'employe', 'admin') NOT NULL DEFAULT 'client',
    `date_creation` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_utilisateur_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Table : menu
-- -----------------------------------------------------------------------------
CREATE TABLE `menu` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `titre` VARCHAR(100) NOT NULL UNIQUE,
    `description` TEXT NOT NULL,
    `image_url` VARCHAR(255) NOT NULL,
    `prix_unitaire_ttc` DECIMAL(6,2) NOT NULL,
    `convives_min` TINYINT UNSIGNED NOT NULL DEFAULT 4,
    `stock_disponible` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `theme` ENUM('noel', 'paques', 'classique', 'evenement') NOT NULL,
    `regime` ENUM('classique', 'vegetarien', 'vegan') NOT NULL,
    `delai_min_jours` TINYINT UNSIGNED NOT NULL DEFAULT 7,
    `conditions_stockage` VARCHAR(255) NOT NULL DEFAULT 'Conserver entre 0°C et +4°C',
    `est_actif` BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT `chk_menu_prix` CHECK (`prix_unitaire_ttc` > 0),
    CONSTRAINT `chk_menu_convives` CHECK (`convives_min` >= 1),
    INDEX `idx_menu_filtres` (`theme`, `regime`, `prix_unitaire_ttc`, `est_actif`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Table : plat
-- -----------------------------------------------------------------------------
CREATE TABLE `plat` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `nom` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `categorie` ENUM('entree', 'plat', 'dessert') NOT NULL,
    INDEX `idx_plat_categorie` (`categorie`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Table de jointure : menu_plat
-- -----------------------------------------------------------------------------
CREATE TABLE `menu_plat` (
    `menu_id` INT UNSIGNED NOT NULL,
    `plat_id` INT UNSIGNED NOT NULL,
    PRIMARY KEY (`menu_id`, `plat_id`),
    CONSTRAINT `fk_menuplat_menu` 
        FOREIGN KEY (`menu_id`) REFERENCES `menu` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_menuplat_plat` 
        FOREIGN KEY (`plat_id`) REFERENCES `plat` (`id`) 
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Table : allergene (Nomenclature INCO)
-- -----------------------------------------------------------------------------
CREATE TABLE `allergene` (
    `id` TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(20) NOT NULL UNIQUE,
    `nom` VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Table de jointure : plat_allergene
-- -----------------------------------------------------------------------------
CREATE TABLE `plat_allergene` (
    `plat_id` INT UNSIGNED NOT NULL,
    `allergene_id` TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (`plat_id`, `allergene_id`),
    CONSTRAINT `fk_platallergene_plat` 
        FOREIGN KEY (`plat_id`) REFERENCES `plat` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_platallergene_allergene` 
        FOREIGN KEY (`allergene_id`) REFERENCES `allergene` (`id`) 
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Table : commande
-- -----------------------------------------------------------------------------
CREATE TABLE `commande` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `numero_commande` VARCHAR(20) NOT NULL UNIQUE,
    `utilisateur_id` INT UNSIGNED NOT NULL,
    `date_commande` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `date_livraison_souhaitee` DATETIME NOT NULL,
    `adresse_livraison` VARCHAR(255) NOT NULL,
    `ville_livraison` VARCHAR(80) NOT NULL,
    `distance_km` DECIMAL(5,1) NOT NULL DEFAULT 0.0,
    `frais_livraison` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `sous_total_repas` DECIMAL(8,2) NOT NULL,
    `montant_remise` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `total_ttc` DECIMAL(8,2) NOT NULL,
    `statut` ENUM('en_attente', 'validee', 'en_preparation', 'livree', 'annulee') NOT NULL DEFAULT 'en_attente',
    CONSTRAINT `fk_commande_utilisateur` 
        FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur` (`id`) 
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_commande_totaux` CHECK (`sous_total_repas` >= 0 AND `total_ttc` >= 0),
    INDEX `idx_commande_date_livraison` (`date_livraison_souhaitee`),
    INDEX `idx_commande_statut` (`statut`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Table : ligne_commande
-- -----------------------------------------------------------------------------
CREATE TABLE `ligne_commande` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `commande_id` INT UNSIGNED NOT NULL,
    `menu_id` INT UNSIGNED NOT NULL,
    `nb_convives` SMALLINT UNSIGNED NOT NULL,
    `prix_unitaire_facture` DECIMAL(6,2) NOT NULL,
    `taux_remise_applique` DECIMAL(4,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT `fk_ligne_commande` 
        FOREIGN KEY (`commande_id`) REFERENCES `commande` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_ligne_menu` 
        FOREIGN KEY (`menu_id`) REFERENCES `menu` (`id`) 
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_ligne_convives` CHECK (`nb_convives` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. Table : avis
-- -----------------------------------------------------------------------------
CREATE TABLE `avis` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `utilisateur_id` INT UNSIGNED NOT NULL,
    `commande_id` INT UNSIGNED NOT NULL UNIQUE,
    `note` TINYINT UNSIGNED NOT NULL,
    `commentaire` TEXT NOT NULL,
    `est_valide` BOOLEAN NOT NULL DEFAULT FALSE,
    `date_creation` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_avis_utilisateur` 
        FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_avis_commande` 
        FOREIGN KEY (`commande_id`) REFERENCES `commande` (`id`) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `chk_avis_note` CHECK (`note` BETWEEN 1 AND 5),
    INDEX `idx_avis_est_valide` (`est_valide`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;