document.addEventListener('DOMContentLoaded', () => {
    // 1. Contrôle d'accès et session (tolérance visiteur anonyme)
    const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token');
    const userProfileRaw = localStorage.getItem('user_profile') || localStorage.getItem('user');
    let user = null;

    try {
        user = userProfileRaw ? JSON.parse(userProfileRaw) : null;
    } catch (e) {
        user = null;
    }

    majNavbar(user);

    const currentUserId = user ? (user.id || user.utilisateur_id) : null;
    const urlParams = new URLSearchParams(window.location.search);
    const menuId = parseInt(urlParams.get('id')) || 1;

    let currentMenu = null;
    let nbConvives = 6;
    let currentSimulation = null;
    let listeCommunesTrouvees = [];
    let simAbortController = null;

    // Atelier Julie & José (12 Cours de l'Intendance, Bordeaux)
    const ATELIER_GPS = { lat: 44.8427, lon: -0.5755 };

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
    const inputCp = document.getElementById('cfg-cp');
    const selectVille = document.getElementById('cfg-ville');
    const inputDistance = document.getElementById('cfg-distance');
    const inputDate = document.getElementById('cfg-date');

    const rowLivraisonDesc = document.getElementById('row-livraison-desc');
    const calculLivraisonDetail = document.getElementById('calcul-livraison-detail');
    const valFraisLivraison = document.getElementById('val-frais-livraison');
    const valSousTotalRepas = document.getElementById('val-sous-total-repas');
    const valFraisLivraisonTotal = document.getElementById('val-frais-livraison-total');
    const valTotalTtc = document.getElementById('val-total-ttc');
    const btnValider = document.getElementById('btn-valider-commande');

    // 2. Auto-remplissage sécurisé si connecté
    if (user) {
        if (inputNom && user.nom) inputNom.value = user.nom;
        if (inputPrenom && user.prenom) inputPrenom.value = user.prenom;
        if (inputEmail && user.email) inputEmail.value = user.email;
        if (inputTel && user.telephone) inputTel.value = user.telephone;
        if (inputAdresse && user.adresse_postale) inputAdresse.value = user.adresse_postale;
        if (inputCp && user.code_postal) inputCp.value = user.code_postal;
    }

    // Date minimale = J + 7 jours ; date par défaut = J + 8 jours à 19h00
    const dateMin = new Date();
    dateMin.setDate(dateMin.getDate() + 7);
    const dateDefaut = new Date();
    dateDefaut.setDate(dateDefaut.getDate() + 8);
    dateDefaut.setHours(19, 0, 0, 0);

    function toLocalInputIso(d) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    if (inputDate) {
        inputDate.min = toLocalInputIso(dateMin);
        if (!inputDate.value) inputDate.value = toLocalInputIso(dateDefaut);
    }

    // 3. Charger le détail du menu
    fetch(`/api/menus/${menuId}`)
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes') {
                currentMenu = res.donnees;
                renderMenuDetails(currentMenu);

                // Initialisation systématique au minimum exact du menu (sans remise par défaut)
                nbConvives = parseInt(currentMenu.convives_min) || 6;
                recalculerDevis();

                if (inputCp && inputCp.value.trim().length === 5) {
                    chargerVillesParCp(inputCp.value.trim(), user ? user.ville : '');
                }
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

    // 4. Compteurs convives
    if (btnMinus) {
        btnMinus.addEventListener('click', () => {
            if (!currentMenu) return;
            const min = parseInt(currentMenu.convives_min) || 1;
            if (nbConvives > min) {
                nbConvives--;
                recalculerDevis();
            }
        });
    }

    if (btnPlus) {
        btnPlus.addEventListener('click', () => {
            if (!currentMenu) return;
            nbConvives++;
            recalculerDevis();
        });
    }

    // -------------------------------------------------------------
    // CHARGEMENT DES COMMUNES & CALCUL KILOMÉTRIQUE VIA CODE POSTAL
    // -------------------------------------------------------------
    if (inputCp) {
        inputCp.addEventListener('input', (e) => {
            const cp = e.target.value.trim();
            if (cp.length === 5 && /^[0-9]{5}$/.test(cp)) {
                chargerVillesParCp(cp);
            } else {
                listeCommunesTrouvees = [];
                if (selectVille) {
                    selectVille.innerHTML = '<option value="">Entrez un code postal (5 chiffres)...</option>';
                }
                if (inputDistance) inputDistance.value = 0;
                recalculerDevis();
            }
        });
    }

    async function chargerVillesParCp(codePostal, villeSelectionnee = '') {
        if (!selectVille) return;
        selectVille.innerHTML = '<option value="">Recherche des communes en cours...</option>';
        selectVille.disabled = true;

        try {
            const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${codePostal}&fields=nom,centre`);
            const communes = await res.json();

            if (!communes || communes.length === 0) {
                selectVille.innerHTML = '<option value="">Aucune commune trouvée pour ce code postal</option>';
                selectVille.disabled = false;
                if (inputDistance) inputDistance.value = 0;
                recalculerDevis();
                return;
            }

            listeCommunesTrouvees = communes;
            selectVille.innerHTML = '';

            if (communes.length > 1) {
                const optDefault = document.createElement('option');
                optDefault.value = '';
                optDefault.textContent = `-- Choisissez parmi les ${communes.length} communes --`;
                selectVille.appendChild(optDefault);
            }

            let indexSelectionne = communes.length === 1 ? 0 : -1;

            communes.forEach((commune, index) => {
                const opt = document.createElement('option');
                opt.value = commune.nom;
                opt.textContent = commune.nom;

                if (villeSelectionnee && commune.nom.toLowerCase() === villeSelectionnee.toLowerCase()) {
                    opt.selected = true;
                    indexSelectionne = index;
                }
                selectVille.appendChild(opt);
            });

            selectVille.disabled = false;

            if (indexSelectionne >= 0) {
                selectVille.value = communes[indexSelectionne].nom;
                appliquerDistanceDepuisCommune(communes[indexSelectionne]);
            } else {
                recalculerDevis();
            }

        } catch (err) {
            console.error("Erreur API Communes :", err);
            selectVille.innerHTML = '<option value="">Erreur de recherche (réseau)</option>';
            selectVille.disabled = false;
            recalculerDevis();
        }
    }

    if (selectVille) {
        selectVille.addEventListener('change', () => {
            const nomChoisi = selectVille.value;
            if (!nomChoisi) {
                if (inputDistance) inputDistance.value = 0;
                recalculerDevis();
                return;
            }

            const communeObj = listeCommunesTrouvees.find(c => c.nom === nomChoisi);
            if (communeObj) {
                appliquerDistanceDepuisCommune(communeObj);
            } else {
                recalculerDevis();
            }
        });
    }

    function appliquerDistanceDepuisCommune(commune) {
        if (!commune) return;

        if (commune.nom.toLowerCase().includes('bordeaux')) {
            appliquerDistance(0);
            return;
        }

        if (commune.centre && commune.centre.coordinates) {
            const [lon, lat] = commune.centre.coordinates;

            const dLat = (lat - ATELIER_GPS.lat) * (Math.PI / 180);
            const dLon = (lon - ATELIER_GPS.lon) * (Math.PI / 180);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(ATELIER_GPS.lat * (Math.PI / 180)) * Math.cos(lat * (Math.PI / 180)) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const distanceVolOiseau = 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
            const distanceKm = Math.max(1, Math.round(distanceVolOiseau * 1.28));

            appliquerDistance(distanceKm);
        } else {
            recalculerDevis();
        }
    }

    function appliquerDistance(km) {
        if (inputDistance) {
            inputDistance.value = km;
            inputDistance.style.backgroundColor = '#DCFCE7';
            setTimeout(() => { inputDistance.style.backgroundColor = '#F3F4F6'; }, 900);
        }
        recalculerDevis();
    }

    if (inputDate) inputDate.addEventListener('change', recalculerDevis);

    // 5. Calcul Devis instantané + synchronisation API
    function formatEuro(val) {
        return Number(val || 0).toFixed(2).replace('.', ',') + ' €';
    }

    function afficherDevisDansUi(sim) {
        if (sim.remise_appliquee && bannerRemise) {
            bannerRemise.style.display = 'flex';
            const remiseUnit = sim.prix_unitaire_ttc * 0.10;
            if (remiseParPersonne) {
                remiseParPersonne.textContent = `-${remiseUnit.toFixed(2).replace('.', ',')} €`;
            }
        } else if (bannerRemise) {
            bannerRemise.style.display = 'none';
        }

        const distanceVal = Number(sim.distance_km || 0);
        const villeVal = String(sim.ville_livraison || 'Bordeaux');
        const estBordeaux = villeVal.toLowerCase().includes('bordeaux') && distanceVal === 0;

        if (!estBordeaux && distanceVal > 0) {
            if (rowLivraisonDesc) rowLivraisonDesc.textContent = `Livraison hors Bordeaux (${distanceVal} km) :`;
            if (calculLivraisonDetail) calculLivraisonDetail.textContent = `Forfait 5,00 € + (${distanceVal} km × 0,59 €)`;
        } else {
            if (rowLivraisonDesc) rowLivraisonDesc.textContent = `Livraison Bordeaux métropole :`;
            if (calculLivraisonDetail) calculLivraisonDetail.textContent = `Livraison offerte intra-muros`;
        }

        if (valFraisLivraison) valFraisLivraison.textContent = formatEuro(sim.frais_livraison);
        if (valSousTotalRepas) valSousTotalRepas.textContent = formatEuro(sim.sous_total_net);
        if (valFraisLivraisonTotal) valFraisLivraisonTotal.textContent = formatEuro(sim.frais_livraison);
        if (valTotalTtc) valTotalTtc.textContent = formatEuro(sim.total_ttc);
    }

    function recalculerDevis() {
        if (!currentMenu) return;

        const minConvives = parseInt(currentMenu.convives_min) || 6;
        if (nbConvives < minConvives) nbConvives = minConvives;

        if (displayNbConvives) displayNbConvives.textContent = `${nbConvives} convives`;
        if (btnMinus) btnMinus.disabled = (nbConvives <= minConvives);

        const prixUnit = parseFloat(currentMenu.prix_unitaire_ttc) || 0;
        const distanceVal = inputDistance ? (parseFloat(inputDistance.value) || 0) : 0;
        const villeVal = (selectVille && selectVille.value.trim()) ? selectVille.value.trim() : 'Bordeaux';
        const dateVal = (inputDate && inputDate.value) ? inputDate.value.replace('T', ' ') + ':00' : toLocalInputIso(dateDefaut).replace('T', ' ') + ':00';

        // 5a. Calcul immédiat côté client (0 latence, jamais bloqué)
        const remiseAppliquee = nbConvives >= (minConvives + 5);
        const sousTotalBrut = Math.round(prixUnit * nbConvives * 100) / 100;
        const montantRemise = remiseAppliquee ? Math.round(sousTotalBrut * 0.10 * 100) / 100 : 0;
        const sousTotalNet = Math.round((sousTotalBrut - montantRemise) * 100) / 100;

        const estBordeaux = villeVal.toLowerCase().includes('bordeaux') && distanceVal === 0;
        const fraisLivraison = estBordeaux
            ? 0
            : (distanceVal > 0 ? Math.round((5.00 + distanceVal * 0.59) * 100) / 100 : 0);

        const totalTtc = Math.round((sousTotalNet + fraisLivraison) * 100) / 100;

        currentSimulation = {
            menu_id: currentMenu.id,
            menu_titre: currentMenu.titre,
            nb_convives: nbConvives,
            prix_unitaire_ttc: prixUnit,
            sous_total_brut: sousTotalBrut,
            remise_appliquee: remiseAppliquee,
            montant_remise: montantRemise,
            sous_total_net: sousTotalNet,
            distance_km: distanceVal,
            frais_livraison: fraisLivraison,
            total_ttc: totalTtc,
            ville_livraison: villeVal,
            date_livraison: dateVal
        };

        afficherDevisDansUi(currentSimulation);

        // 5b. Vérification asynchrone avec le serveur PHP
        if (simAbortController) {
            simAbortController.abort();
        }
        simAbortController = new AbortController();

        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        fetch('/api/commandes/simuler', {
            method: 'POST',
            headers: headers,
            signal: simAbortController.signal,
            body: JSON.stringify({
                menu_id: currentMenu.id,
                nb_convives: nbConvives,
                distance_km: distanceVal,
                date_livraison: dateVal,
                ville: villeVal
            })
        })
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes' && res.simulation) {
                currentSimulation = res.simulation;
                afficherDevisDansUi(currentSimulation);
            }
        })
        .catch(err => {
            if (err.name !== 'AbortError') {
                console.warn('Synchronisation simulation serveur:', err);
            }
        });
    }

    // 6. Validation finale : authentification exigée uniquement ici
    if (btnValider) {
        btnValider.addEventListener('click', () => {
            if (!currentSimulation) return;

            if (!authToken || !user) {
                alert("Veuillez vous connecter ou créer un compte pour confirmer votre commande.");
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
                return;
            }

            if (!inputCp || inputCp.value.trim().length !== 5 || !selectVille || !selectVille.value) {
                alert("Veuillez renseigner un code postal valide et sélectionner votre commune de livraison.");
                return;
            }

            btnValider.disabled = true;
            btnValider.textContent = 'Enregistrement de votre commande...';

            const payload = {
                menu_id: currentSimulation.menu_id,
                nb_convives: currentSimulation.nb_convives,
                distance_km: currentSimulation.distance_km,
                date_livraison: currentSimulation.date_livraison,
                ville: currentSimulation.ville_livraison,
                code_postal: inputCp.value.trim(),
                adresse_livraison: inputAdresse ? (inputAdresse.value.trim() || user.adresse_postale || '14 Avenue du Château') : '14 Avenue du Château',
                utilisateur_id: currentUserId
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

    function majNavbar(userData) {
        const navRightBtn = document.querySelector('.btn-connexion') || 
                            document.querySelector('.header-nav a[href*="login"]') || 
                            Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim().toLowerCase() === 'connexion');

        if (navRightBtn && userData) {
            const isAdmin = userData.role === 'admin' || userData.role === 'employe';
            const profileWrapper = document.createElement('div');
            profileWrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 10px;';
            profileWrapper.innerHTML = `
                ${isAdmin ? `
                    <a href="/admin.html" style="background: var(--color-primary, #721B29); color: #FFFFFF; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                        ⚙️ Admin
                    </a>
                ` : ''}
                <a href="/compte.html" title="Accéder à mon espace client" style="text-decoration: none; font-size: 13px; font-weight: 600; color: var(--color-primary, #721B29); display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                    👤 ${userData.prenom}
                </a>
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
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    sessionStorage.clear();
                    window.location.href = '/';
                });
            }
        }
    }

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
                    Suivre ma commande dans mon espace client
                </button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.getElementById('modal-btn-ok').addEventListener('click', () => {
            window.location.href = '/compte.html';
        });
    }
});