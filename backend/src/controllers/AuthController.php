<?php

namespace App\Controllers;

use App\Models\UserModel;

class AuthController
{
    private UserModel $userModel;

    public function __construct()
    {
        $this->userModel = new UserModel();
    }

    /**
     * Endpoint : POST /api/auth/login
     */
    public function login(): void
    {
        $donnees = json_decode(file_get_contents('php://input'), true);

        if (!$donnees) {
            http_response_code(400);
            echo json_encode(['statut' => 'erreur', 'message' => 'Corps JSON invalide'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $email = trim($donnees['email'] ?? '');
        $motDePasse = (string) ($donnees['mot_de_passe'] ?? '');

        if (empty($email) || empty($motDePasse)) {
            http_response_code(422);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'L\'adresse e-mail et le mot de passe sont obligatoires.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $user = $this->userModel->findByEmail($email);

        // Vérification sécurisée du mot de passe haché (bcrypt)
        if (!$user || !password_verify($motDePasse, $user['mot_de_passe'])) {
            http_response_code(401);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Identifiants invalides.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        // Génération d'un jeton de session factice / token sécurisé pour le front-end
        $token = bin2hex(random_bytes(32));

        http_response_code(200);
        echo json_encode([
            'statut'  => 'succes',
            'message' => 'Connexion réussie',
            'token'   => $token,
            'utilisateur' => [
                'id'     => (int) $user['id'],
                'nom'    => $user['nom'],
                'prenom' => $user['prenom'],
                'email'  => $user['email'],
                'role'   => $user['role']
            ]
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
}