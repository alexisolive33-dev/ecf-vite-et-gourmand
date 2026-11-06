<?php

namespace App\Models;

use App\Config\Database;
use PDO;

class MenuModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Récupère la liste de tous les menus actifs du catalogue
     */
    public function findAllActive(): array
    {
        $sql = "SELECT 
                    id, 
                    titre, 
                    description, 
                    image_url, 
                    prix_unitaire_ttc, 
                    convives_min, 
                    stock_disponible, 
                    theme, 
                    regime, 
                    delai_min_jours, 
                    conditions_stockage 
                FROM menu 
                WHERE est_actif = 1 
                ORDER BY id ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Récupère un menu précis par son identifiant avec ses plats et leurs allergènes INCO
     */
    public function findById(int $id): ?array
    {
        $sqlMenu = "SELECT * FROM menu WHERE id = :id AND est_actif = 1 LIMIT 1";
        $stmtMenu = $this->db->prepare($sqlMenu);
        $stmtMenu->execute([':id' => $id]);
        $menu = $stmtMenu->fetch();

        if (!$menu) {
            return null;
        }

        // 1. Récupération des plats composant ce menu
        $sqlPlats = "SELECT p.id, p.nom, p.description, p.categorie 
                     FROM plat p
                     INNER JOIN menu_plat mp ON mp.plat_id = p.id
                     WHERE mp.menu_id = :menu_id
                     ORDER BY FIELD(p.categorie, 'entree', 'plat', 'dessert')";
        $stmtPlats = $this->db->prepare($sqlPlats);
        $stmtPlats->execute([':menu_id' => $id]);
        $plats = $stmtPlats->fetchAll();

        // 2. Requête préparée pour lister les allergènes INCO de chaque plat
        $sqlAllergenes = "SELECT a.id, a.code, a.nom 
                          FROM allergene a
                          INNER JOIN plat_allergene pa ON pa.allergene_id = a.id
                          WHERE pa.plat_id = :plat_id
                          ORDER BY a.nom ASC";
        $stmtAllergenes = $this->db->prepare($sqlAllergenes);

        // 3. Liaison des allergènes à chaque plat correspondant
        foreach ($plats as &$plat) {
            $stmtAllergenes->execute([':plat_id' => $plat['id']]);
            $plat['allergenes'] = $stmtAllergenes->fetchAll();
        }

        $menu['plats'] = $plats;

        return $menu;
    }
}