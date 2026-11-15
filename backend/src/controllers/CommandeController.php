<?php

namespace App\Controllers;

use App\Models\MenuModel;
use App\Models\CommandeModel;
use App\Services\OrderCalculatorService;
use App\Security\AuthGuard;
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
            $this->commandeModel->updateStatut($id, (string)$donnees['statut']);

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
     * Endpoint : PUT /api/commandes/{id} (Modification tant que la commande est en attente, sauf le menu)
     */
    public function modifier(int $id): void
    {
        header('Content-Type: application/json; charset=utf-8');
        $donnees = json_decode(file_get_contents('php://input'), true);

        if (!$donnees) {
            http_response_code(400);
            echo json_encode(['statut' => 'erreur', 'message' => 'Corps JSON invalide.'], JSON_UNESCAPED_UNICODE);
            return;
        }

        $authUser = AuthGuard::getAuthenticatedUser();
        $userId = $authUser ? (int)$authUser['id'] : (int)($donnees['utilisateur_id'] ?? 0);
        $isStaff = $authUser && in_array($authUser['role'], ['admin', 'employe'], true);

        if (!$isStaff && $userId <= 0) {
            http_response_code(401);
            echo json_encode(['statut' => 'erreur', 'message' => 'Authentification requise.'], JSON_UNESCAPED_UNICODE);
            return;
        }

        try {
            $pdo = $this->getPdo();
            $stmtMenuId = $pdo->prepare("SELECT menu_id FROM ligne_commande WHERE commande_id = :id LIMIT 1");
            $stmtMenuId->execute([':id' => $id]);
            $ligne = $stmtMenuId->fetch(PDO::FETCH_ASSOC);

            if (!$ligne) {
                http_response_code(404);
                echo json_encode(['statut' => 'erreur', 'message' => 'Ligne de commande introuvable.'], JSON_UNESCAPED_UNICODE);
                return;
            }

            $menu = $this->menuModel->findById((int)$ligne['menu_id']);
            if (!$menu) {
                http_response_code(404);
                echo json_encode(['statut' => 'erreur', 'message' => 'Le menu associé n’est plus disponible.'], JSON_UNESCAPED_UNICODE);
                return;
            }

            $nbConvives = (int)($donnees['nb_convives'] ?? 0);
            $distanceKm = (float)($donnees['distance_km'] ?? 0);
            $dateLivraison = trim((string)($donnees['date_livraison'] ?? ''));
            $ville = trim((string)($donnees['ville_livraison'] ?? $donnees['ville'] ?? ''));
            $adresse = trim((string)($donnees['adresse_livraison'] ?? ''));

            if ($adresse === '' || $ville === '') {
                http_response_code(422);
                echo json_encode(['statut' => 'erreur', 'message' => 'L’adresse et la ville de livraison sont obligatoires.'], JSON_UNESCAPED_UNICODE);
                return;
            }

            $simulation = $this->calculator->calculer($menu, $nbConvives, $distanceKm, $dateLivraison, $ville);

            if (!$simulation['valide']) {
                http_response_code(422);
                echo json_encode([
                    'statut'  => 'invalide',
                    'message' => implode(' ', $simulation['erreurs']),
                    'erreurs' => $simulation['erreurs']
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            $resultat = $this->commandeModel->modifierCommande($id, $userId, $simulation['details'], $adresse, $isStaff);

            http_response_code(200);
            echo json_encode([
                'statut'   => 'succes',
                'message'  => 'Votre commande a été modifiée avec succès.',
                'commande' => $resultat,
                'details_calcul' => $simulation['details']
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            $code = in_array($e->getCode(), [403, 404, 422], true) ? $e->getCode() : 500;
            http_response_code($code);
            echo json_encode([
                'statut'  => 'erreur',
                'message' => $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
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

            $stmt = $pdo->prepare("
                SELECT c.*, 
                       lc.menu_id,
                       COALESCE(lc.nb_convives, 0) AS nb_convives,
                       c.date_livraison_souhaitee AS date_livraison,
                       COALESCE(m.titre, 'Formule Traiteur') AS menu_titre, 
                       m.convives_min,
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

            // Récupération de l'historique horodaté des statuts pour chaque commande
            $stmtHist = null;
            try {
                $stmtHist = $pdo->prepare("
                    SELECT statut, date_changement
                    FROM commande_historique
                    WHERE commande_id = :cid
                    ORDER BY date_changement ASC, id ASC
                ");
            } catch (Exception $eHistInit) {
                $stmtHist = null;
            }

            foreach ($commandes as &$cmd) {
                $historique = [];
                if ($stmtHist) {
                    try {
                        $stmtHist->execute([':cid' => $cmd['id']]);
                        $historique = $stmtHist->fetchAll(PDO::FETCH_ASSOC);
                    } catch (Exception $eHistExec) {
                        $historique = [];
                    }
                }
                if (empty($historique)) {
                    $historique = [[
                        'statut'          => $cmd['statut'],
                        'date_changement' => $cmd['date_commande']
                    ]];
                }
                $cmd['historique'] = $historique;
            }
            unset($cmd);

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

        $authUser = AuthGuard::getAuthenticatedUser();
        $effectiveUserId = $authUser ? (int)$authUser['id'] : $userId;
        $isStaff = $authUser && in_array($authUser['role'], ['admin', 'employe'], true);

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

            if (!$isStaff && ($effectiveUserId <= 0 || (int)$cmd['utilisateur_id'] !== $effectiveUserId)) {
                http_response_code(403);
                echo json_encode(['statut' => 'erreur', 'message' => 'Action non autorisée sur cette commande.'], JSON_UNESCAPED_UNICODE);
                return;
            }

            $statutActuel = mb_strtolower(trim($cmd['statut'] ?? ''));
            $statutNettoye = str_replace(['_', ' '], '', $statutActuel);

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

            $update = $pdo->prepare("UPDATE commande SET statut = 'annulee' WHERE id = :id");
            $update->execute([':id' => $id]);

            try {
                $stmtHist = $pdo->prepare("INSERT INTO commande_historique (commande_id, statut, date_changement) VALUES (:id, 'annulee', NOW())");
                $stmtHist->execute([':id' => $id]);
            } catch (Exception $eHist) {
            }

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
        $authUser = AuthGuard::getAuthenticatedUser();
        if ($authUser && $authUser['role'] === 'client' && (int)$authUser['id'] !== $id) {
            http_response_code(403);
            echo json_encode(['statut' => 'erreur', 'message' => 'Modification non autorisée sur ce profil.'], JSON_UNESCAPED_UNICODE);
            return;
        }

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
                $regexSecurite = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{10,}$/';
                if (!preg_match($regexSecurite, (string)$donnees['nouveau_mot_de_passe'])) {
                    http_response_code(422);
                    echo json_encode([
                        'statut' => 'erreur',
                        'message' => 'Le nouveau mot de passe doit contenir au minimum 10 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.'
                    ], JSON_UNESCAPED_UNICODE);
                    return;
                }
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