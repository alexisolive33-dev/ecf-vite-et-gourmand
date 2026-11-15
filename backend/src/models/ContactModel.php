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
                titre VARCHAR(150) NOT NULL,
                description TEXT NOT NULL,
                email VARCHAR(150) NOT NULL,
                statut VARCHAR(30) NOT NULL DEFAULT 'nouveau',
                date_envoi DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $this->db->exec($sql);

        // Migration automatique si la table existait déjà avec l'ancienne structure
        $cols = $this->db->query("SHOW COLUMNS FROM contact_message")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('titre', $cols, true)) {
            $this->db->exec("ALTER TABLE contact_message ADD COLUMN titre VARCHAR(150) NOT NULL DEFAULT '' AFTER id");
        }
        if (!in_array('description', $cols, true)) {
            $this->db->exec("ALTER TABLE contact_message ADD COLUMN description TEXT NOT NULL AFTER titre");
        }
    }

    public function creer(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO contact_message (titre, description, email, statut, date_envoi)
            VALUES (:titre, :description, :email, 'nouveau', NOW())
        ");

        $stmt->execute([
            ':titre'       => $data['titre'],
            ':description' => $data['description'],
            ':email'       => $data['email']
        ]);

        // Envoi par mail à l'entreprise (Julie & José)
        $sujet = "[Vite & Gourmand] Nouveau contact : " . $data['titre'];
        $corps = "Nouvelle demande reçue depuis le formulaire de contact :\n\n"
               . "Titre : " . $data['titre'] . "\n"
               . "E-mail du visiteur : " . $data['email'] . "\n\n"
               . "Description :\n" . $data['description'] . "\n";
        $headers = "From: no-reply@vitegourmand.fr\r\n"
                 . "Reply-To: " . $data['email'] . "\r\n"
                 . "Content-Type: text/plain; charset=UTF-8\r\n";

        @mail('contact@vitegourmand.fr', $sujet, $corps, $headers);

        return (int)$this->db->lastInsertId();
    }

    public function getAll(): array
    {
        $stmt = $this->db->query("
            SELECT 
                id,
                titre,
                description,
                titre AS nom_complet,
                description AS message,
                email,
                statut,
                date_envoi
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