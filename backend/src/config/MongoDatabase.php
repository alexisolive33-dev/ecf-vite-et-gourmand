<?php

namespace App\Config;

use MongoDB\Driver\Manager;
use Exception;

class MongoDatabase
{
    private static ?Manager $instance = null;
    private static string $databaseName = 'vite_et_gourmand_analytics';

    public static function getManager(): Manager
    {
        if (self::$instance === null) {
            $host = getenv('MONGO_HOST') ?: 'mongodb';
            $port = getenv('MONGO_PORT') ?: '27017';
            $user = getenv('MONGO_USER') ?: 'root';
            $pass = getenv('MONGO_PASS') ?: 'root';

            // URI de connexion avec authentification sur la base admin
            $uri = "mongodb://{$user}:{$pass}@{$host}:{$port}/?authSource=admin";

            try {
                self::$instance = new Manager($uri);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode([
                    'erreur' => 'Connexion MongoDB échouée',
                    'message' => $e->getMessage()
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        return self::$instance;
    }

    public static function getDbName(): string
    {
        return self::$databaseName;
    }
}