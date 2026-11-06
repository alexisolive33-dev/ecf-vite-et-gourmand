<?php

use PHPUnit\Framework\TestCase;
use App\Services\OrderCalculatorService;

require_once __DIR__ . '/../src/Services/OrderCalculatorService.php';

class OrderCalculatorServiceTest extends TestCase
{
    private OrderCalculatorService $calculator;
    private array $menuTest;

    protected function setUp(): void
    {
        $this->calculator = new OrderCalculatorService();

        // Menu de test étalon : Menu Festif (48 € TTC, minimum 6 convives, préavis 7 jours)
        $this->menuTest = [
            'id' => 1,
            'titre' => 'Menu Festif du Réveillon',
            'prix_unitaire_ttc' => 48.00,
            'convives_min' => 6,
            'delai_min_jours' => 7
        ];
    }

    /**
     * Test 1 : Rejet d'une commande si le délai de préavis est inférieur à 7 jours
     */
    public function testRejetCommandeDelaiInferieurA7Jours(): void
    {
        $dateTropTot = (new DateTime('+4 days'))->format('Y-m-d H:i:s');
        $resultat = $this->calculator->calculer($this->menuTest, 6, 0.0, $dateTropTot, 'Bordeaux');

        $this->assertFalse($resultat['valide'], 'Une commande à J+4 doit être rejetée.');
        $this->assertNotEmpty($resultat['erreurs']);
        $this->assertStringContainsString('délai de prévenance', $resultat['erreurs'][0]);
    }

    /**
     * Test 2 : Acceptation d'une commande si le délai est supérieur ou égal à 7 jours
     */
    public function testValidationCommandeDelaiSuperieurOuEgalA7Jours(): void
    {
        $dateValide = (new DateTime('+8 days'))->format('Y-m-d H:i:s');
        $resultat = $this->calculator->calculer($this->menuTest, 6, 0.0, $dateValide, 'Bordeaux');

        $this->assertTrue($resultat['valide'], 'Une commande à J+8 doit être validée.');
        $this->assertArrayHasKey('details', $resultat);
    }

    /**
     * Test 3 : Rejet si le nombre de convives est strictement inférieur au minimum requis
     */
    public function testRejetNombreConvivesInferieurAuMinimum(): void
    {
        $dateValide = (new DateTime('+8 days'))->format('Y-m-d H:i:s');
        $resultat = $this->calculator->calculer($this->menuTest, 4, 0.0, $dateValide, 'Bordeaux');

        $this->assertFalse($resultat['valide'], 'Une commande de 4 personnes pour un menu min 6 doit être refusée.');
        $this->assertNotEmpty($resultat['erreurs']);
        $this->assertStringContainsString('minimum pour ce menu est de 6', $resultat['erreurs'][0]);
    }

    /**
     * Test 4 : Barème kilométrique - Gratuité intra-muros à Bordeaux (0.00 €)
     */
    public function testLivraisonGratuiteBordeauxIntramuros(): void
    {
        $dateValide = (new DateTime('+8 days'))->format('Y-m-d H:i:s');
        $resultat = $this->calculator->calculer($this->menuTest, 6, 0.0, $dateValide, 'Bordeaux');

        $this->assertTrue($resultat['valide']);
        $this->assertEquals(0.00, $resultat['details']['frais_livraison'], 'La livraison intra-muros à Bordeaux doit être gratuite.');
    }

    /**
     * Test 5 : Barème kilométrique - Facturation hors Bordeaux (5.00 € fixe + 0.59 €/km)
     */
    public function testLivraisonPayanteHorsBordeaux(): void
    {
        // 15 km à Mérignac : 5.00 + (15 * 0.59) = 13.85 €
        $dateValide = (new DateTime('+8 days'))->format('Y-m-d H:i:s');
        $resultat = $this->calculator->calculer($this->menuTest, 6, 15.0, $dateValide, 'Mérignac');

        $this->assertTrue($resultat['valide']);
        $this->assertEquals(13.85, $resultat['details']['frais_livraison'], 'Les frais pour 15 km doivent être de 13.85 €.');
    }

    /**
     * Test 6 : Règle de remise automatique - Non appliquée sous le seuil
     * Seuil = convives_min (6) + 5 = 11 convives
     */
    public function testRemiseNonAppliqueeSousLeSeuil(): void
    {
        // Test avec 10 convives (10 < 11) -> 10 * 48 € = 480 € brut, 0 remise
        $dateValide = (new DateTime('+8 days'))->format('Y-m-d H:i:s');
        $resultat = $this->calculator->calculer($this->menuTest, 10, 0.0, $dateValide, 'Bordeaux');

        $this->assertTrue($resultat['valide']);
        $this->assertFalse($resultat['details']['remise_appliquee'], 'Aucune remise ne doit être appliquée pour 10 convives.');
        $this->assertEquals(0.00, $resultat['details']['montant_remise']);
        $this->assertEquals(480.00, $resultat['details']['total_ttc']);
    }

    /**
     * Test 7 : Règle de remise automatique - Appliquée à partir du seuil (-10 %)
     * 12 convives (12 >= 11) -> 12 * 48 € = 576 € brut. Remise 10 % = 57.60 €. Net = 518.40 €.
     * Livraison 15 km (13.85 €) -> Total TTC = 532.25 €
     */
    public function testRemiseAppliqueeAuDelaDuSeuil(): void
    {
        $dateValide = (new DateTime('+8 days'))->format('Y-m-d H:i:s');
        $resultat = $this->calculator->calculer($this->menuTest, 12, 15.0, $dateValide, 'Mérignac');

        $this->assertTrue($resultat['valide']);
        $this->assertTrue($resultat['details']['remise_appliquee'], 'La remise de 10 % doit être validée pour 12 convives.');
        $this->assertEquals(57.60, $resultat['details']['montant_remise']);
        $this->assertEquals(518.40, $resultat['details']['sous_total_net']);
        $this->assertEquals(532.25, $resultat['details']['total_ttc'], 'Le montant total TTC calculé doit être exactement de 532.25 €.');
    }
}