<?php

namespace App\Controllers;

use App\Models\ContactModel;
use App\Security\AuthGuard;
use Throwable;

class ContactController
{
    private ContactModel $contactModel;

    public function __construct()
    {
        $this->contactModel = new ContactModel();
    }

    /**
     * POST /api/contact (Public)
     */
    public function creer(): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $nomComplet = trim((string)($input['nom_complet'] ?? ''));
        $email = trim((string)($input['email'] ?? ''));
        $telephone = trim((string)($input['telephone'] ?? ''));
        $typeEvenement = trim((string)($input['type_evenement'] ?? 'particulier'));
        $message = trim((string)($input['message'] ?? ''));

        if ($nomComplet === '' || $email === '' || $message === '') {
            http_response_code(400);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Veuillez renseigner votre nom, votre adresse e-mail et votre message.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'L\'adresse e-mail saisie est invalide.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        try {
            $id = $this->contactModel->creer([
                'nom_complet'    => $nomComplet,
                'email'          => $email,
                'telephone'      => $telephone,
                'type_evenement' => $typeEvenement,
                'message'        => $message
            ]);

            http_response_code(201);
            echo json_encode([
                'statut' => 'succes',
                'id' => $id,
                'message' => 'Votre demande a bien été enregistrée et transmise à Julie & José.'
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Impossible d\'enregistrer votre message pour le moment.'
            ], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * GET /api/admin/contacts
     */
    public function adminIndex(): void
    {
        AuthGuard::requireStaff();

        try {
            $messages = $this->contactModel->getAll();
            echo json_encode([
                'statut' => 'succes',
                'contacts' => $messages
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Erreur lors du chargement des messages.'
            ], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * PUT /api/admin/contacts/{id}/traiter
     */
    public function marquerTraite(int $id): void
    {
        AuthGuard::requireStaff();

        if ($this->contactModel->marquerTraite($id)) {
            echo json_encode([
                'statut' => 'succes',
                'message' => 'Demande marquée comme traitée.'
            ], JSON_UNESCAPED_UNICODE);
        } else {
            http_response_code(500);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Échec de la mise à jour.'
            ], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * DELETE /api/admin/contacts/{id}
     */
    public function supprimer(int $id): void
    {
        AuthGuard::requireStaff();

        if ($this->contactModel->supprimer($id)) {
            echo json_encode([
                'statut' => 'succes',
                'message' => 'Message supprimé.'
            ], JSON_UNESCAPED_UNICODE);
        } else {
            http_response_code(500);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Échec de la suppression.'
            ], JSON_UNESCAPED_UNICODE);
        }
    }
}