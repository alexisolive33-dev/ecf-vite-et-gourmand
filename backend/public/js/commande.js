document.addEventListener('DOMContentLoaded', () => {
    // 1. Contrôle d'accès ECF : Seul un utilisateur connecté peut commander
    const authToken = localStorage.getItem('auth_token');
    const userProfileRaw = localStorage.getItem('user_profile');
    const user = userProfileRaw ? JSON.parse(userProfileRaw) : null;

    const urlParams = new URLSearchParams(window.location.search);
    const menuId = parseInt(urlParams.get('id')) || 1;

    if (!authToken || !user) {
        // Redirection vers login avec conservation de l'URL cible
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }

    let currentMenu = null;
    let nbConvives = 12;
    let currentSimulation = null;

    // Éléments du DOM - En-tête et détails
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

    // Champs coordonnées et livraison
    const inputNom = document.getElementById('cfg-nom');
    const inputPrenom = document.getElementById('cfg-prenom');
    const inputEmail = document.getElementById('cfg-email');
    const inputTel = document.getElementById('cfg-tel') || document.getElementById('cfg-telephone');
    const inputAdresse = document.getElementById('cfg-adresse');
    const inputVille = document.getElementById('cfg-ville');
    const inputDistance = document.getElementById('cfg-distance');
    const inputDate = document.getElementById('cfg-date');

    // Récapitulatif tarifaire
    const rowLivraisonDesc = document.getElementById('row-livraison-desc');
    const calculLivraisonDetail = document.getElementById('calcul-livraison-detail');
    const valFraisLivraison = document.getElementById('val-frais-livraison');
    const valSousTotalRepas = document.getElementById('val-sous-total-repas');
    const valFraisLivraisonTotal = document.getElementById('val-frais-livraison-total');
    const valTotalTtc = document.getElementById('val-total-ttc');
    const btnValider = document.getElementById('btn-valider-commande');

    // 2. Auto-remplissage des coordonnées depuis le profil utilisateur (Exigence ECF)
    if (inputNom && user.nom) inputNom.value = user.nom;
    if (inputPrenom && user.prenom) inputPrenom.value = user.prenom;
    if (inputEmail && user.email) inputEmail.value = user.email;
    if (inputTel && user.telephone) inputTel.value = user.telephone;
    if (inputAdresse && user.adresse_postale && !inputAdresse.value) inputAdresse.value = user.adresse_postale;
    if (inputVille && user.ville && !inputVille.value) inputVille.value = user.ville;

    // 3. Initialisation de la date minimale de livraison (J+7)
    const dateMin = new Date();
    dateMin.setDate(dateMin.getDate() + 7);
    const dateMinIso = dateMin.toISOString().slice(0, 16);
    if (inputDate) {
        inputDate.min = dateMinIso;
        if (!inputDate.value) inputDate.value = "2026-12-24T19:00";
    }

    // 4. Charger le détail du menu
    fetch(`/api/menus/${menuId}`)
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes') {
                currentMenu = res.donnees;
                renderMenuDetails(currentMenu);
                if (nbConvives < parseInt(currentMenu.convives_min)) {
                    nbConvives = parseInt(currentMenu.convives_min);
                }
                recalculerDevis();
            }
        })
        .catch(err => console.error('Erreur chargement menu:', err));

    function renderMenuDetails(menu) {
        if (breadcrumbCurrent) breadcrumbCurrent.textContent = menu.titre;
        if (menuTitre) menuTitre.textContent = menu.titre;
        if (menuDesc) menuDesc.textContent = menu.description;
        
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
            photoLabel.style.width = '100%';
            photoLabel.style.height = '100%';
            photoLabel.style.position = 'absolute';
            photoLabel.style.top = '0';
            photoLabel.style.left = '0';
            photoLabel.style.zIndex = '1';
        }
        
        const regimeAffiche = menu.regime ? (menu.regime.charAt(0).toUpperCase() + menu.regime.slice(1)) : 'Classique';
        if (badgeRegime) {
            badgeRegime.textContent = regimeAffiche;
            badgeRegime.style.zIndex = '2';
        }
        if (badgeStock) {
            badgeStock.textContent = `Il reste ${menu.stock_disponible} commandes disponibles`;
            badgeStock.style.zIndex = '2';
        }
        if (badgeThemeTop) {
            badgeThemeTop.textContent = `THÈME : ${(menu.theme || '').toUpperCase()}`;
            badgeThemeTop.style.zIndex = '2';
        }

        if (configPrixUnit) configPrixUnit.textContent = `${parseFloat(menu.prix_unitaire_ttc).toFixed(2).replace('.', ',')} € / personne`;
        if (configMinConvives) configMinConvives.textContent = `Minimum ${menu.convives_min} convives`;

        // Exigence ECF : Encadré bien mis en évidence pour les conditions de conservation et de commande
        const alertConditions = document.getElementById('menu-conditions-alert');
        if (!alertConditions && menuDesc) {
            const condDiv = document.createElement('div');
            condDiv.id = 'menu-conditions-alert';
            condDiv.style.cssText = 'background: #FEF3C7; border: 1px solid #F59E0B; border-left: 4px solid #D97706; padding: 12px 14px; border-radius: 6px; margin: 16px 0; font-size: 13px; color: #92400E;';
            condDiv.innerHTML = `
                <strong>⚠️ Conditions importantes :</strong><br>
                • Préavis de commande : minimum <strong>${menu.delai_min_jours || 7} jours</strong> avant la prestation.<br>
                • Précautions de conservation : <strong>${menu.conditions_stockage || 'Conserver entre 0°C et +4°C'}</strong>.
            `;
            menuDesc.parentNode.insertBefore(condDiv, menuDesc.nextSibling);
        }

        // Composition et allergènes
        if (compositionList) {
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
    }

    // 5. Gestion des Convives
    if (btnMinus) {
        btnMinus.addEventListener('click', () => {
            if (!currentMenu) return;
            const minReq = parseInt(currentMenu.convives_min);
            if (nbConvives > minReq) {
                nbConvives--;
                recalculerDevis();
            }
        });
    }

    if (btnPlus) {
        btnPlus.addEventListener('click', () => {
            nbConvives++;
            recalculerDevis();
        });
    }

    if (inputVille) inputVille.addEventListener('input', recalculerDevis);
    if (inputDistance) inputDistance.addEventListener('input', recalculerDevis);
    if (inputDate) inputDate.addEventListener('change', recalculerDevis);

    // 6. Calcul dynamique du Devis
    function recalculerDevis() {
        if (!currentMenu) return;

        if (displayNbConvives) displayNbConvives.textContent = `${nbConvives} convives`;

        const distanceVal = inputDistance ? (parseFloat(inputDistance.value) || 0) : 0;
        const villeVal = inputVille ? (inputVille.value.trim() || 'Bordeaux') : 'Bordeaux';
        const dateVal = (inputDate && inputDate.value) ? inputDate.value.replace('T', ' ') + ':00' : '2026-12-24 19:00:00';

        const payload = {
            menu_id: currentMenu.id,
            nb_convives: nbConvives,
            distance_km: distanceVal,
            date_livraison: dateVal,
            ville: villeVal
        };

        fetch('/api/commandes/simuler', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes') {
                const sim = res.simulation;
                currentSimulation = sim;

                // Remise 10% si >= convives_min + 5
                if (sim.remise_appliquee && bannerRemise) {
                    bannerRemise.style.display = 'flex';
                    const remiseUnit = sim.prix_unitaire_ttc * 0.10;
                    if (remiseParPersonne) remiseParPersonne.textContent = `-${remiseUnit.toFixed(2).replace('.', ',')} €`;
                } else if (bannerRemise) {
                    bannerRemise.style.display = 'none';
                }

                // Règle de livraison ECF : Gratuit Bordeaux intra-muros, 5€ + 0,59€/km ailleurs
                const estBordeaux = villeVal.toLowerCase().includes('bordeaux') && distanceVal === 0;

                if (!estBordeaux && distanceVal > 0) {
                    if (rowLivraisonDesc) rowLivraisonDesc.textContent = `Livraison hors Bordeaux (${distanceVal} km) :`;
                    if (calculLivraisonDetail) calculLivraisonDetail.textContent = `Forfait 5,00 € + (${distanceVal} km × 0,59 €)`;
                } else {
                    if (rowLivraisonDesc) rowLivraisonDesc.textContent = `Livraison Bordeaux métropole :`;
                    if (calculLivraisonDetail) calculLivraisonDetail.textContent = `Livraison offerte intra-muros`;
                }

                if (valFraisLivraison) valFraisLivraison.textContent = `${sim.frais_livraison.toFixed(2).replace('.', ',')} €`;
                if (valSousTotalRepas) valSousTotalRepas.textContent = `${sim.sous_total_net.toFixed(2).replace('.', ',')} €`;
                if (valFraisLivraisonTotal) valFraisLivraisonTotal.textContent = `${sim.frais_livraison.toFixed(2).replace('.', ',')} €`;
                if (valTotalTtc) valTotalTtc.textContent = `${sim.total_ttc.toFixed(2).replace('.', ',')} €`;
            }
        })
        .catch(err => console.error('Erreur calcul simulation:', err));
    }

    // 7. Validation et enregistrement de la commande
    if (btnValider) {
        btnValider.addEventListener('click', () => {
            if (!currentSimulation) return;

            btnValider.disabled = true;
            btnValider.textContent = 'Enregistrement de votre commande...';

            const payload = {
                menu_id: currentSimulation.menu_id,
                nb_convives: currentSimulation.nb_convives,
                distance_km: currentSimulation.distance_km,
                date_livraison: currentSimulation.date_livraison,
                ville: currentSimulation.ville_livraison,
                adresse_livraison: inputAdresse ? (inputAdresse.value.trim() || user.adresse_postale || '15 Avenue de l\'Abreuvoir') : '15 Avenue de l\'Abreuvoir',
                // Liaison avec l'identifiant réel de l'utilisateur connecté
                utilisateur_id: user.id
            };

            fetch('/api/commandes', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(res => {
                if (res.statut === 'succes') {
                    alert(`Félicitations ${user.prenom} !\nVotre commande n° ${res.commande.numero_commande} a été enregistrée avec succès.\nMontant total : ${res.commande.total_ttc} € TTC.\n\nUn e-mail de confirmation vient de vous être envoyé. Julie & José valideront votre prestation sous 24h.`);
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
    }
});