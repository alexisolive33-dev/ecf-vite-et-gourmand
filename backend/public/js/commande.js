document.addEventListener('DOMContentLoaded', () => {
    // 1. Récupération de l'ID du menu dans l'URL (par défaut menu 1)
    const urlParams = new URLSearchParams(window.location.search);
    const menuId = parseInt(urlParams.get('id')) || 1;

    let currentMenu = null;
    let nbConvives = 12; // Valeur par défaut de la maquette
    let currentSimulation = null;

    // Éléments du DOM
    const breadcrumbCurrent = document.getElementById('breadcrumb-current');
    const badgeRegime = document.getElementById('badge-regime');
    const badgeStock = document.getElementById('badge-stock');
    const badgeThemeTop = document.getElementById('badge-theme-top');
    const photoLabel = document.getElementById('photo-label');
    const menuTitre = document.getElementById('menu-titre');
    const menuDesc = document.getElementById('menu-description');
    const compositionList = document.getElementById('composition-list');

    // Éléments configurateur
    const configPrixUnit = document.getElementById('config-prix-unit');
    const configMinConvives = document.getElementById('config-min-convives');
    const displayNbConvives = document.getElementById('display-nb-convives');
    const btnMinus = document.getElementById('btn-devis-minus');
    const btnPlus = document.getElementById('btn-devis-plus');
    const bannerRemise = document.getElementById('banner-remise');
    const remiseParPersonne = document.getElementById('remise-par-personne');

    const inputAdresse = document.getElementById('cfg-adresse');
    const inputVille = document.getElementById('cfg-ville');
    const inputDistance = document.getElementById('cfg-distance');
    const inputDate = document.getElementById('cfg-date');

    const rowLivraisonDesc = document.getElementById('row-livraison-desc');
    const calculLivraisonDetail = document.getElementById('calcul-livraison-detail');
    const valFraisLivraison = document.getElementById('val-frais-livraison');
    const valSousTotalRepas = document.getElementById('val-sous-total-repas');
    const valFraisLivraisonTotal = document.getElementById('val-frais-livraison-total');
    const valTotalTtc = document.getElementById('val-total-ttc');
    const btnValider = document.getElementById('btn-valider-commande');

    // 2. Initialisation de la date minimale à J+7
    const dateMin = new Date();
    dateMin.setDate(dateMin.getDate() + 7);
    const dateMinIso = dateMin.toISOString().slice(0, 16);
    inputDate.min = dateMinIso;
    inputDate.value = "2026-12-24T19:00"; // Conforme à la maquette

    // 3. Charger le détail du menu depuis l'API
    fetch(`/api/menus/${menuId}`)
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes') {
                currentMenu = res.donnees;
                renderMenuDetails(currentMenu);
                // Si la valeur par défaut est inférieure au minimum requis
                if (nbConvives < parseInt(currentMenu.convives_min)) {
                    nbConvives = parseInt(currentMenu.convives_min);
                }
                recalculerDevis();
            }
        })
        .catch(err => console.error('Erreur chargement menu:', err));

    function renderMenuDetails(menu) {
        breadcrumbCurrent.textContent = menu.titre;
        menuTitre.textContent = menu.titre;
        menuDesc.textContent = menu.description;
        
        // Remplacement du texte temporaire par la véritable balise photo
        const imageUrl = menu.image_url || '/assets/images/menus/default-menu.webp';
        if (photoLabel) {
            photoLabel.innerHTML = `
                <img 
                    src="${imageUrl}" 
                    alt="Visuel haute définition du menu ${menu.titre}" 
                    fetchpriority="high"
                    style="width: 100%; height: 100%; object-fit: cover; display: block;"
                    onerror="this.onerror=null; this.src='/assets/images/menus/default-menu.webp';"
                >
            `;
            // Calage du conteneur en fond pour recouvrir tout l'en-tête
            photoLabel.style.width = '100%';
            photoLabel.style.height = '100%';
            photoLabel.style.position = 'absolute';
            photoLabel.style.top = '0';
            photoLabel.style.left = '0';
            photoLabel.style.zIndex = '1';
        }
        
        const regimeAffiche = menu.regime ? (menu.regime.charAt(0).toUpperCase() + menu.regime.slice(1)) : 'Classique';
        badgeRegime.textContent = regimeAffiche;
        badgeStock.textContent = `Il reste ${menu.stock_disponible} commandes disponibles`;
        badgeThemeTop.textContent = `THÈME : ${(menu.theme || '').toUpperCase()}`;

        // Sécurisation de l'affichage des badges au premier plan au-dessus de la photo
        if (badgeRegime) badgeRegime.style.zIndex = '2';
        if (badgeStock) badgeStock.style.zIndex = '2';
        if (badgeThemeTop) badgeThemeTop.style.zIndex = '2';

        configPrixUnit.textContent = `${parseFloat(menu.prix_unitaire_ttc).toFixed(2).replace('.', ',')} € / personne`;
        configMinConvives.textContent = `Minimum ${menu.convives_min} convives`;

        // Affichage de la composition des plats et allergènes INCO
        compositionList.innerHTML = '';
        if (menu.plats && Array.isArray(menu.plats)) {
            menu.plats.forEach(plat => {
                const item = document.createElement('div');
                item.className = 'composition-item';

                let tagsHtml = '';
                if (plat.allergenes && plat.allergenes.length > 0) {
                    tagsHtml = plat.allergenes.map(a => `<span class="allergen-tag" style="margin-right: 4px;">${a.nom}</span>`).join(' ');
                }

                item.innerHTML = `
                    <div class="composition-category">${plat.categorie} :</div>
                    <div class="composition-title">${plat.nom}</div>
                    ${plat.description ? `<div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 6px;">${plat.description}</div>` : ''}
                    <div>${tagsHtml}</div>
                `;
                compositionList.appendChild(item);
            });
        }
    }

    // 4. Gestion des Convives
    btnMinus.addEventListener('click', () => {
        if (!currentMenu) return;
        const minReq = parseInt(currentMenu.convives_min);
        if (nbConvives > minReq) {
            nbConvives--;
            recalculerDevis();
        }
    });

    btnPlus.addEventListener('click', () => {
        nbConvives++;
        recalculerDevis();
    });

    // Écouteurs sur les changements d'adresse, distance et date
    inputVille.addEventListener('input', recalculerDevis);
    inputDistance.addEventListener('input', recalculerDevis);
    inputDate.addEventListener('change', recalculerDevis);

    // 5. Calcul dynamique du Devis via l'API REST
    function recalculerDevis() {
        if (!currentMenu) return;

        displayNbConvives.textContent = `${nbConvives} convives`;

        const distanceVal = parseFloat(inputDistance.value) || 0;
        const villeVal = inputVille.value.trim() || 'Bordeaux';
        const dateVal = inputDate.value ? inputDate.value.replace('T', ' ') + ':00' : '2026-12-24 19:00:00';

        const payload = {
            menu_id: currentMenu.id,
            nb_convives: nbConvives,
            distance_km: distanceVal,
            date_livraison: dateVal,
            ville: villeVal
        };

        fetch('/api/commandes/simuler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes') {
                const sim = res.simulation;
                currentSimulation = sim;

                // Bannière remise 10%
                if (sim.remise_appliquee) {
                    bannerRemise.style.display = 'flex';
                    const remiseUnit = sim.prix_unitaire_ttc * 0.10;
                    remiseParPersonne.textContent = `-${remiseUnit.toFixed(2).replace('.', ',')} €`;
                } else {
                    bannerRemise.style.display = 'none';
                }

                // Lignes récapitulatives
                if (distanceVal > 0) {
                    rowLivraisonDesc.textContent = `Livraison hors Bordeaux métropole (${distanceVal} km) :`;
                    calculLivraisonDetail.textContent = `Forfait 5,00 € + (${distanceVal} km × 0,59 €)`;
                } else {
                    rowLivraisonDesc.textContent = `Livraison Bordeaux métropole :`;
                    calculLivraisonDetail.textContent = `Livraison offerte intra-muros`;
                }

                valFraisLivraison.textContent = `${sim.frais_livraison.toFixed(2).replace('.', ',')} €`;
                valSousTotalRepas.textContent = `${sim.sous_total_net.toFixed(2).replace('.', ',')} €`;
                valFraisLivraisonTotal.textContent = `${sim.frais_livraison.toFixed(2).replace('.', ',')} €`;
                valTotalTtc.textContent = `${sim.total_ttc.toFixed(2).replace('.', ',')} €`;
            }
        })
        .catch(err => console.error('Erreur calcul simulation:', err));
    }

    // 6. Validation et passation réelle de la commande
    btnValider.addEventListener('click', () => {
        if (!currentSimulation) return;

        btnValider.disabled = true;
        btnValider.textContent = 'Enregistrement de votre devis...';

        const payload = {
            menu_id: currentSimulation.menu_id,
            nb_convives: currentSimulation.nb_convives,
            distance_km: currentSimulation.distance_km,
            date_livraison: currentSimulation.date_livraison,
            ville: currentSimulation.ville_livraison,
            adresse_livraison: inputAdresse.value.trim() || '15 Avenue de l\'Abreuvoir, 33700 Mérignac',
            utilisateur_id: 4
        };

        fetch('/api/commandes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes') {
                alert(`Félicitations !\nVotre commande n° ${res.commande.numero_commande} a été enregistrée avec succès.\nMontant total : ${res.commande.total_ttc} € TTC.\n\nJulie & José valideront votre prestation sous 24h.`);
                window.location.href = '/menus.html';
            } else {
                alert('Erreur : ' + (res.message || 'Impossible de valider la commande'));
                btnValider.disabled = false;
                btnValider.textContent = 'Valider et passer à la commande →';
            }
        })
        .catch(err => {
            alert('Erreur lors de la communication avec le serveur.');
            btnValider.disabled = false;
            btnValider.textContent = 'Valider et passer à la commande →';
        });
    });
});