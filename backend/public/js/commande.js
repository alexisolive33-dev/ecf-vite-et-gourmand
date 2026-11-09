document.addEventListener('DOMContentLoaded', () => {
    // 1. Contrôle d'accès et gestion de la session
    const authToken = localStorage.getItem('auth_token');
    const userProfileRaw = localStorage.getItem('user_profile');
    const user = userProfileRaw ? JSON.parse(userProfileRaw) : null;

    // Mise à jour immédiate de la navbar
    majNavbar(user);

    // Redirection stricte si visiteur non authentifié
    if (!authToken || !user) {
        window.location.href = `/login.html?tab=register&redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const menuId = parseInt(urlParams.get('id')) || 1;

    let currentMenu = null;
    let nbConvives = 12;
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

    const configPrixUnit = document.getElementById('config-prix-unit');
    const configMinConvives = document.getElementById('config-min-convives');
    const displayNbConvives = document.getElementById('display-nb-convives');
    const btnMinus = document.getElementById('btn-devis-minus');
    const btnPlus = document.getElementById('btn-devis-plus');
    const bannerRemise = document.getElementById('banner-remise');
    const remiseParPersonne = document.getElementById('remise-par-personne');

    const inputNom = document.getElementById('cfg-nom');
    const inputPrenom = document.getElementById('cfg-prenom');
    const inputEmail = document.getElementById('cfg-email');
    const inputTel = document.getElementById('cfg-tel') || document.getElementById('cfg-telephone');
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

    // 2. Auto-remplissage des champs avec les données du compte client
    if (inputNom && user.nom) inputNom.value = user.nom;
    if (inputPrenom && user.prenom) inputPrenom.value = user.prenom;
    if (inputEmail && user.email) inputEmail.value = user.email;
    if (inputTel && user.telephone) inputTel.value = user.telephone;
    if (inputAdresse && user.adresse_postale) inputAdresse.value = user.adresse_postale;
    if (inputVille && user.ville) inputVille.value = user.ville;

    // Date minimale (J+7)
    const dateMin = new Date();
    dateMin.setDate(dateMin.getDate() + 7);
    if (inputDate) {
        inputDate.min = dateMin.toISOString().slice(0, 16);
        if (!inputDate.value) inputDate.value = "2026-12-24T19:00";
    }

    // 3. Charger le détail du menu
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
                <img src="${imageUrl}" alt="Menu ${menu.titre}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.onerror=null; this.src='/assets/images/menus/default-menu.webp';">
            `;
            photoLabel.style.width = '100%';
            photoLabel.style.height = '100%';
            photoLabel.style.position = 'absolute';
            photoLabel.style.top = '0';
            photoLabel.style.left = '0';
            photoLabel.style.zIndex = '1';
        }
        
        const regimeAffiche = menu.regime ? (menu.regime.charAt(0).toUpperCase() + menu.regime.slice(1)) : 'Classique';
        if (badgeRegime) { badgeRegime.textContent = regimeAffiche; badgeRegime.style.zIndex = '2'; }
        if (badgeStock) { badgeStock.textContent = `Il reste ${menu.stock_disponible} commandes disponibles`; badgeStock.style.zIndex = '2'; }
        if (badgeThemeTop) { badgeThemeTop.textContent = `THÈME : ${(menu.theme || '').toUpperCase()}`; badgeThemeTop.style.zIndex = '2'; }

        if (configPrixUnit) configPrixUnit.textContent = `${parseFloat(menu.prix_unitaire_ttc).toFixed(2).replace('.', ',')} € / personne`;
        if (configMinConvives) configMinConvives.textContent = `Minimum ${menu.convives_min} convives`;

        if (compositionList) {
            compositionList.innerHTML = '';
            if (menu.plats && Array.isArray(menu.plats)) {
                menu.plats.forEach(plat => {
                    const item = document.createElement('div');
                    item.className = 'composition-item';
                    const tagsHtml = (plat.allergenes && plat.allergenes.length > 0)
                        ? plat.allergenes.map(a => `<span class="allergen-tag" style="margin-right: 4px;">${a.nom}</span>`).join(' ')
                        : '';
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

    // 4. Compteur convives & écouteurs
    if (btnMinus) {
        btnMinus.addEventListener('click', () => {
            if (!currentMenu) return;
            if (nbConvives > parseInt(currentMenu.convives_min)) {
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

    // 5. Calcul Devis en direct
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

                if (sim.remise_appliquee && bannerRemise) {
                    bannerRemise.style.display = 'flex';
                    const remiseUnit = sim.prix_unitaire_ttc * 0.10;
                    if (remiseParPersonne) remiseParPersonne.textContent = `-${remiseUnit.toFixed(2).replace('.', ',')} €`;
                } else if (bannerRemise) {
                    bannerRemise.style.display = 'none';
                }

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

    // 6. Validation de commande reliée au compte connecté
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
                    afficherModalConfirmation(res.commande, user);
                } else {
                    alert('Erreur : ' + (res.message || 'Impossible de valider la commande'));
                    btnValider.disabled = false;
                    btnValider.textContent = 'Enregistrement de votre devis...';
                }
            })
            .catch(err => {
                alert('Erreur lors de la communication avec le serveur.');
                btnValider.disabled = false;
                btnValider.textContent = 'Enregistrement de votre devis...';
            });
        });
    }

    // Mise à jour propre de la navbar
    function majNavbar(userData) {
        const navRightBtn = document.querySelector('.btn-connexion') || 
                            document.querySelector('.header-nav a[href*="login"]') || 
                            Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim().toLowerCase() === 'connexion');

        if (navRightBtn && userData) {
            const profileWrapper = document.createElement('div');
            profileWrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 10px;';
            profileWrapper.innerHTML = `
                <span style="font-size: 13px; font-weight: 600; color: var(--color-primary, #721B29);">
                    👤 ${userData.prenom}
                </span>
                <button type="button" id="btn-logout" style="background: none; border: 1px solid var(--color-primary, #721B29); color: var(--color-primary, #721B29); padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                    Déconnexion
                </button>
            `;

            navRightBtn.replaceWith(profileWrapper);

            const btnLogout = document.getElementById('btn-logout');
            if (btnLogout) {
                btnLogout.addEventListener('click', () => {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_profile');
                    window.location.reload();
                });
            }
        }
    }

    // Modal de confirmation stylisée
    function afficherModalConfirmation(commande, userData) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; z-index:9999;';

        overlay.innerHTML = `
            <div style="background:#ffffff; border-radius:8px; padding:32px; max-width:480px; width:90%; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.25);">
                <div style="font-size:42px; margin-bottom:12px;">🎉</div>
                <h2 style="font-size:22px; color:#1F2937; margin-bottom:10px;">Félicitations ${userData.prenom} !</h2>
                <p style="font-size:14px; color:#4B5563; line-height:1.5; margin-bottom:18px;">
                    Votre commande <strong>n° ${commande.numero_commande}</strong> a été enregistrée avec succès.<br>
                    Montant total : <strong>${commande.total_ttc} € TTC</strong>.
                </p>
                <div style="background:#F3F4F6; border-radius:6px; padding:12px; font-size:12px; color:#6B7280; margin-bottom:20px; text-align:left;">
                    ✉️ Un e-mail de confirmation vient d'être envoyé à <strong>${userData.email}</strong>.<br>
                    👨‍🍳 Julie & José valideront votre prestation sous 24h.
                </div>
                <button id="modal-btn-ok" class="btn-cta" style="width:100%; height:42px; cursor:pointer;">
                    Retourner au catalogue des menus
                </button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.getElementById('modal-btn-ok').addEventListener('click', () => {
            window.location.href = '/menus.html';
        });
    }
});