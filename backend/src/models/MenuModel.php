<?php

namespace App\Models;

use App\Config\Database;
use PDO;
use PDOException;
use Throwable;

class MenuModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Récupère la liste de tous les menus actifs du catalogue (avec la liste de leurs plats)
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
        $menus = $stmt->fetchAll();

        $sqlPlats = "SELECT p.id, p.nom, p.categorie
                     FROM plat p
                     INNER JOIN menu_plat mp ON mp.plat_id = p.id
                     WHERE mp.menu_id = :menu_id
                     ORDER BY FIELD(p.categorie, 'entree', 'plat', 'dessert'), p.nom ASC";
        $stmtPlats = $this->db->prepare($sqlPlats);

        foreach ($menus as &$menu) {
            $stmtPlats->execute([':menu_id' => $menu['id']]);
            $menu['plats'] = $stmtPlats->fetchAll();
        }
        unset($menu);

        return $menus;
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

        $sqlPlats = "SELECT p.id, p.nom, p.description, p.categorie 
                     FROM plat p
                     INNER JOIN menu_plat mp ON mp.plat_id = p.id
                     WHERE mp.menu_id = :menu_id
                     ORDER BY FIELD(p.categorie, 'entree', 'plat', 'dessert')";
        $stmtPlats = $this->db->prepare($sqlPlats);
        $stmtPlats->execute([':menu_id' => $id]);
        $plats = $stmtPlats->fetchAll();

        $sqlAllergenes = "SELECT a.id, a.code, a.nom 
                          FROM allergene a
                          INNER JOIN plat_allergene pa ON pa.allergene_id = a.id
                          WHERE pa.plat_id = :plat_id
                          ORDER BY a.nom ASC";
        $stmtAllergenes = $this->db->prepare($sqlAllergenes);

        foreach ($plats as &$plat) {
            $stmtAllergenes->execute([':plat_id' => $plat['id']]);
            $plat['allergenes'] = $stmtAllergenes->fetchAll();
        }
        unset($plat);

        $menu['plats'] = $plats;

        return $menu;
    }

    /**
     * Récupère tous les plats et tous les allergènes disponibles pour le formulaire Back-Office
     */
    public function getReferentielPlatsEtAllergenes(): array
    {
        $plats = $this->db->query(
            "SELECT id, nom, description, categorie 
             FROM plat 
             ORDER BY FIELD(categorie, 'entree', 'plat', 'dessert'), nom ASC"
        )->fetchAll();

        $stmtAll = $this->db->prepare(
            "SELECT a.id, a.code, a.nom
             FROM allergene a
             INNER JOIN plat_allergene pa ON pa.allergene_id = a.id
             WHERE pa.plat_id = :plat_id
             ORDER BY a.nom ASC"
        );

        foreach ($plats as &$plat) {
            $stmtAll->execute([':plat_id' => $plat['id']]);
            $plat['allergenes'] = $stmtAll->fetchAll();
        }
        unset($plat);

        $allergenes = $this->db->query(
            "SELECT id, code, nom FROM allergene ORDER BY id ASC"
        )->fetchAll();

        return [
            'plats' => $plats,
            'allergenes' => $allergenes
        ];
    }

    /**
     * Crée un nouveau menu et associe ses plats (Transaction ACID)
     */
    public function create(array $data, array $platIds = []): int
    {
        $this->db->beginTransaction();
        try {
            $sql = "INSERT INTO menu (
                        titre, description, image_url, prix_unitaire_ttc,
                        convives_min, stock_disponible, theme, regime,
                        delai_min_jours, conditions_stockage, est_actif
                    ) VALUES (
                        :titre, :description, :image_url, :prix_unitaire_ttc,
                        :convives_min, :stock_disponible, :theme, :regime,
                        :delai_min_jours, :conditions_stockage, 1
                    )";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':titre' => $data['titre'],
                ':description' => $data['description'],
                ':image_url' => $data['image_url'],
                ':prix_unitaire_ttc' => $data['prix_unitaire_ttc'],
                ':convives_min' => $data['convives_min'],
                ':stock_disponible' => $data['stock_disponible'],
                ':theme' => $data['theme'],
                ':regime' => $data['regime'],
                ':delai_min_jours' => $data['delai_min_jours'],
                ':conditions_stockage' => $data['conditions_stockage'],
            ]);

            $menuId = (int)$this->db->lastInsertId();
            $this->syncPlats($menuId, $platIds);

            $this->db->commit();
            return $menuId;
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Met à jour un menu existant et synchronise ses plats
     */
    public function update(int $id, array $data, array $platIds = []): bool
    {
        $this->db->beginTransaction();
        try {
            $sql = "UPDATE menu SET
                        titre = :titre,
                        description = :description,
                        image_url = :image_url,
                        prix_unitaire_ttc = :prix_unitaire_ttc,
                        convives_min = :convives_min,
                        stock_disponible = :stock_disponible,
                        theme = :theme,
                        regime = :regime,
                        delai_min_jours = :delai_min_jours,
                        conditions_stockage = :conditions_stockage
                    WHERE id = :id AND est_actif = 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':id' => $id,
                ':titre' => $data['titre'],
                ':description' => $data['description'],
                ':image_url' => $data['image_url'],
                ':prix_unitaire_ttc' => $data['prix_unitaire_ttc'],
                ':convives_min' => $data['convives_min'],
                ':stock_disponible' => $data['stock_disponible'],
                ':theme' => $data['theme'],
                ':regime' => $data['regime'],
                ':delai_min_jours' => $data['delai_min_jours'],
                ':conditions_stockage' => $data['conditions_stockage'],
            ]);

            $this->syncPlats($id, $platIds);

            $this->db->commit();
            return true;
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Supprime un menu (ou l'archive si déjà présent dans des commandes)
     */
    public function delete(int $id): string
    {
        try {
            $stmt = $this->db->prepare("DELETE FROM menu WHERE id = :id");
            $stmt->execute([':id' => $id]);
            return 'supprime';
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                $stmtSoft = $this->db->prepare("UPDATE menu SET est_actif = 0 WHERE id = :id");
                $stmtSoft->execute([':id' => $id]);
                return 'archive';
            }
            throw $e;
        }
    }

    /**
     * Crée un nouveau plat et associe ses allergènes INCO
     */
    public function createPlat(string $nom, string $categorie, ?string $description, array $allergeneIds = []): int
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO plat (nom, description, categorie) VALUES (:nom, :description, :categorie)"
            );
            $stmt->execute([
                ':nom' => $nom,
                ':description' => $description ?: null,
                ':categorie' => $categorie,
            ]);
            $platId = (int)$this->db->lastInsertId();

            if (!empty($allergeneIds)) {
                $stmtAll = $this->db->prepare(
                    "INSERT IGNORE INTO plat_allergene (plat_id, allergene_id) VALUES (:plat_id, :allergene_id)"
                );
                foreach ($allergeneIds as $allId) {
                    $allIdInt = (int)$allId;
                    if ($allIdInt > 0) {
                        $stmtAll->execute([':plat_id' => $platId, ':allergene_id' => $allIdInt]);
                    }
                }
            }

            $this->db->commit();
            return $platId;
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    private function syncPlats(int $menuId, array $platIds): void
    {
        $del = $this->db->prepare("DELETE FROM menu_plat WHERE menu_id = :menu_id");
        $del->execute([':menu_id' => $menuId]);

        if (!empty($platIds)) {
            $ins = $this->db->prepare("INSERT IGNORE INTO menu_plat (menu_id, plat_id) VALUES (:menu_id, :plat_id)");
            foreach ($platIds as $platId) {
                $pid = (int)$platId;
                if ($pid > 0) {
                    $ins->execute([':menu_id' => $menuId, ':plat_id' => $pid]);
                }
            }
        }
    }
}