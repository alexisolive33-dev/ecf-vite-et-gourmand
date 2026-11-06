<?php

namespace App\Controllers;

use App\Models\MenuModel;
use App\Models\CommandeModel;
use App\Services\OrderCalculatorService;
use Exception;

class CommandeController
{
    private MenuModel $menuModel;
    private CommandeModel $commandeModel;
    private OrderCalculatorService $calculator;

    public function __construct()
    {
        $this->menuModel = new MenuModel();
        $this->commandeModel = new CommandeModel();
        $this->calculator = new OrderCalculatorService();
    }

    /**
     * Endpoint : GET /api/admin/commandes
     */
    public function adminIndex(): void
    {
        $commandes = $this->commandeModel->findAll();

        http_response_code(200);
        echo json_encode([
            'statut'    => 'succes',
            'total'     => count($commandes),
            'commandes' => $commandes
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Endpoint : PUT /api/admin/commandes/{id}/statut
     */
    public function updateStatut(int $id): void
    {
        $donnees = json_decode(file_get_contents('php://input'), true);

        if (!$donnees || empty($donnees['statut'])) {
            http_response_code(400);
            echo json_encode([
                'statut'  => 'erreur',
                'message' => 'Le champ statut est requis dans le corps JSON.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        try {
            $succes = $this->commandeModel->updateStatut($id, (string)$donnees['statut']);

            http_response_code(200);
            echo json_encode([
                'statut'         => 'succes',
                'message'        => "Le statut de la commande #$id a été mis à jour.",
                'nouveau_statut' => $donnees['statut']
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            http_response_code(422);
            echo json_encode([
                'statut'  => 'erreur',
                'message' => $e->getMessage()
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * Endpoint : POST /api/commandes/simuler
     */
    public function simuler(): void
    {
        $donnees = json_decode(file_get_contents('php://input'), true);

        if (!$donnees) {
            http_response_code(400);
            echo json_encode(['statut' => 'erreur', 'message' => 'Corps JSON invalide'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $menuId = (int) ($donnees['menu_id'] ?? 0);
        $nbConvives = (int) ($donnees['nb_convives'] ?? 0);
        $distanceKm = (float) ($donnees['distance_km'] ?? 0);
        $dateLivraison = (string) ($donnees['date_livraison'] ?? '');
        $ville = (string) ($donnees['ville'] ?? '');

        $menu = $this->menuModel->findById($menuId);

        if (!$menu) {
            http_response_code(404);
            echo json_encode(['statut' => 'erreur', 'message' => 'Menu non trouvé'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $resultat = $this->calculator->calculer($menu, $nbConvives, $distanceKm, $dateLivraison, $ville);

        if (!$resultat['valide']) {
            http_response_code(422);
            echo json_encode(['statut' => 'invalide', 'erreurs' => $resultat['erreurs']], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(200);
        echo json_encode(['statut' => 'succes', 'simulation' => $resultat['details']], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Endpoint : POST /api/commandes
     */
    public function creer(): void
    {
        $donnees = json_decode(file_get_contents('php://input'), true);

        if (!$donnees) {
            http_response_code(400);
            echo json_encode(['statut' => 'erreur', 'message' => 'Corps JSON invalide'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $menuId = (int) ($donnees['menu_id'] ?? 0);
        $nbConvives = (int) ($donnees['nb_convives'] ?? 0);
        $distanceKm = (float) ($donnees['distance_km'] ?? 0);
        $dateLivraison = (string) ($donnees['date_livraison'] ?? '');
        $ville = (string) ($donnees['ville'] ?? '');

        $menu = $this->menuModel->findById($menuId);

        if (!$menu) {
            http_response_code(404);
            echo json_encode(['statut' => 'erreur', 'message' => 'Menu introuvable'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $simulation = $this->calculator->calculer($menu, $nbConvives, $distanceKm, $dateLivraison, $ville);

        if (!$simulation['valide']) {
            http_response_code(422);
            echo json_encode(['statut' => 'invalide', 'erreurs' => $simulation['erreurs']], JSON_UNESCAPED_UNICODE);
            return;
        }

        try {
            $clientInfos = [
                'utilisateur_id'    => (int) ($donnees['utilisateur_id'] ?? 2),
                'adresse_livraison' => (string) ($donnees['adresse_livraison'] ?? '14 Avenue du Château'),
                'code_postal'       => (string) ($donnees['code_postal'] ?? '33700')
            ];

            $commandeCreee = $this->commandeModel->creerCommande($clientInfos, $simulation['details']);

            http_response_code(201);
            echo json_encode([
                'statut'   => 'succes',
                'message'  => 'Commande enregistrée avec succès',
                'commande' => array_merge($commandeCreee, [
                    'details_calcul' => $simulation['details']
                ])
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            http_response_code(409);
            echo json_encode([
                'statut'  => 'erreur',
                'message' => $e->getMessage()
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
    }
}