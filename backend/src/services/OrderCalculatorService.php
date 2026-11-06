<?php

namespace App\Services;

use DateTime;

class OrderCalculatorService
{
    private const TAUX_REMISE = 0.10; // Remise de 10%
    private const SEUIL_BONUS_CONVIVES = 5; // convives_min + 5
    private const FRAIS_FIXES_LIVRAISON = 5.00;
    private const PRIX_KM = 0.59;

    /**
     * Calcule le devis détaillé d'une commande
     */
    public function calculer(array $menu, int $nbConvives, float $distanceKm, string $dateLivraisonStr, string $ville): array
    {
        $erreurs = [];

        // 1. Contrôle du nombre minimum de convives
        if ($nbConvives < $menu['convives_min']) {
            $erreurs[] = "Le nombre de convives minimum pour ce menu est de {$menu['convives_min']}.";
        }

        // 2. Contrôle du délai de préavis (7 jours minimum)
        $dateActuelle = new DateTime();
        $dateLivraison = new DateTime($dateLivraisonStr);
        $diffJours = $dateActuelle->diff($dateLivraison)->days;
        $estDansLeFutur = $dateLivraison > $dateActuelle;

        if (!$estDansLeFutur || $diffJours < $menu['delai_min_jours']) {
            $erreurs[] = "Un délai de prévenance de {$menu['delai_min_jours']} jours minimum est obligatoire pour la livraison.";
        }

        if (!empty($erreurs)) {
            return [
                'valide' => false,
                'erreurs' => $erreurs
            ];
        }

        // 3. Calcul du montant des repas
        $prixUnitaire = (float) $menu['prix_unitaire_ttc'];
        $sousTotalBrut = round($prixUnitaire * $nbConvives, 2);

        // 4. Application de la remise commerciale (-10%)
        $eligibleRemise = $nbConvives >= ($menu['convives_min'] + self::SEUIL_BONUS_CONVIVES);
        $tauxApplique = $eligibleRemise ? self::TAUX_REMISE : 0.00;
        $montantRemise = round($sousTotalBrut * $tauxApplique, 2);
        $sousTotalNet = round($sousTotalBrut - $montantRemise, 2);

        // 5. Calcul des frais de livraison
        $estBordeaux = (strcasecmp(trim($ville), 'Bordeaux') === 0) || ($distanceKm <= 0);
        $fraisLivraison = $estBordeaux ? 0.00 : round(self::FRAIS_FIXES_LIVRAISON + ($distanceKm * self::PRIX_KM), 2);

        // 6. Total TTC final
        $totalTTC = round($sousTotalNet + $fraisLivraison, 2);

        return [
            'valide' => true,
            'details' => [
                'menu_id' => (int) $menu['id'],
                'menu_titre' => $menu['titre'],
                'nb_convives' => $nbConvives,
                'prix_unitaire_ttc' => $prixUnitaire,
                'sous_total_brut' => $sousTotalBrut,
                'remise_appliquee' => $eligibleRemise,
                'taux_remise' => $tauxApplique,
                'montant_remise' => $montantRemise,
                'sous_total_net' => $sousTotalNet,
                'ville_livraison' => $ville,
                'distance_km' => $distanceKm,
                'frais_livraison' => $fraisLivraison,
                'total_ttc' => $totalTTC,
                'date_livraison' => $dateLivraison->format('Y-m-d H:i:s')
            ]
        ];
    }
}