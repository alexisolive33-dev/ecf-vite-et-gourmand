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
            $host   = getenv('DB_HOST')     ?: ($_ENV['DB_HOST'] ?? 'mariadb');
            $port   = getenv('DB_PORT')     ?: ($_ENV['DB_PORT'] ?? '3306');
            $dbName = getenv('DB_NAME')     ?: ($_ENV['DB_NAME'] ?? 'vite_gourmand');
            $user   = getenv('DB_USER')     ?: ($_ENV['DB_USER'] ?? 'root');
            
            // Gère DB_PASSWORD (défini sur Render) et conserve le repli DB_PASS (local)
            $pass   = getenv('DB_PASSWORD') 
                      ?: ($_ENV['DB_PASSWORD'] 
                      ?? (getenv('DB_PASS') ?: ($_ENV['DB_PASS'] ?? 'root')));

            $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            // Activation TLS / SSL pour TiDB Cloud (contourné automatiquement si vous êtes sur MariaDB en local)
            if (!in_array($host, ['mariadb', 'localhost', '127.0.0.1'])) {
                $caBundle = '/etc/ssl/certs/ca-certificates.crt';
                if (file_exists($caBundle)) {
                    $options[PDO::MYSQL_ATTR_SSL_CA] = $caBundle;
                }
                $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
            }

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