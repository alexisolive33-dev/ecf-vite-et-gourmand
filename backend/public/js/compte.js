document.addEventListener('DOMContentLoaded', () => {
    // 1. Contrôle d'accès et authentification
    const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token');
    const userProfileRaw = localStorage.getItem('user_profile') || localStorage.getItem('user');
    let user = null;

    try {
        user = userProfileRaw ? JSON.parse(userProfileRaw) : null;
    } catch (e) {
        user = null;
    }

    if (!authToken || !user) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent('/compte.html');
        return;
    }

    const currentUserId = user.id || user.utilisateur_id;
    let commandesDejaNotees = new Set();
    let commandesCache = [];
    let commandeEnEdition = null;

    majNavbar(user);
    const welcomeTitle = document.getElementById('user-welcome-title');
    if (welcomeTitle) {
        welcomeTitle.textContent = `Bienvenue, ${user.prenom || ''} ${user.nom || ''}`;
    }

    // 2. Gestion des onglets
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    // 3. Initialisation des formulaires et des données
    initialiserProfilForm(user, currentUserId);
    initialiserModalEditionCommande();
    chargerMesCommandes(currentUserId);
    initialiserGestionAvis();

    // ==========================================
    // GESTION DES COMMANDES (HISTORIQUE & SUIVI)
    // ==========================================
    function chargerMesCommandes(userId) {
        const loadingEl = document.getElementById('orders-loading');
        const emptyEl = document.getElementById('orders-empty');
        const listEl = document.getElementById('orders-list');

        const reqCommandes = fetch(`/api/commandes/mes-commandes?utilisateur_id=${userId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        }).then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || `Erreur HTTP ${res.status}`);
            return data;
        });

        const reqAvis = fetch(`/api/avis/mes-avis?utilisateur_id=${userId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
            .then(res => res.json())
            .catch(() => ({ commandes_notees: [] }));

        Promise.all([reqCommandes, reqAvis])
            .then(([resCmd, resAvis]) => {
                if (loadingEl) loadingEl.style.display = 'none';

                if (resAvis && Array.isArray(resAvis.commandes_notees)) {
                    commandesDejaNotees = new Set(resAvis.commandes_notees.map(id => Number(id)));
                }

                if (resCmd.statut === 'succes' && resCmd.commandes && resCmd.commandes.length > 0) {
                    commandesCache = resCmd.commandes;
                    if (emptyEl) emptyEl.style.display = 'none';
                    afficherCommandes(resCmd.commandes, listEl);
                } else {
                    commandesCache = [];
                    if (emptyEl) emptyEl.style.display = 'block';
                    if (listEl) listEl.innerHTML = '';
                }
            })
            .catch(err => {
                console.error('Erreur API commandes:', err);
                if (loadingEl) {
                    loadingEl.innerHTML = `<p style="color: var(--color-primary);">Impossible de charger vos commandes : ${err.message}</p>`;
                }
            });
    }

    function badgeAvisEnvoyeHtml() {
        return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: #DCFCE7; color: #166534; border-radius: 6px; font-size: 12px; font-weight: 700;">✓ Avis déjà envoyé</span>`;
    }

    function marquerCommandeCommeNotee(cmdId) {
        commandesDejaNotees.add(Number(cmdId));
        const btn = document.querySelector(`.btn-avis-order[data-id="${cmdId}"]`);
        if (btn) {
            btn.outerHTML = badgeAvisEnvoyeHtml();
        }
    }

    function formatDateHeureFr(rawDate) {
        if (!rawDate) return '';
        const d = new Date(String(rawDate).replace(' ', 'T'));
        if (isNaN(d.getTime())) return String(rawDate);
        return d.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(':', 'h').replace(' ', ' à ');
    }

    function afficherCommandes(commandes, container) {
        if (!container) return;
        container.innerHTML = '';

        commandes.forEach(cmd => {
            const card = document.createElement('article');
            card.className = 'order-card';

            const rawStatut = (cmd.statut || 'en_attente').toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            
            const rawDateCreation = cmd.date_creation || cmd.date_commande || cmd.created_at;
            const dateCreation = rawDateCreation ? new Date(rawDateCreation.replace(' ', 'T')).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Récemment';
            
            const rawDatePrestation = cmd.date_livraison_souhaitee || cmd.date_livraison;
            let datePrestation = 'Non précisée';
            if (rawDatePrestation) {
                const d = new Date(rawDatePrestation.replace(' ', 'T'));
                datePrestation = !isNaN(d.getTime())
                    ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : rawDatePrestation;
            }

            const nbConvivesAffiche = cmd.nb_convives || (cmd.articles && cmd.articles[0] && cmd.articles[0].nb_convives) || '-';
            const remiseMontant = parseFloat(cmd.montant_remise || 0);

            let badgeClass = 'status-en-attente';
            let libelleStatut = 'En attente';

            if (rawStatut.includes('valid') || rawStatut.includes('accept')) {
                badgeClass = 'status-accepte';
                libelleStatut = 'Validée';
            } else if (rawStatut.includes('prep')) {
                badgeClass = 'status-en-preparation';
                libelleStatut = 'En préparation';
            } else if (rawStatut.includes('livr')) {
                badgeClass = 'status-livre';
                libelleStatut = 'Livrée';
            } else if (rawStatut.includes('annul')) {
                badgeClass = 'status-annulee';
                libelleStatut = 'Annulée';
            }

            const peutModifierOuAnnuler = rawStatut.includes('attente') || rawStatut === 'creee' || rawStatut === 'cree';
            const estTerminee = rawStatut.includes('livr') || rawStatut.includes('term');
            const dejaNotee = commandesDejaNotees.has(Number(cmd.id));

            const timelineHtml = genererTimeline(rawStatut, cmd.historique || [], rawDateCreation);

            let actionAvisHtml = '';
            if (estTerminee) {
                actionAvisHtml = dejaNotee
                    ? badgeAvisEnvoyeHtml()
                    : `<button type="button" class="btn-avis-order" data-id="${cmd.id}">★ Laisser un avis</button>`;
            }

            card.innerHTML = `
                <div class="order-card-header">
                    <div>
                        <span class="order-num">Commande n° ${cmd.numero_commande || ('CMD-' + cmd.id)}</span>
                        <div class="order-date">Enregistrée le ${dateCreation}</div>
                    </div>
                    <div>
                        <span class="status-badge ${badgeClass}">${libelleStatut}</span>
                    </div>
                </div>

                <div class="order-card-body">
                    <img src="${cmd.image_url || '/assets/images/menus/default-menu.webp'}" 
                         alt="Menu ${cmd.menu_titre || 'Gourmand'}" 
                         class="order-thumb"
                         onerror="this.onerror=null; this.src='/assets/images/menus/default-menu.webp';">
                    
                    <div class="order-details">
                        <h4>${cmd.menu_titre || 'Formule Traiteur'}</h4>
                        <p><strong>Prestation :</strong> Pour ${nbConvivesAffiche} convives</p>
                        <p><strong>Date & Heure :</strong> ${datePrestation}</p>
                        <p><strong>Lieu de livraison :</strong> ${cmd.adresse_livraison || ''}, ${cmd.ville_livraison || cmd.ville || 'Bordeaux'}</p>
                    </div>

                    <div class="order-pricing">
                        <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Montant Total TTC</div>
                        <div class="order-total">${parseFloat(cmd.total_ttc || 0).toFixed(2).replace('.', ',')} €</div>
                        ${remiseMontant > 0 ? `<div style="font-size: 11px; color: #166534; font-weight: 700; margin-top: 2px;">Dont remise -10 % : -${remiseMontant.toFixed(2).replace('.', ',')} €</div>` : ''}
                        <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 3px;">Dont livraison : ${parseFloat(cmd.frais_livraison || 0).toFixed(2).replace('.', ',')} €</div>
                    </div>
                </div>

                ${timelineHtml}

                <div class="order-actions">
                    ${peutModifierOuAnnuler ? `
                        <button type="button" class="btn-edit-order" data-id="${cmd.id}">
                            ✎ Modifier cette commande
                        </button>
                        <button type="button" class="btn-cancel-order" data-id="${cmd.id}">
                            ✕ Annuler cette commande
                        </button>
                    ` : ''}

                    ${actionAvisHtml}
                </div>
            `;

            container.appendChild(card);
        });

        document.querySelectorAll('.btn-edit-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cmdId = Number(e.target.getAttribute('data-id'));
                const cmd = commandesCache.find(c => Number(c.id) === cmdId);
                if (cmd) ouvrirModalEditionCommande(cmd);
            });
        });

        document.querySelectorAll('.btn-cancel-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cmdId = e.target.getAttribute('data-id');
                if (confirm('Êtes-vous certain de vouloir annuler cette commande ? Cette action est irréversible.')) {
                    annulerCommande(cmdId);
                }
            });
        });

        document.querySelectorAll('.btn-avis-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cmdId = e.target.getAttribute('data-id');
                ouvrirModalAvis(cmdId);
            });
        });
    }

    function genererTimeline(statut, historique = [], dateCreationFallback = null) {
        const datesParStatut = {};
        if (Array.isArray(historique)) {
            historique.forEach(item => {
                const st = String(item.statut || '').toLowerCase();
                if (st && item.date_changement) {
                    datesParStatut[st] = formatDateHeureFr(item.date_changement);
                }
            });
        }
        if (!datesParStatut['en_attente'] && dateCreationFallback) {
            datesParStatut['en_attente'] = formatDateHeureFr(dateCreationFallback);
        }

        if (statut.includes('annul')) {
            const dateAnnul = datesParStatut['annulee'] ? ` le ${datesParStatut['annulee']}` : '';
            return `
                <div style="margin-top: 14px; padding: 12px; background: #FEF2F2; border-radius: 4px; font-size: 12px; color: #991B1B;">
                    ⚠️ Cette commande a été annulée${dateAnnul}.
                </div>
            `;
        }

        const etapes = [
            { key: 'en_attente', label: '1. Enregistrée' },
            { key: 'validee', label: '2. Validée Julie & José' },
            { key: 'en_preparation', label: '3. En cuisine' },
            { key: 'livree', label: '4. Livrée' }
        ];

        let indexAtteint = 0;
        if (statut.includes('valid') || statut.includes('accept')) indexAtteint = 1;
        if (statut.includes('prep')) indexAtteint = 2;
        if (statut.includes('livr') || statut.includes('term')) indexAtteint = 3;

        let stepsHtml = '';
        etapes.forEach((etape, i) => {
            let etatClass = '';
            if (i < indexAtteint) etatClass = 'completed';
            else if (i === indexAtteint) etatClass = 'current';

            const dateEtape = datesParStatut[etape.key]
                ? `<div class="timeline-date">${datesParStatut[etape.key]}</div>`
                : (i <= indexAtteint ? `<div class="timeline-date">Validé</div>` : '');

            stepsHtml += `
                <div class="timeline-step ${etatClass}">
                    <div class="timeline-circle">${i < indexAtteint ? '✓' : (i + 1)}</div>
                    <span class="timeline-label">${etape.label}</span>
                    ${dateEtape}
                </div>
            `;
        });

        return `<div class="timeline-tracker">${stepsHtml}</div>`;
    }

    // Calcul de distance Haversine depuis Bordeaux (12 Cours de l'Intendance)
    function calculerDistanceDepuisBordeaux(lat, lon) {
        const latBdx = 44.8412;
        const lonBdx = -0.5750;
        const R = 6371;
        const dLat = (lat - latBdx) * Math.PI / 180;
        const dLon = (lon - lonBdx) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(latBdx * Math.PI / 180) * Math.cos(lat * Math.PI / 180)
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 1.2 * 10) / 10;
    }

    async function rechercherVilleParCodePostal(cp) {
        const inputVille = document.getElementById('edit-cmd-ville');
        const datalist = document.getElementById('edit-villes-datalist');
        const inputDistance = document.getElementById('edit-cmd-distance');
        if (!/^\d{5}$/.test(cp)) return;

        try {
            const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,centre&format=json`);
            if (!res.ok) return;
            const communes = await res.json();

            if (Array.isArray(communes) && communes.length > 0) {
                if (datalist) {
                    datalist.innerHTML = communes.map(c => `<option value="${c.nom}">`).join('');
                }
                const communePrincipale = communes[0];
                if (inputVille) {
                    inputVille.value = communePrincipale.nom;
                }
                if (inputDistance) {
                    if (communePrincipale.nom.toLowerCase() === 'bordeaux') {
                        inputDistance.value = '0';
                    } else if (communePrincipale.centre && Array.isArray(communePrincipale.centre.coordinates)) {
                        const [lon, lat] = communePrincipale.centre.coordinates;
                        inputDistance.value = String(calculerDistanceDepuisBordeaux(lat, lon));
                    }
                }
                recalculerApercuModification();
            }
        } catch (err) {
            console.error('Erreur recherche code postal:', err);
        }
    }

    function recalculerApercuModification() {
        if (!commandeEnEdition) return;
        const convivesMin = parseInt(commandeEnEdition.convives_min || 4, 10);
        const prixUnit = parseFloat(commandeEnEdition.prix_unitaire_ttc || commandeEnEdition.prix_unitaire_facture || 0);

        const nbConvives = parseInt(document.getElementById('edit-cmd-convives').value, 10) || convivesMin;
        const ville = (document.getElementById('edit-cmd-ville').value || '').trim().toLowerCase();
        const distance = parseFloat(document.getElementById('edit-cmd-distance').value) || 0;

        const sousTotalBrut = nbConvives * prixUnit;
        const seuilReduction = convivesMin + 5;
        const aDroitReduction = nbConvives >= seuilReduction;
        const remise = aDroitReduction ? (sousTotalBrut * 0.10) : 0;
        const fraisLivraison = (ville === 'bordeaux' || ville === '') ? 0 : (5 + distance * 0.59);
        const totalEstime = Math.max(0, sousTotalBrut - remise + fraisLivraison);

        const discountInfoEl = document.getElementById('edit-cmd-discount-info');
        const totalPreviewEl = document.getElementById('edit-cmd-total-preview');

        if (discountInfoEl) {
            if (aDroitReduction) {
                discountInfoEl.innerHTML = `
                    <span style="display: inline-block; background: #DCFCE7; color: #166534; font-weight: 700; padding: 4px 10px; border-radius: 999px;">
                        🎉 Réduction -10 % appliquée (-${remise.toFixed(2).replace('.', ',')} €) pour +5 convives au-dessus du minimum !
                    </span>
                `;
            } else {
                const manquants = seuilReduction - nbConvives;
                discountInfoEl.innerHTML = `
                    <span style="color: #7A5810;">
                        💡 Ajoutez encore <strong>${manquants} convive${manquants > 1 ? 's' : ''}</strong> (dès ${seuilReduction} convives) pour bénéficier de <strong>-10 %</strong> sur les repas.
                    </span>
                `;
            }
        }

        if (totalPreviewEl) {
            totalPreviewEl.textContent = `${totalEstime.toFixed(2).replace('.', ',')} €`;
        }
    }

    function initialiserModalEditionCommande() {
        const modal = document.getElementById('modal-edit-commande-container');
        const btnClose = document.getElementById('btn-close-edit-cmd');
        const form = document.getElementById('form-edit-commande');
        const inputCp = document.getElementById('edit-cmd-cp');
        const inputConvives = document.getElementById('edit-cmd-convives');
        const inputVille = document.getElementById('edit-cmd-ville');
        const inputDistance = document.getElementById('edit-cmd-distance');

        if (btnClose && modal) {
            btnClose.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (inputCp) {
            inputCp.addEventListener('input', (e) => {
                const cp = e.target.value.replace(/\D/g, '').slice(0, 5);
                e.target.value = cp;
                if (cp.length === 5) {
                    rechercherVilleParCodePostal(cp);
                }
            });
        }

        [inputConvives, inputVille, inputDistance].forEach(el => {
            if (el) {
                el.addEventListener('input', recalculerApercuModification);
            }
        });

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const errorBox = document.getElementById('edit-cmd-error');
                const btnSubmit = document.getElementById('btn-submit-edit-cmd');
                const cmdId = document.getElementById('edit-cmd-id').value;

                if (errorBox) errorBox.style.display = 'none';
                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.textContent = 'Enregistrement...';
                }

                const rawDate = document.getElementById('edit-cmd-date').value;
                const dateFormatted = rawDate ? rawDate.replace('T', ' ') + ':00' : '';

                const payload = {
                    utilisateur_id: currentUserId,
                    nb_convives: parseInt(document.getElementById('edit-cmd-convives').value, 10),
                    date_livraison: dateFormatted,
                    adresse_livraison: document.getElementById('edit-cmd-adresse').value.trim(),
                    code_postal: document.getElementById('edit-cmd-cp').value.trim(),
                    ville_livraison: document.getElementById('edit-cmd-ville').value.trim(),
                    distance_km: parseFloat(document.getElementById('edit-cmd-distance').value) || 0
                };

                try {
                    const res = await fetch(`/api/commandes/${cmdId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();

                    if (res.ok && data.statut === 'succes') {
                        modal.style.display = 'none';
                        chargerMesCommandes(currentUserId);
                    } else {
                        const msg = Array.isArray(data.erreurs) ? data.erreurs.join(' ') : (data.message || 'Impossible de modifier cette commande.');
                        if (errorBox) {
                            errorBox.textContent = msg;
                            errorBox.style.display = 'block';
                        } else {
                            alert(msg);
                        }
                    }
                } catch (err) {
                    if (errorBox) {
                        errorBox.textContent = 'Erreur réseau lors de la modification.';
                        errorBox.style.display = 'block';
                    }
                } finally {
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = 'Enregistrer les modifications';
                    }
                }
            });
        }
    }

    function ouvrirModalEditionCommande(cmd) {
        commandeEnEdition = cmd;
        const modal = document.getElementById('modal-edit-commande-container');
        const errorBox = document.getElementById('edit-cmd-error');
        if (errorBox) errorBox.style.display = 'none';

        document.getElementById('edit-cmd-id').value = cmd.id;
        document.getElementById('edit-cmd-menu').value = cmd.menu_titre || 'Formule Traiteur';
        document.getElementById('edit-cmd-convives').value = cmd.nb_convives || cmd.convives_min || 4;
        document.getElementById('edit-cmd-convives').min = cmd.convives_min || 1;

        // Extraction automatique du code postal s'il est présent à la fin de l'adresse
        const rawAdresse = String(cmd.adresse_livraison || '').trim();
        const matchCp = rawAdresse.match(/^(.*?)\s+(\d{5})$/);
        if (matchCp) {
            document.getElementById('edit-cmd-adresse').value = matchCp[1];
            document.getElementById('edit-cmd-cp').value = matchCp[2];
        } else {
            document.getElementById('edit-cmd-adresse').value = rawAdresse;
            document.getElementById('edit-cmd-cp').value = user.code_postal || '33000';
        }

        document.getElementById('edit-cmd-ville').value = cmd.ville_livraison || cmd.ville || 'Bordeaux';
        document.getElementById('edit-cmd-distance').value = cmd.distance_km ?? 0;

        const rawDate = cmd.date_livraison_souhaitee || cmd.date_livraison || '';
        if (rawDate) {
            document.getElementById('edit-cmd-date').value = String(rawDate).replace(' ', 'T').slice(0, 16);
        }

        recalculerApercuModification();
        if (modal) modal.style.display = 'flex';
    }

    function annulerCommande(commandeId) {
        fetch(`/api/commandes/${commandeId}/annuler`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ utilisateur_id: currentUserId })
        })
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes') {
                alert('Votre commande a été annulée avec succès.');
                chargerMesCommandes(currentUserId);
            } else {
                alert('Erreur : ' + (res.message || 'Impossible d\'annuler cette commande.'));
            }
        })
        .catch(err => {
            console.error('Erreur annulation:', err);
            alert('Une erreur réseau est survenue.');
        });
    }

    // ==========================================
    // GESTION DU PROFIL PERSONNEL
    // ==========================================
    function initialiserProfilForm(userData, userId) {
        const inputPrenom = document.getElementById('prof-prenom');
        const inputNom = document.getElementById('prof-nom');
        const inputEmail = document.getElementById('prof-email');
        const inputTel = document.getElementById('prof-tel');
        const inputAdresse = document.getElementById('prof-adresse');
        const inputCp = document.getElementById('prof-cp');
        const inputVille = document.getElementById('prof-ville');
        const formProfil = document.getElementById('form-update-profil');

        if (inputPrenom) inputPrenom.value = userData.prenom || '';
        if (inputNom) inputNom.value = userData.nom || '';
        if (inputEmail) inputEmail.value = userData.email || '';
        if (inputTel) inputTel.value = userData.telephone || '';
        if (inputAdresse) inputAdresse.value = userData.adresse_postale || '';
        if (inputCp) inputCp.value = userData.code_postal || '';
        if (inputVille) inputVille.value = userData.ville || '';

        if (formProfil) {
            formProfil.addEventListener('submit', (e) => {
                e.preventDefault();
                const alertSuccess = document.getElementById('profil-alert-success');
                const alertError = document.getElementById('profil-alert-error');
                const btnSave = document.getElementById('btn-save-profil');

                if (alertSuccess) alertSuccess.style.display = 'none';
                if (alertError) alertError.style.display = 'none';
                if (btnSave) {
                    btnSave.disabled = true;
                    btnSave.textContent = 'Enregistrement en cours...';
                }

                const payload = {
                    id: userId,
                    prenom: inputPrenom.value.trim(),
                    nom: inputNom.value.trim(),
                    telephone: inputTel.value.trim(),
                    adresse_postale: inputAdresse.value.trim(),
                    code_postal: inputCp.value.trim(),
                    ville: inputVille.value.trim()
                };

                const newPwd = document.getElementById('prof-new-pwd').value.trim();
                if (newPwd) {
                    payload.nouveau_mot_de_passe = newPwd;
                }

                fetch('/api/utilisateurs/me', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(payload)
                })
                .then(res => res.json())
                .then(res => {
                    if (btnSave) {
                        btnSave.disabled = false;
                        btnSave.textContent = 'Enregistrer les modifications';
                    }

                    if (res.statut === 'succes') {
                        if (alertSuccess) {
                            alertSuccess.textContent = '✅ Vos informations ont été mises à jour avec succès.';
                            alertSuccess.style.display = 'block';
                        }
                        if (res.user) {
                            localStorage.setItem('user_profile', JSON.stringify(res.user));
                            majNavbar(res.user);
                        }
                        document.getElementById('prof-new-pwd').value = '';
                    } else {
                        if (alertError) {
                            alertError.textContent = res.message || 'Une erreur est survenue lors de la mise à jour.';
                            alertError.style.display = 'block';
                        }
                    }
                })
                .catch(err => {
                    console.error('Erreur update profil:', err);
                    if (btnSave) {
                        btnSave.disabled = false;
                        btnSave.textContent = 'Enregistrer les modifications';
                    }
                    if (alertError) {
                        alertError.textContent = 'Erreur technique lors de la communication avec le serveur.';
                        alertError.style.display = 'block';
                    }
                });
            });
        }
    }

    // ==========================================
    // GESTION DU DÉPÔT D'AVIS SUR COMMANDE LIVRÉE
    // ==========================================
    function initialiserGestionAvis() {
        const modal = document.getElementById('modal-avis-container');
        const btnClose = document.getElementById('btn-close-avis');
        const formAvis = document.getElementById('form-avis');

        if (btnClose && modal) {
            btnClose.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (formAvis) {
            formAvis.addEventListener('submit', async (e) => {
                e.preventDefault();
                const cmdId = parseInt(document.getElementById('avis-commande-id').value);
                const note = parseInt(document.getElementById('avis-note').value);
                const commentaire = document.getElementById('avis-commentaire').value.trim();
                const submitBtn = formAvis.querySelector('button[type="submit"]');

                if (!commentaire) {
                    alert('Veuillez rédiger un commentaire.');
                    return;
                }

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Envoi en cours...';
                }

                try {
                    const res = await fetch('/api/avis', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({
                            commande_id: cmdId,
                            utilisateur_id: currentUserId,
                            note: note,
                            commentaire: commentaire
                        })
                    });

                    const data = await res.json();

                    if (res.ok && data.statut === 'succes') {
                        marquerCommandeCommeNotee(cmdId);
                        alert(`Merci pour votre retour ! Votre avis (${note}/5) a été transmis à l'équipe Vite & Gourmand et sera publié après validation.`);
                        if (modal) modal.style.display = 'none';
                        formAvis.reset();
                    } else if (res.status === 409) {
                        marquerCommandeCommeNotee(cmdId);
                        alert(data.message || 'Vous avez déjà déposé un avis pour cette commande.');
                        if (modal) modal.style.display = 'none';
                    } else {
                        alert('Erreur : ' + (data.message || 'Impossible d\'enregistrer votre avis.'));
                    }
                } catch (err) {
                    console.error('Erreur envoi avis:', err);
                    alert('Erreur de communication avec le serveur.');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Envoyer mon avis';
                    }
                }
            });
        }
    }

    function ouvrirModalAvis(commandeId) {
        const modal = document.getElementById('modal-avis-container');
        const inputId = document.getElementById('avis-commande-id');
        if (inputId) inputId.value = commandeId;
        if (modal) modal.style.display = 'flex';
    }

    // ==========================================
    // SYNCHRONISATION DE LA NAVBAR
    // ==========================================
    function majNavbar(userData) {
        const navConnexionLink = document.querySelector('.btn-connexion') || 
                                 document.querySelector('a[href*="login"]') || 
                                 Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim().toLowerCase() === 'connexion');

        if (navConnexionLink && userData) {
            const isAdmin = (userData.role === 'admin' || userData.role === 'employe');
            const profileWrapper = document.createElement('div');
            profileWrapper.style.cssText = 'display: inline-flex; align-items: center; justify-content: flex-end; gap: 10px; justify-self: end;';
            profileWrapper.innerHTML = `
                ${isAdmin ? `
                    <a href="/admin.html" style="background: var(--color-primary, #721B29); color: #FFFFFF; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                        ⚙️ Admin
                    </a>
                ` : ''}
                <a href="/compte.html" style="text-decoration: none; font-size: 13px; font-weight: 700; color: var(--color-primary, #721B29); display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                    👤 ${userData.prenom || ''}
                </a>
                <button type="button" id="btn-logout" style="background: none; border: 1px solid var(--color-primary, #721B29); color: var(--color-primary, #721B29); padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                    Déconnexion
                </button>
            `;

            navConnexionLink.replaceWith(profileWrapper);

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
});