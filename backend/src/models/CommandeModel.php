<?php

namespace App\Models;

use App\Config\Database;
use PDO;
use Exception;

class CommandeModel
{
    private PDO $db;

    // Statuts autorisés par l'énumération SQL
    private const STATUTS_VALIDES = ['en_attente', 'validee', 'en_preparation', 'livree', 'annulee'];

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Récupère toutes les commandes avec les coordonnées client et les lignes associées
     */
    public function findAll(): array
    {
        $sql = "
            SELECT 
                c.id, 
                c.numero_commande, 
                c.date_commande, 
                c.date_livraison_souhaitee, 
                c.adresse_livraison, 
                c.ville_livraison, 
                c.distance_km, 
                c.frais_livraison, 
                c.sous_total_repas, 
                c.montant_remise, 
                c.total_ttc, 
                c.statut,
                u.id AS client_id,
                u.nom AS client_nom,
                u.prenom AS client_prenom,
                u.email AS client_email
            FROM commande c
            INNER JOIN utilisateur u ON u.id = c.utilisateur_id
            ORDER BY c.date_commande DESC
        ";

        $stmt = $this->db->query($sql);
        $commandes = $stmt->fetchAll();

        // Récupération des lignes de commande pour chaque commande
        $stmtLignes = $this->db->prepare("
            SELECT lc.id, lc.menu_id, m.titre AS menu_titre, lc.nb_convives, lc.prix_unitaire_facture, lc.taux_remise_applique
            FROM ligne_commande lc
            INNER JOIN menu m ON m.id = lc.menu_id
            WHERE lc.commande_id = :commande_id
        ");

        foreach ($commandes as &$cmd) {
            $stmtLignes->execute([':commande_id' => $cmd['id']]);
            $cmd['articles'] = $stmtLignes->fetchAll();
        }

        return $commandes;
    }

    /**
     * Met à jour le statut d'une commande
     */
    public function updateStatut(int $id, string $nouveauStatut): bool
    {
        if (!in_array($nouveauStatut, self::STATUTS_VALIDES, true)) {
            throw new Exception("Statut '$nouveauStatut' invalide. Statuts acceptés : " . implode(', ', self::STATUTS_VALIDES));
        }

        $stmt = $this->db->prepare("
            UPDATE commande 
            SET statut = :statut 
            WHERE id = :id
        ");

        return $stmt->execute([
            ':statut' => $nouveauStatut,
            ':id'     => $id
        ]);
    }

    /**
     * Enregistre une commande complète dans une transaction SQL sécurisée
     */
    public function creerCommande(array $client, array $simulation): array
    {
        $this->db->beginTransaction();

        try {
            $menuId = (int)$simulation['menu_id'];

            // 1. Verrouillage pessimiste de la ligne menu
            $stmtLock = $this->db->prepare("
                SELECT stock_disponible 
                FROM menu 
                WHERE id = :id 
                FOR UPDATE
            ");
            $stmtLock->execute([':id' => $menuId]);
            $menu = $stmtLock->fetch();

            if (!$menu || (int)$menu['stock_disponible'] <= 0) {
                throw new Exception("Le stock disponible pour ce menu est épuisé.");
            }

            // 2. Décrémentation du stock
            $stmtStock = $this->db->prepare("
                UPDATE menu 
                SET stock_disponible = stock_disponible - 1 
                WHERE id = :id
            ");
            $stmtStock->execute([':id' => $menuId]);

            // 3. Numéro unique
            $numeroCommande = 'VG-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
            $adresseComplete = trim(($client['adresse_livraison'] ?? '') . ' ' . ($client['code_postal'] ?? ''));

            // 4. Insertion commande
            $sqlCommande = "
                INSERT INTO commande (
                    numero_commande, 
                    utilisateur_id, 
                    date_livraison_souhaitee, 
                    adresse_livraison, 
                    ville_livraison, 
                    distance_km, 
                    frais_livraison, 
                    sous_total_repas, 
                    montant_remise, 
                    total_ttc, 
                    statut
                ) VALUES (
                    :numero, 
                    :utilisateur_id, 
                    :date_livraison_souhaitee, 
                    :adresse_livraison, 
                    :ville_livraison, 
                    :distance_km, 
                    :frais_livraison, 
                    :sous_total_repas, 
                    :montant_remise, 
                    :total_ttc, 
                    'en_attente'
                )
            ";

            $stmtCmd = $this->db->prepare($sqlCommande);
            $stmtCmd->execute([
                ':numero'                   => $numeroCommande,
                ':utilisateur_id'           => $client['utilisateur_id'] ?? 2,
                ':date_livraison_souhaitee' => $simulation['date_livraison'],
                ':adresse_livraison'        => $adresseComplete ?: '14 Avenue du Château 33700',
                ':ville_livraison'          => $simulation['ville_livraison'],
                ':distance_km'              => $simulation['distance_km'],
                ':frais_livraison'          => $simulation['frais_livraison'],
                ':sous_total_repas'         => $simulation['sous_total_net'],
                ':montant_remise'           => $simulation['montant_remise'],
                ':total_ttc'                => $simulation['total_ttc']
            ]);

            $commandeId = (int)$this->db->lastInsertId();

            // 5. Insertion ligne commande
            $sqlLigne = "
                INSERT INTO ligne_commande (
                    commande_id, 
                    menu_id, 
                    nb_convives, 
                    prix_unitaire_facture, 
                    taux_remise_applique
                ) VALUES (
                    :commande_id, 
                    :menu_id, 
                    :nb_convives, 
                    :prix_unitaire_facture, 
                    :taux_remise_applique
                )
            ";

            $stmtLigne = $this->db->prepare($sqlLigne);
            $stmtLigne->execute([
                ':commande_id'           => $commandeId,
                ':menu_id'               => $menuId,
                ':nb_convives'           => $simulation['nb_convives'],
                ':prix_unitaire_facture' => $simulation['prix_unitaire_ttc'],
                ':taux_remise_applique'  => $simulation['taux_remise']
            ]);

            $this->db->commit();

            return [
                'commande_id'     => $commandeId,
                'numero_commande' => $numeroCommande,
                'statut'          => 'en_attente',
                'total_ttc'       => $simulation['total_ttc']
            ];

        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }
}