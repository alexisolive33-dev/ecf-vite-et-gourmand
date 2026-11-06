<?php

namespace App\Config;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $instance = null;

    public static function getConnection(): PDO
    {
        if (self::$instance === null) {
            $host = getenv('DB_HOST') ?: 'mariadb';
            $port = getenv('DB_PORT') ?: '3306';
            $dbName = getenv('DB_NAME') ?: 'vite_et_gourmand';
            $user = getenv('DB_USER') ?: 'root';
            $pass = getenv('DB_PASS') ?: 'root';

            $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$instance = new PDO($dsn, $user, $pass, $options);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode([
                    'erreur' => 'Échec de connexion à la base de données',
                    'message' => $e->getMessage()
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        return self::$instance;
    }
}