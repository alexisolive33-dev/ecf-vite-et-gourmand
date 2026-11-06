<?php

namespace App\Models;

use App\Config\MongoDatabase;
use MongoDB\BSON\UTCDateTime;
use MongoDB\Driver\BulkWrite;
use MongoDB\Driver\Command;
use Exception;
use stdClass;

class MenuViewRepository
{
    private string $namespace;
    private string $dbName;

    public function __construct()
    {
        $this->dbName = MongoDatabase::getDbName();
        $this->namespace = $this->dbName . '.menu_views';
    }

    /**
     * Enregistre un événement de consultation de fiche dans la collection MongoDB
     */
    public function enregistrerVue(int $menuId, string $titreMenu): bool
    {
        try {
            $manager = MongoDatabase::getManager();
            $bulk = new BulkWrite();

            $bulk->insert([
                'menu_id'           => $menuId,
                'titre'             => $titreMenu,
                'date_consultation' => new UTCDateTime(),
                'ip_visiteur'       => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                'user_agent'        => $_SERVER['HTTP_USER_AGENT'] ?? 'Inconnu'
            ]);

            $manager->executeBulkWrite($this->namespace, $bulk);
            return true;
        } catch (Exception $e) {
            // Tolérance aux pannes : un souci NoSQL n'interrompt pas la navigation du client
            error_log("Erreur MongoDB enregistrerVue: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Récupère les statistiques de popularité par menu via un pipeline d'agrégation
     */
    public function getStatistiquesPopularite(): array
    {
        try {
            $manager = MongoDatabase::getManager();

            $command = new Command([
                'aggregate' => 'menu_views',
                'pipeline'  => [
                    [
                        '$group' => [
                            '_id'     => '$menu_id',
                            'titre'   => ['$last' => '$titre'],
                            'nb_vues' => ['$sum' => 1]
                        ]
                    ],
                    [
                        '$sort' => ['nb_vues' => -1]
                    ]
                ],
                'cursor' => new stdClass(),
            ]);

            $cursor = $manager->executeCommand($this->dbName, $command);
            $stats = [];

            foreach ($cursor as $doc) {
                $stats[] = [
                    'menu_id' => $doc->_id,
                    'titre'   => $doc->titre,
                    'nb_vues' => $doc->nb_vues
                ];
            }

            return $stats;
        } catch (Exception $e) {
            error_log("Erreur MongoDB getStatistiquesPopularite: " . $e->getMessage());
            return [];
        }
    }
}