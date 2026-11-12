<?php

namespace App\Controllers;

use App\Models\AvisModel;

class AvisController
{
    private AvisModel $avisModel;

    public function __construct()
    {
        $this->avisModel = new AvisModel();
    }

    /**
     * GET /api/avis (Avis validés pour la page d'accueil)
     */
    public function index(): void
    {
        try {
            $avis = $this->avisModel->getAvisValides();
            echo json_encode([
                'statut' => 'succes',
                'avis' => $avis,
                'donnees' => $avis
            ], JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Impossible de récupérer les avis clients.'
            ], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * POST /api/avis (Dépôt d'un avis par un client)
     */
    public function creer(): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $note = isset($input['note']) ? (int)$input['note'] : 0;
        $commentaire = trim((string)($input['commentaire'] ?? ''));

        if ($note < 1 || $note > 5) {
            http_response_code(400);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'La note doit être comprise entre 1 et 5.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        if (mb_strlen($commentaire) < 5) {
            http_response_code(400);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Veuillez saisir un commentaire d\'au moins 5 caractères.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        try {
            $resultat = $this->avisModel->creerAvis($input);

            if (!$resultat['succes']) {
                http_response_code(409);
                echo json_encode([
                    'statut' => 'erreur',
                    'message' => $resultat['message']
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            http_response_code(201);
            echo json_encode([
                'statut' => 'succes',
                'message' => 'Votre avis a bien été enregistré et sera publié après modération.',
                'id' => $resultat['id']
            ], JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Erreur serveur lors de l\'enregistrement de l\'avis.'
            ], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * GET /api/admin/avis (Liste complète pour modération équipe)
     */
    public function adminIndex(): void
    {
        try {
            $avis = $this->avisModel->getAllAvis();
            echo json_encode([
                'statut' => 'succes',
                'avis' => $avis,
                'donnees' => $avis
            ], JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Erreur lors du chargement des avis pour modération.'
            ], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * PUT /api/admin/avis/{id}/valider
     */
    public function valider(int $id): void
    {
        try {
            $this->avisModel->validerAvis($id);
            echo json_encode([
                'statut' => 'succes',
                'message' => 'Avis validé et publié sur la page d\'accueil.'
            ], JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Impossible de valider cet avis.'
            ], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * DELETE /api/admin/avis/{id}
     */
    public function supprimer(int $id): void
    {
        try {
            $this->avisModel->supprimerAvis($id);
            echo json_encode([
                'statut' => 'succes',
                'message' => 'Avis supprimé avec succès.'
            ], JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Impossible de supprimer cet avis.'
            ], JSON_UNESCAPED_UNICODE);
        }
    }
}