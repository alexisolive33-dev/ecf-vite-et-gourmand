<?php

namespace App\Controllers;

use App\Config\Database;
use App\Security\AuthGuard;
use PDO;

class AuthController
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Endpoint : POST /api/auth/login
     */
    public function login(): void
    {
        $donnees = json_decode(file_get_contents('php://input'), true);

        if (!$donnees) {
            $this->repondreJson(400, 'erreur', 'Corps JSON invalide');
            return;
        }

        $email = trim($donnees['email'] ?? '');
        $motDePasse = (string) ($donnees['mot_de_passe'] ?? '');

        if (empty($email) || empty($motDePasse)) {
            $this->repondreJson(422, 'erreur', 'L\'adresse e-mail et le mot de passe sont obligatoires.');
            return;
        }

        $stmt = $this->db->prepare('SELECT * FROM utilisateur WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($motDePasse, $user['mot_de_passe'])) {
            $this->repondreJson(401, 'erreur', 'Identifiants invalides.');
            return;
        }

        $token = AuthGuard::generateToken($user);

        // Renvoyer l'ensemble des informations pour le pré-remplissage automatique des commandes
        $this->repondreJson(200, 'succes', 'Connexion réussie', [
            'token' => $token,
            'utilisateur' => [
                'id'              => (int) $user['id'],
                'nom'             => $user['nom'],
                'prenom'          => $user['prenom'],
                'email'           => $user['email'],
                'telephone'       => $user['telephone'],
                'adresse_postale' => $user['adresse_postale'] ?? '',
                'code_postal'     => $user['code_postal'] ?? '',
                'ville'           => $user['ville'] ?? '',
                'role'            => $user['role']
            ]
        ]);
    }

    /**
     * Endpoint : POST /api/auth/register (Inscription publique Client)
     */
    public function register(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data) {
            $this->repondreJson(400, 'erreur', 'Données JSON manquantes');
            return;
        }

        $nom        = trim($data['nom'] ?? '');
        $prenom     = trim($data['prenom'] ?? '');
        $email      = filter_var(trim($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
        $telephone  = trim($data['telephone'] ?? '');
        $adresse    = trim($data['adresse_postale'] ?? '');
        $cp         = trim($data['code_postal'] ?? '');
        $ville      = trim($data['ville'] ?? '');
        $motDePasse = (string) ($data['mot_de_passe'] ?? '');

        if (empty($nom) || empty($prenom) || !$email || empty($telephone) || empty($adresse) || empty($motDePasse)) {
            $this->repondreJson(422, 'erreur', 'Tous les champs marqués sont obligatoires et l\'email doit être valide.');
            return;
        }

        // Exigence ECF : 10 caractères min., 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial
        $regexSecurite = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{10,}$/';
        if (!preg_match($regexSecurite, $motDePasse)) {
            $this->repondreJson(422, 'erreur', 'Le mot de passe doit contenir au minimum 10 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.');
            return;
        }

        $verif = $this->db->prepare('SELECT id FROM utilisateur WHERE email = :email LIMIT 1');
        $verif->execute([':email' => $email]);
        if ($verif->fetch()) {
            $this->repondreJson(409, 'erreur', 'Un compte existe déjà avec cette adresse e-mail.');
            return;
        }

        // Hachage bcrypt obligatoire
        $hash = password_hash($motDePasse, PASSWORD_BCRYPT);

        // Rôle verrouillé côté serveur sur 'client'
        $insert = $this->db->prepare('
            INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, adresse_postale, code_postal, ville, role)
            VALUES (:nom, :prenom, :email, :pass, :tel, :adresse, :cp, :ville, :role)
        ');

        $succes = $insert->execute([
            ':nom'     => $nom,
            ':prenom'  => $prenom,
            ':email'   => $email,
            ':pass'    => $hash,
            ':tel'     => $telephone,
            ':adresse' => $adresse,
            ':cp'      => $cp ?: '33000',
            ':ville'   => $ville ?: 'Bordeaux',
            ':role'    => 'client'
        ]);

        if (!$succes) {
            $this->repondreJson(500, 'erreur', 'Erreur serveur lors de la création du compte.');
            return;
        }

        $this->envoyerMailBienvenue($email, $prenom);

        $this->repondreJson(201, 'succes', 'Votre compte a été créé avec succès ! Un e-mail de bienvenue vous a été envoyé.');
    }

    /**
     * Endpoint : POST /api/auth/forgot-password
     */
    public function forgotPassword(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $email = filter_var(trim($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);

        if (!$email) {
            $this->repondreJson(422, 'erreur', 'Adresse e-mail invalide.');
            return;
        }

        // Protection OWASP : toujours répondre avec succès pour éviter l'énumération des comptes
        $stmt = $this->db->prepare('SELECT id, prenom FROM utilisateur WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if ($user) {
            $tokenReinit = bin2hex(random_bytes(24));
            $sujet = 'Réinitialisation de votre mot de passe - Vite & Gourmand';
            $message = "Bonjour {$user['prenom']},\n\nPour réinitialiser votre mot de passe, cliquez sur le lien suivant :\nhttps://vite-gourmand-a0uf.onrender.com/reset-password.html?token={$tokenReinit}\n\nCe lien expire dans 1 heure.";
            @mail($email, $sujet, $message, 'From: contact@vitegourmand.fr');
        }

        $this->repondreJson(200, 'succes', 'Si cette adresse correspond à un compte, un lien de réinitialisation vient de vous être envoyé par e-mail.');
    }

    private function envoyerMailBienvenue(string $email, string $prenom): void
    {
        $sujet = 'Bienvenue chez Vite & Gourmand !';
        $corps = "Bonjour {$prenom},\n\nNous sommes ravis de vous compter parmi nos clients. Découvrez dès à présent nos menus faits maison par Julie & José sur notre site.";
        $headers = 'From: contact@vitegourmand.fr' . "\r\n" . 'Reply-To: contact@vitegourmand.fr' . "\r\n" . 'X-Mailer: PHP/' . phpversion();
        @mail($email, $sujet, $corps, $headers);
    }

    private function repondreJson(int $code, string $statut, string $message, array $extra = []): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array_merge([
            'statut'  => $statut,
            'message' => $message
        ], $extra), JSON_UNESCAPED_UNICODE);
    }
}