<?php

namespace App\Models;

use App\Config\Database;
use PDO;
use ReflectionMethod;

class AvisModel
{
    private PDO $db;
    private array $columns = [];

    public function __construct()
    {
        $this->db = $this->resolveConnection();
        $this->columns = $this->fetchTableColumns();
    }

    private function resolveConnection(): PDO
    {
        if (method_exists(Database::class, 'getConnection')) {
            $ref = new ReflectionMethod(Database::class, 'getConnection');
            if ($ref->isStatic()) {
                return Database::getConnection();
            }
            return (new Database())->getConnection();
        }

        if (method_exists(Database::class, 'getInstance')) {
            $instance = Database::getInstance();
            return method_exists($instance, 'getConnection') ? $instance->getConnection() : $instance;
        }

        throw new \RuntimeException('Impossible d\'initialiser la connexion PDO depuis Database.');
    }

    private function fetchTableColumns(): array
    {
        try {
            $stmt = $this->db->query('SHOW COLUMNS FROM avis');
            return $stmt ? $stmt->fetchAll(PDO::FETCH_COLUMN) : [];
        } catch (\Throwable $e) {
            return ['id', 'utilisateur_id', 'commande_id', 'note', 'commentaire', 'est_valide', 'date_creation'];
        }
    }

    private function getValidationColumn(): string
    {
        foreach (['est_valide', 'valide', 'approuve', 'statut'] as $col) {
            if (in_array($col, $this->columns, true)) {
                return $col;
            }
        }
        return 'est_valide';
    }

    private function getDateColumn(): string
    {
        foreach (['date_creation', 'created_at', 'date_avis'] as $col) {
            if (in_array($col, $this->columns, true)) {
                return $col;
            }
        }
        return 'id';
    }

    /**
     * Récupère uniquement les avis validés pour la vitrine (index.html)
     */
    public function getAvisValides(): array
    {
        $valCol = $this->getValidationColumn();
        $dateCol = $this->getDateColumn();

        $joinSql = $this->buildUserJoinSql();
        $whereSql = ($valCol === 'statut')
            ? "WHERE a.statut IN ('valide', 'validee', 'publie', '1')"
            : "WHERE a.{$valCol} = 1";

        $sql = "
            SELECT a.*,
                   u.prenom AS prenom,
                   u.nom AS nom
            FROM avis a
            {$joinSql}
            {$whereSql}
            ORDER BY a.{$dateCol} DESC
            LIMIT 12
        ";

        $stmt = $this->db->query($sql);
        return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    }

    /**
     * Récupère tous les avis (en attente + validés) pour le back-office
     */
    public function getAllAvis(): array
    {
        $valCol = $this->getValidationColumn();
        $dateCol = $this->getDateColumn();
        $joinSql = $this->buildUserJoinSql();

        $sql = "
            SELECT a.*,
                   u.prenom AS prenom,
                   u.nom AS nom,
                   u.email AS email
            FROM avis a
            {$joinSql}
            ORDER BY a.{$valCol} ASC, a.{$dateCol} DESC
        ";

        $stmt = $this->db->query($sql);
        return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    }

    private function buildUserJoinSql(): string
    {
        $hasUserId = in_array('utilisateur_id', $this->columns, true);
        $hasCmdId = in_array('commande_id', $this->columns, true);

        if ($hasUserId) {
            return 'LEFT JOIN utilisateur u ON a.utilisateur_id = u.id';
        }
        if ($hasCmdId) {
            return 'LEFT JOIN commande c ON a.commande_id = c.id LEFT JOIN utilisateur u ON c.utilisateur_id = u.id';
        }
        return 'LEFT JOIN utilisateur u ON 1 = 0';
    }

    /**
     * Enregistre un nouvel avis client (non publié par défaut)
     */
    public function creerAvis(array $data): array
    {
        $note = max(1, min(5, (int)($data['note'] ?? 5)));
        $commentaire = trim((string)($data['commentaire'] ?? ''));
        $commandeId = !empty($data['commande_id']) ? (int)$data['commande_id'] : null;
        $utilisateurId = !empty($data['utilisateur_id']) ? (int)$data['utilisateur_id'] : null;

        // Vérifier si un avis existe déjà pour cette commande
        if ($commandeId && in_array('commande_id', $this->columns, true)) {
            $check = $this->db->prepare('SELECT id FROM avis WHERE commande_id = :cid LIMIT 1');
            $check->execute([':cid' => $commandeId]);
            if ($check->fetch()) {
                return [
                    'succes' => false,
                    'message' => 'Vous avez déjà déposé un avis pour cette commande.'
                ];
            }
        }

        // Récupérer l'utilisateur depuis la commande si non fourni
        if (!$utilisateurId && $commandeId) {
            $stmtUser = $this->db->prepare('SELECT utilisateur_id FROM commande WHERE id = :cid LIMIT 1');
            $stmtUser->execute([':cid' => $commandeId]);
            $row = $stmtUser->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['utilisateur_id'])) {
                $utilisateurId = (int)$row['utilisateur_id'];
            }
        }

        $fields = ['note', 'commentaire'];
        $params = [
            ':note' => $note,
            ':commentaire' => $commentaire
        ];

        if ($utilisateurId && in_array('utilisateur_id', $this->columns, true)) {
            $fields[] = 'utilisateur_id';
            $params[':utilisateur_id'] = $utilisateurId;
        }

        if ($commandeId && in_array('commande_id', $this->columns, true)) {
            $fields[] = 'commande_id';
            $params[':commande_id'] = $commandeId;
        }

        $valCol = $this->getValidationColumn();
        if (in_array($valCol, $this->columns, true)) {
            $fields[] = $valCol;
            $params[':' . $valCol] = ($valCol === 'statut') ? 'en_attente' : 0;
        }

        $placeholders = array_map(fn($f) => ':' . $f, $fields);
        $sql = sprintf(
            'INSERT INTO avis (%s) VALUES (%s)',
            implode(', ', $fields),
            implode(', ', $placeholders)
        );

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return [
            'succes' => true,
            'id' => (int)$this->db->lastInsertId()
        ];
    }

    /**
     * Valide un avis pour affichage public
     */
    public function validerAvis(int $id): bool
    {
        $valCol = $this->getValidationColumn();
        $valeur = ($valCol === 'statut') ? 'valide' : 1;

        $stmt = $this->db->prepare("UPDATE avis SET {$valCol} = :val WHERE id = :id");
        return $stmt->execute([
            ':val' => $valeur,
            ':id' => $id
        ]);
    }

    /**
     * Supprime un avis refusé
     */
    public function supprimerAvis(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM avis WHERE id = :id');
        return $stmt->execute([':id' => $id]);
    }
}