<?php

namespace App\Controllers;

use App\Models\MenuModel;
use App\Models\MenuViewRepository;
use PDOException;
use Throwable;

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
        $menus = $this->menuModel->findAllActive();

        $titresSql = [];
        foreach ($menus as $m) {
            $titresSql[(int)$m['id']] = (string)$m['titre'];
        }

        foreach ($stats as &$stat) {
            $id = (int)($stat['menu_id'] ?? 0);
            if (isset($titresSql[$id])) {
                $stat['titre'] = $titresSql[$id];
            }
        }
        unset($stat);

        http_response_code(200);
        echo json_encode([
            'statut' => 'succes',
            'base' => 'MongoDB (NoSQL)',
            'collection' => 'menu_views',
            'donnees' => $stats
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Endpoint Back-Office : GET /api/admin/menus/referentiel
     */
    public function referentiel(): void
    {
        $data = $this->menuModel->getReferentielPlatsEtAllergenes();
        http_response_code(200);
        echo json_encode([
            'statut' => 'succes',
            'plats' => $data['plats'],
            'allergenes' => $data['allergenes']
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Endpoint Back-Office : POST /api/admin/menus
     */
    public function store(): void
    {
        $payload = json_decode(file_get_contents('php://input'), true) ?? [];
        $validation = $this->validerPayloadMenu($payload);

        if ($validation['erreur']) {
            http_response_code(400);
            echo json_encode(['statut' => 'erreur', 'message' => $validation['erreur']], JSON_UNESCAPED_UNICODE);
            return;
        }

        try {
            $id = $this->menuModel->create($validation['data'], $validation['plat_ids']);
            http_response_code(201);
            echo json_encode([
                'statut' => 'succes',
                'message' => 'Menu créé avec succès.',
                'id' => $id
            ], JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            $msg = ($e->getCode() === '23000')
                ? 'Un menu porte déjà ce titre.'
                : 'Erreur lors de la création du menu.';
            http_response_code(400);
            echo json_encode(['statut' => 'erreur', 'message' => $msg], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['statut' => 'erreur', 'message' => 'Erreur serveur lors de la création.'], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * Endpoint Back-Office : PUT /api/admin/menus/{id}
     */
    public function update(int $id): void
    {
        $existant = $this->menuModel->findById($id);
        if (!$existant) {
            http_response_code(404);
            echo json_encode(['statut' => 'erreur', 'message' => 'Menu introuvable.'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $payload = json_decode(file_get_contents('php://input'), true) ?? [];
        $validation = $this->validerPayloadMenu($payload);

        if ($validation['erreur']) {
            http_response_code(400);
            echo json_encode(['statut' => 'erreur', 'message' => $validation['erreur']], JSON_UNESCAPED_UNICODE);
            return;
        }

        try {
            $this->menuModel->update($id, $validation['data'], $validation['plat_ids']);
            http_response_code(200);
            echo json_encode([
                'statut' => 'succes',
                'message' => 'Menu mis à jour avec succès.'
            ], JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            $msg = ($e->getCode() === '23000')
                ? 'Un autre menu utilise déjà ce titre.'
                : 'Erreur lors de la mise à jour du menu.';
            http_response_code(400);
            echo json_encode(['statut' => 'erreur', 'message' => $msg], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['statut' => 'erreur', 'message' => 'Erreur serveur lors de la mise à jour.'], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * Endpoint Back-Office : DELETE /api/admin/menus/{id}
     */
    public function destroy(int $id): void
    {
        try {
            $mode = $this->menuModel->delete($id);
            http_response_code(200);
            echo json_encode([
                'statut' => 'succes',
                'message' => $mode === 'archive'
                    ? 'Menu retiré du catalogue (archivé pour préserver l’historique des commandes).'
                    : 'Menu supprimé définitivement.'
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['statut' => 'erreur', 'message' => 'Impossible de supprimer ce menu.'], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * Endpoint Back-Office : POST /api/admin/plats
     */
    public function storePlat(): void
    {
        $payload = json_decode(file_get_contents('php://input'), true) ?? [];
        $nom = trim((string)($payload['nom'] ?? ''));
        $categorie = trim((string)($payload['categorie'] ?? ''));
        $description = trim((string)($payload['description'] ?? ''));
        $allergeneIds = is_array($payload['allergene_ids'] ?? null) ? $payload['allergene_ids'] : [];

        if ($nom === '' || !in_array($categorie, ['entree', 'plat', 'dessert'], true)) {
            http_response_code(400);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Veuillez renseigner un nom de plat et une catégorie valide (entrée, plat ou dessert).'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        try {
            $platId = $this->menuModel->createPlat($nom, $categorie, $description, $allergeneIds);
            http_response_code(201);
            echo json_encode([
                'statut' => 'succes',
                'message' => 'Plat ajouté au référentiel.',
                'id' => $platId
            ], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['statut' => 'erreur', 'message' => 'Erreur lors de la création du plat.'], JSON_UNESCAPED_UNICODE);
        }
    }

    private function validerPayloadMenu(array $payload): array
    {
        $titre = trim((string)($payload['titre'] ?? ''));
        $description = trim((string)($payload['description'] ?? ''));
        $imageUrl = trim((string)($payload['image_url'] ?? ''));
        $prixUnitaire = (float)($payload['prix_unitaire_ttc'] ?? 0);
        $convivesMin = (int)($payload['convives_min'] ?? 4);
        $stockDisponible = (int)($payload['stock_disponible'] ?? 0);
        $theme = trim((string)($payload['theme'] ?? 'classique'));
        $regime = trim((string)($payload['regime'] ?? 'classique'));
        $delaiMinJours = (int)($payload['delai_min_jours'] ?? 7);
        $conditionsStockage = trim((string)($payload['conditions_stockage'] ?? 'Conserver entre 0°C et +4°C'));
        $platIds = is_array($payload['plat_ids'] ?? null) ? $payload['plat_ids'] : [];

        if ($titre === '' || $description === '') {
            return ['erreur' => 'Le titre et la description du menu sont obligatoires.'];
        }
        if ($imageUrl === '') {
            $imageUrl = 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=80';
        }
        if ($prixUnitaire <= 0) {
            return ['erreur' => 'Le prix unitaire TTC doit être supérieur à 0 €.'];
        }
        if ($convivesMin < 1) {
            return ['erreur' => 'Le nombre minimum de convives doit être au moins 1.'];
        }
        if ($stockDisponible < 0) {
            return ['erreur' => 'Le stock disponible ne peut pas être négatif.'];
        }
        if (!in_array($theme, ['noel', 'paques', 'classique', 'evenement'], true)) {
            return ['erreur' => 'Thème invalide.'];
        }
        if (!in_array($regime, ['classique', 'vegetarien', 'vegan'], true)) {
            return ['erreur' => 'Régime alimentaire invalide.'];
        }
        if ($delaiMinJours < 0) {
            $delaiMinJours = 0;
        }
        if ($conditionsStockage === '') {
            $conditionsStockage = 'Conserver entre 0°C et +4°C';
        }

        return [
            'erreur' => null,
            'data' => [
                'titre' => $titre,
                'description' => $description,
                'image_url' => $imageUrl,
                'prix_unitaire_ttc' => round($prixUnitaire, 2),
                'convives_min' => $convivesMin,
                'stock_disponible' => $stockDisponible,
                'theme' => $theme,
                'regime' => $regime,
                'delai_min_jours' => $delaiMinJours,
                'conditions_stockage' => $conditionsStockage
            ],
            'plat_ids' => $platIds
        ];
    }

    /**
     * Endpoint : GET /api/horaires
     */
    public function horaires(): void
    {
        $pdo = \App\Config\Database::getConnection();
        $stmt = $pdo->query("SELECT id, jour_semaine, heures_ouverture, ordre FROM horaire ORDER BY ordre ASC, id ASC");
        $horaires = $stmt->fetchAll();

        http_response_code(200);
        echo json_encode([
            'statut'   => 'succes',
            'horaires' => $horaires
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Endpoint Back-Office : PUT /api/admin/horaires
     */
    public function updateHoraires(): void
    {
        $payload = json_decode(file_get_contents('php://input'), true) ?? [];
        $liste = $payload['horaires'] ?? [];

        if (!is_array($liste) || empty($liste)) {
            http_response_code(400);
            echo json_encode(['statut' => 'erreur', 'message' => 'Liste des horaires manquante.'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $pdo = \App\Config\Database::getConnection();
        $stmt = $pdo->prepare("UPDATE horaire SET heures_ouverture = :heures WHERE id = :id");

        foreach ($liste as $item) {
            $id = (int)($item['id'] ?? 0);
            $heures = trim((string)($item['heures_ouverture'] ?? ''));
            if ($id > 0 && $heures !== '') {
                $stmt->execute([':heures' => $heures, ':id' => $id]);
            }
        }

        http_response_code(200);
        echo json_encode([
            'statut'  => 'succes',
            'message' => 'Les horaires d’ouverture ont été mis à jour.'
        ], JSON_UNESCAPED_UNICODE);
    }
}