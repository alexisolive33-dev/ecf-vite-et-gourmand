<?php

namespace App\Controllers;

use App\Models\MenuModel;
use App\Models\CommandeModel;
use App\Services\OrderCalculatorService;
use App\Config\Database;
use Exception;
use PDO;

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
     * Helper de connexion PDO résilient
     */
    private function getPdo(): PDO
    {
        if (class_exists('\\App\\Config\\Database')) {
            return \App\Config\Database::getInstance()->getConnection();
        }
        if (class_exists('\\Database')) {
            return \Database::getInstance()->getConnection();
        }
        throw new Exception("Connexion à la base de données indisponible.");
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

    /**
     * Endpoint : GET /api/commandes/mes-commandes?utilisateur_id=X
     * Récupère la liste des commandes de l'utilisateur connecté
     */
    public function mesCommandes(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $userId = isset($_GET['utilisateur_id']) ? (int)$_GET['utilisateur_id'] : 0;

        if ($userId <= 0) {
            http_response_code(400);
            echo json_encode([
                'statut' => 'erreur',
                'message' => 'Identifiant utilisateur requis.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        try {
            $pdo = $this->getPdo();
            $stmt = $pdo->prepare("
                SELECT c.*, m.titre AS menu_titre, m.theme, m.image_url
                FROM commande c
                LEFT JOIN menu m ON c.menu_id = m.id
                WHERE c.utilisateur_id = :uid
                ORDER BY c.id DESC
            ");
            $stmt->execute([':uid' => $userId]);
            $commandes = $stmt->fetchAll(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode([
                'statut'    => 'succes',
                'total'     => count($commandes),
                'commandes' => $commandes
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'statut'  => 'erreur',
                'message' => 'Erreur lors de la récupération des commandes : ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * Endpoint : PUT /api/commandes/{id}/annuler
     * Annule une commande si elle n'a pas encore été acceptée par l'équipe
     */
    public function annulerCommande(int $id): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $donnees = json_decode(file_get_contents('php://input'), true) ?? [];
        $userId = (int)($donnees['utilisateur_id'] ?? 0);

        try {
            $pdo = $this->getPdo();

            $stmt = $pdo->prepare("SELECT id, statut, utilisateur_id FROM commande WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $cmd = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$cmd) {
                http_response_code(404);
                echo json_encode(['statut' => 'erreur', 'message' => 'Commande introuvable.'], JSON_UNESCAPED_UNICODE);
                return;
            }

            if ($userId > 0 && (int)$cmd['utilisateur_id'] !== $userId) {
                http_response_code(403);
                echo json_encode(['statut' => 'erreur', 'message' => 'Action non autorisée sur cette commande.'], JSON_UNESCAPED_UNICODE);
                return;
            }

            // Statuts bloquants selon le sujet ECF (Page 7)
            $statutsBloquants = ['accepté', 'accepte', 'en préparation', 'en cours de livraison', 'livré', 'livre', 'terminée', 'terminee'];
            if (in_array(mb_strtolower(trim($cmd['statut'])), $statutsBloquants, true)) {
                http_response_code(422);
                echo json_encode([
                    'statut'  => 'erreur',
                    'message' => 'Impossible d\'annuler la commande : celle-ci a déjà été acceptée ou prise en charge par Julie & José.'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            $update = $pdo->prepare("UPDATE commande SET statut = 'annulée' WHERE id = :id");
            $update->execute([':id' => $id]);

            http_response_code(200);
            echo json_encode([
                'statut'  => 'succes',
                'message' => "La commande #$id a bien été annulée."
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['statut' => 'erreur', 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * Endpoint : PUT /api/utilisateurs/me
     * Permet au client de mettre à jour ses coordonnées personnelles
     */
    public function updateProfil(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $donnees = json_decode(file_get_contents('php://input'), true);

        if (!$donnees || empty($donnees['id'])) {
            http_response_code(400);
            echo json_encode(['statut' => 'erreur', 'message' => 'Identifiant utilisateur requis.'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $id = (int)$donnees['id'];
        $nom = trim($donnees['nom'] ?? '');
        $prenom = trim($donnees['prenom'] ?? '');
        $telephone = trim($donnees['telephone'] ?? '');
        $adresse = trim($donnees['adresse_postale'] ?? '');
        $ville = trim($donnees['ville'] ?? '');
        $codePostal = trim($donnees['code_postal'] ?? '');

        try {
            $pdo = $this->getPdo();

            // Tolérance automatique du nom de clé primaire (id ou utilisateur_id)
            $colId = 'id';
            try {
                $check = $pdo->query("SHOW COLUMNS FROM utilisateur LIKE 'utilisateur_id'");
                if ($check && $check->rowCount() > 0) {
                    $checkId = $pdo->query("SHOW COLUMNS FROM utilisateur LIKE 'id'");
                    if (!$checkId || $checkId->rowCount() === 0) {
                        $colId = 'utilisateur_id';
                    }
                }
            } catch (Exception $e) {
                $colId = 'id';
            }

            $champs = [];
            $params = [':id' => $id];

            if ($nom !== '') { $champs[] = "nom = :nom"; $params[':nom'] = $nom; }
            if ($prenom !== '') { $champs[] = "prenom = :prenom"; $params[':prenom'] = $prenom; }
            if ($telephone !== '') { $champs[] = "telephone = :tel"; $params[':tel'] = $telephone; }
            if ($adresse !== '') { $champs[] = "adresse_postale = :adresse"; $params[':adresse'] = $adresse; }
            if ($ville !== '') { $champs[] = "ville = :ville"; $params[':ville'] = $ville; }
            if ($codePostal !== '') { $champs[] = "code_postal = :cp"; $params[':cp'] = $codePostal; }

            if (!empty($donnees['nouveau_mot_de_passe'])) {
                $champs[] = "mot_de_passe = :pwd";
                $params[':pwd'] = password_hash($donnees['nouveau_mot_de_passe'], PASSWORD_BCRYPT);
            }

            if (empty($champs)) {
                http_response_code(400);
                echo json_encode(['statut' => 'erreur', 'message' => 'Aucune information à modifier.'], JSON_UNESCAPED_UNICODE);
                return;
            }

            $sql = "UPDATE utilisateur SET " . implode(', ', $champs) . " WHERE {$colId} = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            // Récupérer le profil actualisé
            $stmtUser = $pdo->prepare("SELECT * FROM utilisateur WHERE {$colId} = :id");
            $stmtUser->execute([':id' => $id]);
            $userUpdated = $stmtUser->fetch(PDO::FETCH_ASSOC);

            if ($userUpdated) {
                unset($userUpdated['mot_de_passe']);
                if (!isset($userUpdated['id']) && isset($userUpdated['utilisateur_id'])) {
                    $userUpdated['id'] = $userUpdated['utilisateur_id'];
                }
            }

            http_response_code(200);
            echo json_encode([
                'statut'  => 'succes',
                'message' => 'Vos informations ont été mises à jour avec succès.',
                'user'    => $userUpdated
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['statut' => 'erreur', 'message' => 'Erreur SQL : ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
    }
}