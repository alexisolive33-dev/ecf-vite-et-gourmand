<?php

namespace App\Config;

use MongoDB\Driver\Manager;
use Throwable;

class MongoDatabase
{
    private static ?Manager $instance = null;
    private static ?string $databaseName = null;

    private static function getEnvVar(string $key): ?string
    {
        $val = getenv($key);
        if ($val !== false && trim($val) !== '') {
            return trim($val);
        }
        if (!empty($_ENV[$key])) {
            return trim((string)$_ENV[$key]);
        }
        if (!empty($_SERVER[$key])) {
            return trim((string)$_SERVER[$key]);
        }
        return null;
    }

    public static function getManager(): ?Manager
    {
        if (self::$instance === null) {
            // Priorité aux variables Cloud (MongoDB Atlas sur Render)
            $uri = self::getEnvVar('MONGODB_URI')
                ?? self::getEnvVar('MONGO_URI')
                ?? self::getEnvVar('MONGO_URL');

            if ($uri === null) {
                // Repli sur la configuration locale Docker Compose
                $host = self::getEnvVar('MONGO_HOST') ?? 'mongodb';
                $port = self::getEnvVar('MONGO_PORT') ?? '27017';
                $user = self::getEnvVar('MONGO_USER') ?? 'root';
                $pass = self::getEnvVar('MONGO_PASS') ?? 'root';
                $uri = "mongodb://{$user}:{$pass}@{$host}:{$port}/?authSource=admin";
            }

            try {
                self::$instance = new Manager($uri);
            } catch (Throwable $e) {
                error_log('Connexion MongoDB échouée : ' . $e->getMessage());
                return null;
            }
        }

        return self::$instance;
    }

    public static function getDbName(): string
    {
        if (self::$databaseName !== null) {
            return self::$databaseName;
        }

        $envDb = self::getEnvVar('MONGO_DB')
            ?? self::getEnvVar('MONGODB_DB')
            ?? self::getEnvVar('MONGO_DATABASE');

        if ($envDb !== null) {
            self::$databaseName = $envDb;
            return self::$databaseName;
        }

        // Extraction éventuelle du nom de base présent dans l'URI Atlas (ex: ...mongodb.net/vite_et_gourmand?...)
        $uri = self::getEnvVar('MONGODB_URI')
            ?? self::getEnvVar('MONGO_URI')
            ?? self::getEnvVar('MONGO_URL');

        if ($uri !== null) {
            $path = parse_url($uri, PHP_URL_PATH);
            if ($path && trim($path, '/') !== '') {
                self::$databaseName = trim($path, '/');
                return self::$databaseName;
            }
        }

        self::$databaseName = 'vite_et_gourmand_analytics';
        return self::$databaseName;
    }
}