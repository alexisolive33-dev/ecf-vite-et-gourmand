<?php

namespace App\Models;

use App\Config\Database;
use PDO;

class UserModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Recherche un utilisateur par son adresse e-mail
     */
    public function findByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, nom, prenom, email, mot_de_passe, role 
            FROM utilisateur 
            WHERE email = :email 
            LIMIT 1
        ");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        return $user ?: null;
    }

    /**
     * Récupère le profil public d'un utilisateur par son ID (sans mot de passe)
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, nom, prenom, email, role 
            FROM utilisateur 
            WHERE id = :id 
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        return $user ?: null;
    }
}