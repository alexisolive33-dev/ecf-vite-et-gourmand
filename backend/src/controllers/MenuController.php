<?php

namespace App\Controllers;

use App\Models\MenuModel;
use App\Models\MenuViewRepository;

class MenuController
{
    private MenuModel $menuModel;
    private MenuViewRepository $mongoRepo;

    public function __construct()
    {
        $this->menuModel = new MenuModel();
        $this->mongoRepo = new MenuViewRepository();
    }

    /**
     * Endpoint : GET /api/menus
     */
    public function index(): void
    {
        $menus = $this->menuModel->findAllActive();

        http_response_code(200);
        echo json_encode([
            'statut' => 'succes',
            'resultats' => count($menus),
            'donnees' => $menus
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Endpoint : GET /api/menus/{id}
     */
    public function show(int $id): void
    {
        $menu = $this->menuModel->findById($id);

        if (!$menu) {
            http_response_code(404);
            echo json_encode([
                'statut' => 'erreur',
                'message' => "Le menu #$id est introuvable ou inactif."
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            return;
        }

        // Enregistrement de la consultation dans MongoDB (NoSQL)
        $this->mongoRepo->enregistrerVue((int)$menu['id'], (string)$menu['titre']);

        http_response_code(200);
        echo json_encode([
            'statut' => 'succes',
            'donnees' => $menu
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Endpoint : GET /api/stats/popularite
     */
    public function popularite(): void
    {
        $stats = $this->mongoRepo->getStatistiquesPopularite();

        http_response_code(200);
        echo json_encode([
            'statut' => 'succes',
            'base' => 'MongoDB (NoSQL)',
            'collection' => 'menu_views',
            'donnees' => $stats
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
}