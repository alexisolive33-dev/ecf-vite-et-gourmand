<?php

namespace App\Models;

use App\Config\Database;
use PDO;

class ContactModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
        $this->ensureTableExists();
    }

    private function ensureTableExists(): void
    {
        $sql = "
            CREATE TABLE IF NOT EXISTS contact_message (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nom_complet VARCHAR(150) NOT NULL,
                email VARCHAR(150) NOT NULL,
                telephone VARCHAR(30) NULL,
                type_evenement VARCHAR(80) NOT NULL DEFAULT 'particulier',
                message TEXT NOT NULL,
                statut VARCHAR(30) NOT NULL DEFAULT 'nouveau',
                date_envoi DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $this->db->exec($sql);
    }

    public function creer(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO contact_message (nom_complet, email, telephone, type_evenement, message, statut, date_envoi)
            VALUES (:nom_complet, :email, :telephone, :type_evenement, :message, 'nouveau', NOW())
        ");

        $stmt->execute([
            ':nom_complet'    => $data['nom_complet'],
            ':email'          => $data['email'],
            ':telephone'      => $data['telephone'] ?: null,
            ':type_evenement' => $data['type_evenement'] ?: 'particulier',
            ':message'        => $data['message']
        ]);

        return (int)$this->db->lastInsertId();
    }

    public function getAll(): array
    {
        $stmt = $this->db->query("
            SELECT id, nom_complet, email, telephone, type_evenement, message, statut, date_envoi
            FROM contact_message
            ORDER BY FIELD(statut, 'nouveau', 'traite'), date_envoi DESC
        ");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function marquerTraite(int $id): bool
    {
        $stmt = $this->db->prepare("UPDATE contact_message SET statut = 'traite' WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }

    public function supprimer(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM contact_message WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
}