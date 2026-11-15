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
            SELECT id, nom, prenom, email, mot_de_passe, role, est_actif 
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
            SELECT id, nom, prenom, email, role, est_actif 
            FROM utilisateur 
            WHERE id = :id 
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        return $user ?: null;
    }

    /**
     * Liste tous les comptes de type 'employe'
     */
    public function findAllEmployes(): array
    {
        $stmt = $this->db->query("
            SELECT id, nom, prenom, email, telephone, role, est_actif, date_creation
            FROM utilisateur
            WHERE role = 'employe'
            ORDER BY date_creation DESC, id DESC
        ");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Crée un compte exclusivement avec le rôle 'employe'
     */
    public function createEmploye(string $email, string $passwordHash, string $prenom = '', string $nom = ''): int
    {
        $localPart = explode('@', $email)[0] ?? 'collaborateur';
        $parts = preg_split('/[._-]+/', $localPart);
        $prenomFinal = $prenom !== '' ? $prenom : ucfirst($parts[0] ?? 'Collaborateur');
        $nomFinal = $nom !== '' ? $nom : ucfirst($parts[1] ?? 'Équipe');

        $stmt = $this->db->prepare("
            INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, adresse_postale, code_postal, ville, role, est_actif)
            VALUES (:nom, :prenom, :email, :pass, '05 56 00 00 00', '12 Cours de l\'Intendance', '33000', 'Bordeaux', 'employe', 1)
        ");
        $stmt->execute([
            ':nom'    => $nomFinal,
            ':prenom' => $prenomFinal,
            ':email'  => $email,
            ':pass'   => $passwordHash
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Active ou désactive un compte employé
     */
    public function setEmployeActif(int $id, bool $estActif): bool
    {
        $stmt = $this->db->prepare("
            UPDATE utilisateur
            SET est_actif = :est_actif
            WHERE id = :id AND role = 'employe'
        ");
        $stmt->execute([
            ':est_actif' => $estActif ? 1 : 0,
            ':id'        => $id
        ]);

        return $stmt->rowCount() > 0;
    }
}