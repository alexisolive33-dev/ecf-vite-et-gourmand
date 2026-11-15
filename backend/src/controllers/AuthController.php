<?php

namespace App\Controllers;

use App\Config\Database;
use App\Models\UserModel;
use App\Security\AuthGuard;
use PDO;

class AuthController
{
    private PDO $db;
    private UserModel $userModel;

    public function __construct()
    {
        $this->db = Database::getConnection();
        $this->userModel = new UserModel();
    }

    /**
     * Vérifie que l'utilisateur connecté possède le rôle 'admin'
     */
    private function requireAdminOnly(): ?array
    {
        $authUser = AuthGuard::getAuthenticatedUser();
        if (!$authUser || ($authUser['role'] ?? '') !== 'admin') {
            $this->repondreJson(403, 'erreur', 'Action strictement réservée à l’administrateur (José).');
            return null;
        }
        return $authUser;
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

        if (isset($user['est_actif']) && (int)$user['est_actif'] === 0) {
            $this->repondreJson(403, 'erreur', 'Votre compte a été désactivé par l\'administrateur. Veuillez contacter la direction.');
            return;
        }

        $token = AuthGuard::generateToken($user);

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

        $hash = password_hash($motDePasse, PASSWORD_BCRYPT);

        $insert = $this->db->prepare('
            INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, adresse_postale, code_postal, ville, role, est_actif)
            VALUES (:nom, :prenom, :email, :pass, :tel, :adresse, :cp, :ville, :role, 1)
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
     * Endpoint Admin : GET /api/admin/employes
     */
    public function adminListEmployes(): void
    {
        if (!$this->requireAdminOnly()) return;

        $employes = $this->userModel->findAllEmployes();
        $this->repondreJson(200, 'succes', 'Liste des employés récupérée', [
            'employes' => $employes
        ]);
    }

    /**
     * Endpoint Admin : POST /api/admin/employes
     * Crée un compte de type 'employe' (jamais 'admin') et notifie par mail sans le mot de passe
     */
    public function adminCreateEmploye(): void
    {
        if (!$this->requireAdminOnly()) return;

        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (isset($data['role']) && strtolower(trim((string)$data['role'])) === 'admin') {
            $this->repondreJson(403, 'erreur', 'La création d\'un compte Administrateur est strictement interdite depuis l\'application.');
            return;
        }

        $email = filter_var(trim($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
        $motDePasse = (string)($data['mot_de_passe'] ?? '');
        $prenom = trim($data['prenom'] ?? '');
        $nom = trim($data['nom'] ?? '');

        if (!$email || $motDePasse === '') {
            $this->repondreJson(422, 'erreur', 'L\'adresse e-mail (identifiant) et le mot de passe sont obligatoires.');
            return;
        }

        $regexSecurite = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{10,}$/';
        if (!preg_match($regexSecurite, $motDePasse)) {
            $this->repondreJson(422, 'erreur', 'Le mot de passe doit contenir au minimum 10 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.');
            return;
        }

        if ($this->userModel->findByEmail($email)) {
            $this->repondreJson(409, 'erreur', 'Un compte utilise déjà cette adresse e-mail.');
            return;
        }

        $hash = password_hash($motDePasse, PASSWORD_BCRYPT);
        $newId = $this->userModel->createEmploye($email, $hash, $prenom, $nom);

        // Notification par mail SANS communiquer le mot de passe (exigence ECF)
        $sujet = 'Création de votre compte collaborateur - Vite & Gourmand';
        $corps = "Bonjour,\n\nUn compte collaborateur (rôle : employé) vient d'être créé pour vous sur la plateforme Vite & Gourmand avec l'identifiant : {$email}.\n\nPour des raisons de sécurité, votre mot de passe n'est pas communiqué dans cet e-mail. Veuillez vous rapprocher directement de l'administrateur (José) afin de l'obtenir.";
        @mail($email, $sujet, $corps, 'From: contact@vitegourmand.fr');

        $this->repondreJson(201, 'succes', "Compte employé créé avec succès pour {$email}. Un e-mail de notification (sans le mot de passe) lui a été envoyé ; il devra se rapprocher de vous pour obtenir son mot de passe.", [
            'id' => $newId
        ]);
    }

    /**
     * Endpoint Admin : PUT /api/admin/employes/{id}/statut
     * Rend un compte employé inutilisable (ou le réactive)
     */
    public function adminToggleEmployeStatut(int $id): void
    {
        if (!$this->requireAdminOnly()) return;

        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $estActif = isset($data['est_actif']) ? (bool)$data['est_actif'] : false;

        $updated = $this->userModel->setEmployeActif($id, $estActif);
        if (!$updated) {
            $this->repondreJson(404, 'erreur', 'Compte employé introuvable ou déjà dans cet état.');
            return;
        }

        $msg = $estActif
            ? "Le compte employé #$id a été réactivé."
            : "Le compte employé #$id a été désactivé et rendu inutilisable.";

        $this->repondreJson(200, 'succes', $msg);
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