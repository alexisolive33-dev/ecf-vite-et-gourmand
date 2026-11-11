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
     * Helper de connexion PDO universel et résilient
     */
    private function getPdo(): PDO
    {
        $dbClass = class_exists('\\App\\Config\\Database') ? '\\App\\Config\\Database' : (class_exists('\\Database') ? '\\Database' : null);

        if ($dbClass) {
            if (method_exists($dbClass, 'getConnection')) {
                $refMethod = new \ReflectionMethod($dbClass, 'getConnection');
                return $refMethod->isStatic() ? $dbClass::getConnection() : (new $dbClass())->getConnection();
            }

            if (method_exists($dbClass, 'getInstance')) {
                $instance = $dbClass::getInstance();
                return method_exists($instance, 'getConnection') ? $instance->getConnection() : $instance;
            }

            if (method_exists($dbClass, 'getPdo')) {
                $refMethod = new \ReflectionMethod($dbClass, 'getPdo');
                return $refMethod->isStatic() ? $dbClass::getPdo() : (new $dbClass())->getPdo();
            }

            $instance = new $dbClass();
            if (isset($instance->pdo) && $instance->pdo instanceof PDO) return $instance->pdo;
            if (isset($instance->db) && $instance->db instanceof PDO) return $instance->db;
        }

        if (isset($this->commandeModel)) {
            $ref = new \ReflectionClass($this->commandeModel);
            foreach (['pdo', 'db', 'connection', 'connexion'] as $prop) {
                if ($ref->hasProperty($prop)) {
                    $p = $ref->getProperty($prop);
                    $p->setAccessible(true);
                    $val = $p->getValue($this->commandeModel);
                    if ($val instanceof PDO) return $val;
                }
            }
        }

        throw new Exception("Connexion PDO introuvable.");
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

            // Jointure via ligne_commande avec sélection de nb_convives et date_livraison_souhaitee
            $stmt = $pdo->prepare("
                SELECT c.*, 
                       COALESCE(lc.nb_convives, 0) AS nb_convives,
                       c.date_livraison_souhaitee AS date_livraison,
                       COALESCE(m.titre, 'Formule Traiteur') AS menu_titre, 
                       m.theme, 
                       m.image_url
                FROM commande c
                LEFT JOIN ligne_commande lc ON lc.commande_id = c.id
                LEFT JOIN menu m ON lc.menu_id = m.id
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

            // Normalisation du statut actuel pour vérification
            $statutActuel = mb_strtolower(trim($cmd['statut'] ?? ''));
            $statutNettoye = str_replace(['_', ' '], '', $statutActuel);

            // Annulable uniquement si la commande est encore en attente
            $estEnAttente = in_array($statutActuel, ['en_attente', 'en attente', 'creee', 'cree'], true) 
                         || strpos($statutNettoye, 'attente') !== false;

            if (!$estEnAttente) {
                http_response_code(422);
                echo json_encode([
                    'statut'  => 'erreur',
                    'message' => 'Impossible d\'annuler la commande : celle-ci a déjà été acceptée ou prise en charge par Julie & José.'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            // 1. Mise à jour vers le statut normalisé 'annulee' (sans accent) attendu par CommandeModel
            $update = $pdo->prepare("UPDATE commande SET statut = 'annulee' WHERE id = :id");
            $update->execute([':id' => $id]);

            // 2. Restitution automatique du stock_disponible dans la table menu
            try {
                $stmtLignes = $pdo->prepare("SELECT menu_id FROM ligne_commande WHERE commande_id = :id");
                $stmtLignes->execute([':id' => $id]);
                $lignes = $stmtLignes->fetchAll(PDO::FETCH_ASSOC);

                foreach ($lignes as $ligne) {
                    if (!empty($ligne['menu_id'])) {
                        $stmtUpStock = $pdo->prepare("UPDATE menu SET stock_disponible = stock_disponible + 1 WHERE id = :mid");
                        $stmtUpStock->execute([':mid' => $ligne['menu_id']]);
                    }
                }
            } catch (Exception $eStock) {
                // Secours en cas de structure alternative
            }

            http_response_code(200);
            echo json_encode([
                'statut'  => 'succes',
                'message' => "La commande #$id a bien été annulée et le stock a été restitué."
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['statut' => 'erreur', 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
    }

    /**
     * Endpoint : PUT /api/utilisateurs/me
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