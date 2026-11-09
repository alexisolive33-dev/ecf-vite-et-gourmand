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
require_once __DIR__ . '/../src/models/MenuModel.php';
require_once __DIR__ . '/../src/models/CommandeModel.php';
require_once __DIR__ . '/../src/models/UserModel.php';
require_once __DIR__ . '/../src/models/MenuViewRepository.php';
require_once __DIR__ . '/../src/services/OrderCalculatorService.php';
require_once __DIR__ . '/../src/controllers/MenuController.php';
require_once __DIR__ . '/../src/controllers/CommandeController.php';
require_once __DIR__ . '/../src/controllers/AuthController.php';

use App\Controllers\MenuController;
use App\Controllers\CommandeController;
use App\Controllers\AuthController;

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

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

// Authentification
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

// Route 404
http_response_code(404);
echo json_encode([
    'statut' => 'erreur',
    'message' => 'Endpoint introuvable'
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);