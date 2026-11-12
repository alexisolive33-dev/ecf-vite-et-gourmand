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

    // Récupération sécurisée de l'ID utilisateur (tolérance id ou utilisateur_id)
    const currentUserId = user.id || user.utilisateur_id;

    // Mise à jour de la navbar et du message de bienvenue
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
    chargerMesCommandes(currentUserId);
    initialiserGestionAvis();
    
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
                        alert(`Merci pour votre retour ! Votre avis (${note}/5) a été transmis à l'équipe Vite & Gourmand et sera publié après validation.`);
                        if (modal) modal.style.display = 'none';
                        formAvis.reset();
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

    // ==========================================
    // GESTION DES COMMANDES (HISTORIQUE & SUIVI)
    // ==========================================
    function chargerMesCommandes(userId) {
        const loadingEl = document.getElementById('orders-loading');
        const emptyEl = document.getElementById('orders-empty');
        const listEl = document.getElementById('orders-list');

        fetch(`/api/commandes/mes-commandes?utilisateur_id=${userId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || `Erreur HTTP ${res.status}`);
            }
            return data;
        })
        .then(res => {
            if (loadingEl) loadingEl.style.display = 'none';

            if (res.statut === 'succes' && res.commandes && res.commandes.length > 0) {
                if (emptyEl) emptyEl.style.display = 'none';
                afficherCommandes(res.commandes, listEl);
            } else {
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

    function afficherCommandes(commandes, container) {
        if (!container) return;
        container.innerHTML = '';

        commandes.forEach(cmd => {
            const card = document.createElement('article');
            card.className = 'order-card';

            const rawStatut = (cmd.statut || 'en_attente').toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            
            // Formatage de la date de création de la commande
            const rawDateCreation = cmd.date_creation || cmd.date_commande || cmd.created_at;
            const dateCreation = rawDateCreation ? new Date(rawDateCreation.replace(' ', 'T')).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Récemment';
            
            // Formatage résilient de la date de livraison souhaitée
            const rawDatePrestation = cmd.date_livraison_souhaitee || cmd.date_livraison;
            let datePrestation = 'Non précisée';
            if (rawDatePrestation) {
                const d = new Date(rawDatePrestation.replace(' ', 'T'));
                datePrestation = !isNaN(d.getTime())
                    ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : rawDatePrestation;
            }

            // Nombre de convives récupéré depuis ligne_commande
            const nbConvivesAffiche = cmd.nb_convives || (cmd.articles && cmd.articles[0] && cmd.articles[0].nb_convives) || '-';

            // Classe CSS et libellé du badge
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

            // Possibilité d'annulation : tant que la commande est "en_attente"
            const peutAnnuler = rawStatut.includes('attente') || rawStatut === 'creee' || rawStatut === 'cree';
            const estTerminee = rawStatut.includes('livr') || rawStatut.includes('term');

            const timelineHtml = genererTimeline(rawStatut);

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
                        <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 4px;">Dont livraison : ${parseFloat(cmd.frais_livraison || 0).toFixed(2).replace('.', ',')} €</div>
                    </div>
                </div>

                <!-- Suivi chronologique de la commande -->
                ${timelineHtml}

                <div class="order-actions">
                    ${peutAnnuler ? `
                        <button type="button" class="btn-cancel-order" data-id="${cmd.id}">
                            ✕ Annuler cette commande
                        </button>
                    ` : ''}

                    ${estTerminee ? `
                        <button type="button" class="btn-avis-order" data-id="${cmd.id}">
                            ★ Laisser un avis
                        </button>
                    ` : ''}
                </div>
            `;

            container.appendChild(card);
        });

        // Écouteurs d'annulation
        document.querySelectorAll('.btn-cancel-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cmdId = e.target.getAttribute('data-id');
                if (confirm('Êtes-vous certain de vouloir annuler cette commande ? Cette action est irréversible.')) {
                    annulerCommande(cmdId);
                }
            });
        });

        // Écouteurs de dépôt d'avis
        document.querySelectorAll('.btn-avis-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cmdId = e.target.getAttribute('data-id');
                ouvrirModalAvis(cmdId);
            });
        });
    }

    function genererTimeline(statut) {
        if (statut.includes('annul')) {
            return `
                <div style="margin-top: 14px; padding: 12px; background: #FEF2F2; border-radius: 4px; font-size: 12px; color: #991B1B;">
                    ⚠️ Cette commande a été annulée.
                </div>
            `;
        }

        const etapes = [
            { key: 'attente', label: '1. Enregistrée' },
            { key: 'validee', label: '2. Validée Julie & José' },
            { key: 'preparation', label: '3. En cuisine' },
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

            stepsHtml += `
                <div class="timeline-step ${etatClass}">
                    <div class="timeline-circle">${i < indexAtteint ? '✓' : (i + 1)}</div>
                    <span class="timeline-label">${etape.label}</span>
                </div>
            `;
        });

        return `<div class="timeline-tracker">${stepsHtml}</div>`;
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
            formAvis.addEventListener('submit', (e) => {
                e.preventDefault();
                const cmdId = document.getElementById('avis-commande-id').value;
                const note = document.getElementById('avis-note').value;

                alert(`Merci pour votre retour ! Votre note de ${note}/5 étoiles a bien été transmise à Julie & José.`);
                if (modal) modal.style.display = 'none';
                formAvis.reset();
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