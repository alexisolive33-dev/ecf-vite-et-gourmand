<?php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Chargement des dépendances
require_once __DIR__ . '/../src/config/Database.php';
require_once __DIR__ . '/../src/config/MongoDatabase.php';
require_once __DIR__ . '/../src/security/AuthGuard.php';
require_once __DIR__ . '/../src/models/MenuModel.php';
require_once __DIR__ . '/../src/models/CommandeModel.php';
require_once __DIR__ . '/../src/models/UserModel.php';
require_once __DIR__ . '/../src/models/MenuViewRepository.php';
require_once __DIR__ . '/../src/models/AvisModel.php';
require_once __DIR__ . '/../src/models/ContactModel.php';
require_once __DIR__ . '/../src/services/OrderCalculatorService.php';
require_once __DIR__ . '/../src/controllers/MenuController.php';
require_once __DIR__ . '/../src/controllers/CommandeController.php';
require_once __DIR__ . '/../src/controllers/AuthController.php';
require_once __DIR__ . '/../src/controllers/AvisController.php';
require_once __DIR__ . '/../src/controllers/ContactController.php';

use App\Security\AuthGuard;
use App\Controllers\MenuController;
use App\Controllers\CommandeController;
use App\Controllers\AuthController;
use App\Controllers\AvisController;
use App\Controllers\ContactController;

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Verrouillage centralisé de toutes les routes d'administration (Admin & Employé uniquement)
if (str_starts_with($uri, '/api/admin/')) {
    AuthGuard::requireStaff();
}

// Accueil API
if ($uri === '/') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/index.html');
    exit;
}

// Accueil API REST (/api)
if ($uri === '/api') {
    echo json_encode([
        'api' => 'API REST - Vite & Gourmand',
        'statut' => 'en ligne',
        'architecture' => 'Polyglotte (MariaDB + MongoDB)',
        'version' => '1.0'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// Authentification & Profil
if ($uri === '/api/auth/login' && $method === 'POST') {
    (new AuthController())->login();
    exit;
}

if ($uri === '/api/auth/register' && $method === 'POST') {
    (new AuthController())->register();
    exit;
}

if ($uri === '/api/auth/forgot-password' && $method === 'POST') {
    (new AuthController())->forgotPassword();
    exit;
}

// Espace Utilisateur - Mise à jour du profil
if (($uri === '/api/utilisateurs/me' || $uri === '/api/auth/profile') && $method === 'PUT') {
    (new CommandeController())->updateProfil();
    exit;
}

// Back-Office Admin - Liste des commandes
if ($uri === '/api/admin/commandes' && $method === 'GET') {
    (new CommandeController())->adminIndex();
    exit;
}

// Back-Office Admin - Mise à jour du statut d'une commande
if (preg_match('#^/api/admin/commandes/([0-9]+)/statut$#', $uri, $matches) && $method === 'PUT') {
    (new CommandeController())->updateStatut((int)$matches[1]);
    exit;
}

// Avis Clients - Public, Dépôt & Suivi Client
if ($uri === '/api/avis/mes-avis' && $method === 'GET') {
    (new AvisController())->mesAvis();
    exit;
}

if ($uri === '/api/avis' && $method === 'GET') {
    (new AvisController())->index();
    exit;
}

if ($uri === '/api/avis' && $method === 'POST') {
    (new AvisController())->creer();
    exit;
}

// Avis Clients - Modération Back-Office (Admin & Employé)
if ($uri === '/api/admin/avis' && $method === 'GET') {
    (new AvisController())->adminIndex();
    exit;
}

if (preg_match('#^/api/admin/avis/([0-9]+)/valider$#', $uri, $matches) && $method === 'PUT') {
    (new AvisController())->valider((int)$matches[1]);
    exit;
}

if (preg_match('#^/api/admin/avis/([0-9]+)$#', $uri, $matches) && $method === 'DELETE') {
    (new AvisController())->supprimer((int)$matches[1]);
    exit;
}

// Formulaire de Contact - Public & Back-Office
if ($uri === '/api/contact' && $method === 'POST') {
    (new ContactController())->creer();
    exit;
}

if ($uri === '/api/admin/contacts' && $method === 'GET') {
    (new ContactController())->adminIndex();
    exit;
}

if (preg_match('#^/api/admin/contacts/([0-9]+)/traiter$#', $uri, $matches) && $method === 'PUT') {
    (new ContactController())->marquerTraite((int)$matches[1]);
    exit;
}

if (preg_match('#^/api/admin/contacts/([0-9]+)$#', $uri, $matches) && $method === 'DELETE') {
    (new ContactController())->supprimer((int)$matches[1]);
    exit;
}

// Statistiques NoSQL (MongoDB)
if ($uri === '/api/stats/popularite' && $method === 'GET') {
    (new MenuController())->popularite();
    exit;
}

// Menus (MariaDB)
if ($uri === '/api/menus' && $method === 'GET') {
    (new MenuController())->index();
    exit;
}

if (preg_match('#^/api/menus/([0-9]+)$#', $uri, $matches) && $method === 'GET') {
    (new MenuController())->show((int)$matches[1]);
    exit;
}

// Commandes
if ($uri === '/api/commandes/simuler' && $method === 'POST') {
    (new CommandeController())->simuler();
    exit;
}

if ($uri === '/api/commandes' && $method === 'POST') {
    (new CommandeController())->creer();
    exit;
}

// Espace Client - Commandes personnelles
if ($uri === '/api/commandes/mes-commandes' && $method === 'GET') {
    (new CommandeController())->mesCommandes();
    exit;
}

// Espace Client - Annulation de commande
if (preg_match('#^/api/commandes/([0-9]+)/annuler$#', $uri, $matches) && $method === 'PUT') {
    (new CommandeController())->annulerCommande((int)$matches[1]);
    exit;
}

// Route 404
http_response_code(404);
echo json_encode([
    'statut' => 'erreur',
    'message' => 'Endpoint introuvable'
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);