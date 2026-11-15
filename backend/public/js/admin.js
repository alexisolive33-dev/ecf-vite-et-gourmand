document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    const userRaw = sessionStorage.getItem('vg_user') || localStorage.getItem('user_profile') || localStorage.getItem('user');

    if (!userRaw) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin.html');
        return;
    }

    let user = null;
    try {
        user = JSON.parse(userRaw);
    } catch (e) {
        user = null;
    }

    if (!user) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin.html');
        return;
    }

    const role = (user.role || '').toLowerCase().trim();
    if (role !== 'admin' && role !== 'employe') {
        alert("Accès réservé à l'équipe Vite & Gourmand.");
        window.location.href = '/compte.html';
        return;
    }

    if (!sessionStorage.getItem('vg_user')) {
        sessionStorage.setItem('vg_user', JSON.stringify(user));
    }

    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        const roleAffiche = user.role ? user.role.toUpperCase() : 'ADMIN';
        userDisplay.textContent = `👤 ${user.prenom || 'José'} ${user.nom || 'Gourmand'} (${roleAffiche})`;
    }

    if (role === 'employe') {
        const pageTitle = document.querySelector('h1');
        if (pageTitle) pageTitle.textContent = 'Espace Collaborateur — Menus, Commandes, Horaires & Avis';
        const tagline = document.querySelector('.brand-tagline');
        if (tagline) tagline.textContent = 'Espace Équipe • Vite & Gourmand';
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.clear();
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_profile');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        });
    }

    const statsContainer = document.getElementById('stats-container');
    const menusTableBody = document.getElementById('menus-table-body');
    const tableBody = document.getElementById('orders-table-body');
    const avisTableBody = document.getElementById('avis-table-body');
    const contactsTableBody = document.getElementById('contacts-table-body');

    let referentielPlats = [];
    let referentielAllergenes = [];
    let menusCache = [];
    let commandesCache = [];
    let selectEnCoursAnnulation = null;
    let statutPrecedentAnnulation = 'en_attente';

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // 1. Statistiques MongoDB
    chargerStatsMongo();

    function chargerStatsMongo() {
        if (!statsContainer) return;
        fetch('/api/stats/popularite')
            .then(res => res.json())
            .then(res => {
                if (res.statut === 'succes' && res.donnees && res.donnees.length > 0) {
                    statsContainer.innerHTML = '';
                    res.donnees.forEach(stat => {
                        const card = document.createElement('div');
                        card.className = 'stat-card-box';
                        card.innerHTML = `
                            <h4>${escapeHtml(stat.titre || 'Menu')}</h4>
                            <div class="stat-card-number">${stat.nb_vues || 0} <span>vues</span></div>
                        `;
                        statsContainer.appendChild(card);
                    });
                } else {
                    statsContainer.innerHTML = '<p style="color: var(--color-text-muted);">Aucune donnée de consultation enregistrée.</p>';
                }
            })
            .catch(() => {
                statsContainer.innerHTML = '<p style="color: var(--color-text-muted);">Indicateurs NoSQL temporairement indisponibles.</p>';
            });
    }

    // =========================================================================
    // 2. GESTION DES MENUS ET PLATS
    // =========================================================================
    const menuEditorPanel = document.getElementById('menu-editor-panel');
    const menuEditorTitle = document.getElementById('menu-editor-title');
    const menuForm = document.getElementById('menu-form');
    const btnOpenMenuForm = document.getElementById('btn-open-menu-form');
    const btnCancelMenu = document.getElementById('btn-cancel-menu');

    const platEditorPanel = document.getElementById('plat-editor-panel');
    const platForm = document.getElementById('plat-form');
    const btnTogglePlatForm = document.getElementById('btn-toggle-plat-form');
    const btnCancelPlat = document.getElementById('btn-cancel-plat');

    if (btnOpenMenuForm) {
        btnOpenMenuForm.addEventListener('click', () => {
            resetMenuForm();
            menuEditorPanel.style.display = 'block';
            menuEditorPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }

    if (btnCancelMenu) {
        btnCancelMenu.addEventListener('click', () => {
            menuEditorPanel.style.display = 'none';
            resetMenuForm();
        });
    }

    if (btnTogglePlatForm) {
        btnTogglePlatForm.addEventListener('click', () => {
            platEditorPanel.style.display = platEditorPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (btnCancelPlat) {
        btnCancelPlat.addEventListener('click', () => {
            platEditorPanel.style.display = 'none';
            platForm.reset();
        });
    }

    chargerReferentielPlats().then(() => chargerMenus());

    async function chargerReferentielPlats(selectedPlatIds = []) {
        try {
            const res = await fetch('/api/admin/menus/referentiel', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (data.statut === 'succes') {
                referentielPlats = data.plats || [];
                referentielAllergenes = data.allergenes || [];
                renderSelecteurPlats(selectedPlatIds);
                renderSelecteurAllergenes();
            }
        } catch (err) {
            console.error('Erreur chargement référentiel plats:', err);
        }
    }

    function renderSelecteurAllergenes() {
        const container = document.getElementById('plat-allergenes-list');
        if (!container) return;
        container.innerHTML = referentielAllergenes.map(a => `
            <label class="plat-check-item">
                <input type="checkbox" name="plat_allergenes" value="${a.id}">
                <span>${escapeHtml(a.nom)}</span>
            </label>
        `).join('');
    }

    function renderSelecteurPlats(selectedIds = []) {
        const container = document.getElementById('menu-plats-selector');
        if (!container) return;

        const selectedSet = new Set(selectedIds.map(id => Number(id)));
        const categories = [
            { key: 'entree', label: 'Entrées' },
            { key: 'plat', label: 'Plats principaux' },
            { key: 'dessert', label: 'Desserts' }
        ];

        container.innerHTML = categories.map(cat => {
            const items = referentielPlats.filter(p => p.categorie === cat.key);
            const listHtml = items.length > 0
                ? items.map(p => {
                    const allergenesTxt = (p.allergenes && p.allergenes.length > 0)
                        ? ` <small style="color:#92400E;">(${p.allergenes.map(a => escapeHtml(a.nom)).join(', ')})</small>`
                        : '';
                    return `
                        <label class="plat-check-item">
                            <input type="checkbox" name="menu_plats" value="${p.id}" ${selectedSet.has(Number(p.id)) ? 'checked' : ''}>
                            <span>${escapeHtml(p.nom)}${allergenesTxt}</span>
                        </label>
                    `;
                }).join('')
                : '<p style="font-size:12px; color:var(--color-text-muted);">Aucun plat dans cette catégorie.</p>';

            return `
                <div class="plats-category-box">
                    <h5>${cat.label}</h5>
                    ${listHtml}
                </div>
            `;
        }).join('');
    }

    if (platForm) {
        platForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const checkedMenuPlats = Array.from(document.querySelectorAll('input[name="menu_plats"]:checked')).map(cb => Number(cb.value));
            const allergeneIds = Array.from(document.querySelectorAll('input[name="plat_allergenes"]:checked')).map(cb => Number(cb.value));

            const payload = {
                nom: document.getElementById('plat-nom').value.trim(),
                categorie: document.getElementById('plat-categorie').value,
                description: document.getElementById('plat-description').value.trim(),
                allergene_ids: allergeneIds
            };

            try {
                const res = await fetch('/api/admin/plats', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.statut === 'succes') {
                    platForm.reset();
                    platEditorPanel.style.display = 'none';
                    if (data.id) checkedMenuPlats.push(Number(data.id));
                    await chargerReferentielPlats(checkedMenuPlats);
                } else {
                    alert('Erreur : ' + (data.message || 'Impossible d’ajouter ce plat.'));
                }
            } catch (err) {
                alert('Erreur réseau lors de l’ajout du plat.');
            }
        });
    }

    function resetMenuForm() {
        document.getElementById('menu-id').value = '';
        menuForm.reset();
        document.getElementById('menu-convives').value = '4';
        document.getElementById('menu-stock').value = '10';
        document.getElementById('menu-delai').value = '7';
        document.getElementById('menu-stockage').value = 'Conserver entre 0°C et +4°C';
        menuEditorTitle.textContent = 'Créer un nouveau menu';
        document.getElementById('btn-submit-menu').textContent = 'Enregistrer le menu';
        renderSelecteurPlats([]);
    }

    function ouvrirEditionMenu(menu) {
        document.getElementById('menu-id').value = menu.id;
        document.getElementById('menu-titre').value = menu.titre || '';
        document.getElementById('menu-theme').value = menu.theme || 'classique';
        document.getElementById('menu-regime').value = menu.regime || 'classique';
        document.getElementById('menu-prix').value = menu.prix_unitaire_ttc || '';
        document.getElementById('menu-convives').value = menu.convives_min || 4;
        document.getElementById('menu-stock').value = menu.stock_disponible ?? 0;
        document.getElementById('menu-delai').value = menu.delai_min_jours ?? 7;
        document.getElementById('menu-stockage').value = menu.conditions_stockage || 'Conserver entre 0°C et +4°C';
        document.getElementById('menu-image').value = menu.image_url || '';
        document.getElementById('menu-description').value = menu.description || '';

        const platIds = (menu.plats || []).map(p => Number(p.id));
        renderSelecteurPlats(platIds);

        menuEditorTitle.textContent = `Modifier le menu : ${menu.titre}`;
        document.getElementById('btn-submit-menu').textContent = 'Mettre à jour le menu';
        menuEditorPanel.style.display = 'block';
        menuEditorPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (menuForm) {
        menuForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const menuId = document.getElementById('menu-id').value;
            const platIds = Array.from(document.querySelectorAll('input[name="menu_plats"]:checked')).map(cb => Number(cb.value));

            const payload = {
                titre: document.getElementById('menu-titre').value.trim(),
                theme: document.getElementById('menu-theme').value,
                regime: document.getElementById('menu-regime').value,
                prix_unitaire_ttc: parseFloat(document.getElementById('menu-prix').value),
                convives_min: parseInt(document.getElementById('menu-convives').value, 10),
                stock_disponible: parseInt(document.getElementById('menu-stock').value, 10),
                delai_min_jours: parseInt(document.getElementById('menu-delai').value, 10),
                conditions_stockage: document.getElementById('menu-stockage').value.trim(),
                image_url: document.getElementById('menu-image').value.trim(),
                description: document.getElementById('menu-description').value.trim(),
                plat_ids: platIds
            };

            const url = menuId ? `/api/admin/menus/${menuId}` : '/api/admin/menus';
            const method = menuId ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.statut === 'succes') {
                    menuEditorPanel.style.display = 'none';
                    resetMenuForm();
                    chargerMenus();
                    chargerStatsMongo();
                } else {
                    alert('Erreur : ' + (data.message || 'Impossible d’enregistrer le menu.'));
                }
            } catch (err) {
                alert('Erreur réseau lors de l’enregistrement du menu.');
            }
        });
    }

    function chargerMenus() {
        if (!menusTableBody) return;
        fetch('/api/menus')
            .then(res => res.json())
            .then(res => {
                menusCache = res.donnees || [];
                if (res.statut === 'succes' && menusCache.length > 0) {
                    renderMenus(menusCache);
                } else {
                    menusTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--color-text-muted);">Aucun menu actif dans le catalogue.</td></tr>';
                }
            })
            .catch(() => {
                menusTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-primary); padding: 20px;">Erreur de chargement des menus.</td></tr>';
            });
    }

    function renderMenus(menus) {
        menusTableBody.innerHTML = '';

        const labelsTheme = { noel: 'Noël', paques: 'Pâques', classique: 'Classique', evenement: 'Événement' };
        const labelsRegime = { classique: 'Classique', vegetarien: 'Végétarien', vegan: 'Vegan' };

        menus.forEach(menu => {
            const tr = document.createElement('tr');
            const prixUnit = parseFloat(menu.prix_unitaire_ttc || 0);
            const convivesMin = parseInt(menu.convives_min || 4, 10);
            const totalMin = (prixUnit * convivesMin).toFixed(2).replace('.', ',');
            const prixUnitStr = prixUnit.toFixed(2).replace('.', ',');

            const platsResume = (menu.plats && menu.plats.length > 0)
                ? menu.plats.map(p => escapeHtml(p.nom)).join(' • ')
                : '<em style="color:var(--color-text-muted);">Aucun plat associé</em>';

            const stock = parseInt(menu.stock_disponible || 0, 10);
            const stockBadgeClass = stock > 3 ? 'publie' : 'en-attente';

            tr.innerHTML = `
                <td>
                    <img src="${escapeHtml(menu.image_url)}" alt="${escapeHtml(menu.titre)}" class="menu-thumb" onerror="this.style.display='none'">
                </td>
                <td style="max-width: 340px;">
                    <div><strong>${escapeHtml(menu.titre)}</strong></div>
                    <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">${platsResume}</div>
                </td>
                <td>
                    <span class="user-badge" style="font-size: 11px; padding: 3px 10px;">
                        ${escapeHtml(labelsTheme[menu.theme] || menu.theme)} • ${escapeHtml(labelsRegime[menu.regime] || menu.regime)}
                    </span>
                </td>
                <td>
                    <div><strong>${prixUnitStr} €</strong> / pers.</div>
                    <small style="color: var(--color-text-muted);">Min. ${convivesMin} pers. (${totalMin} €)</small>
                </td>
                <td>
                    <div><span class="avis-badge ${stockBadgeClass}">${stock} dispo.</span></div>
                    <small style="color: var(--color-text-muted);">Délai ${menu.delai_min_jours}j • ${escapeHtml(menu.conditions_stockage)}</small>
                </td>
                <td style="white-space: nowrap;">
                    <button type="button" class="btn-avis-approve btn-menu-edit" data-id="${menu.id}">✎ Modifier</button>
                    <button type="button" class="btn-avis-reject btn-menu-delete" data-id="${menu.id}">✕ Supprimer</button>
                </td>
            `;
            menusTableBody.appendChild(tr);
        });

        document.querySelectorAll('.btn-menu-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.target.getAttribute('data-id'));
                const menu = menusCache.find(m => Number(m.id) === id);
                if (menu) ouvrirEditionMenu(menu);
            });
        });

        document.querySelectorAll('.btn-menu-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (!confirm('Retirer ce menu du catalogue ?')) return;

                try {
                    const res = await fetch(`/api/admin/menus/${id}`, {
                        method: 'DELETE',
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    const data = await res.json();
                    if (res.ok && data.statut === 'succes') {
                        chargerMenus();
                    } else {
                        alert('Erreur : ' + (data.message || 'Impossible de supprimer ce menu.'));
                    }
                } catch (err) {
                    alert('Erreur réseau lors de la suppression.');
                }
            });
        });
    }

    // =========================================================================
    // 3. GESTION DES COMMANDES (FILTRES, STATUTS COMPLETS & ANNULATION STAFF)
    // =========================================================================
    const filterStatutEl = document.getElementById('filter-order-statut');
    const filterClientEl = document.getElementById('filter-order-client');
    const btnResetFilters = document.getElementById('btn-reset-order-filters');

    if (filterStatutEl) filterStatutEl.addEventListener('change', appliquerFiltresCommandes);
    if (filterClientEl) filterClientEl.addEventListener('input', appliquerFiltresCommandes);
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
            if (filterStatutEl) filterStatutEl.value = '';
            if (filterClientEl) filterClientEl.value = '';
            appliquerFiltresCommandes();
        });
    }

    initialiserModalAnnulationStaff();
    chargerCommandes();

    function chargerCommandes() {
        if (!tableBody) return;

        fetch('/api/admin/commandes', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
            .then(res => res.json())
            .then(res => {
                if (res.statut === 'succes' && res.commandes) {
                    commandesCache = res.commandes;
                    appliquerFiltresCommandes();
                } else {
                    commandesCache = [];
                    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--color-text-muted);">Aucune commande trouvée.</td></tr>';
                }
            })
            .catch(() => {
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--color-primary); padding: 20px;">Erreur de chargement des commandes.</td></tr>';
            });
    }

    function appliquerFiltresCommandes() {
        const statutFiltre = filterStatutEl ? filterStatutEl.value : '';
        const recherche = filterClientEl ? filterClientEl.value.toLowerCase().trim() : '';

        const filtrees = commandesCache.filter(cmd => {
            const st = String(cmd.statut || 'en_attente').toLowerCase();
            if (statutFiltre && st !== statutFiltre) {
                return false;
            }
            if (recherche) {
                const haystack = [
                    cmd.numero_commande,
                    cmd.client_prenom,
                    cmd.client_nom,
                    cmd.client_email,
                    cmd.ville_livraison
                ].join(' ').toLowerCase();
                if (!haystack.includes(recherche)) {
                    return false;
                }
            }
            return true;
        });

        if (filtrees.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--color-text-muted);">Aucune commande ne correspond à ces critères.</td></tr>';
            return;
        }
        renderCommandes(filtrees);
    }

    function renderCommandes(commandes) {
        tableBody.innerHTML = '';

        commandes.forEach(cmd => {
            const tr = document.createElement('tr');
            const prenom = cmd.client_prenom || cmd.prenom || 'Client';
            const nom = cmd.client_nom || cmd.nom || '';
            const email = cmd.client_email || cmd.email || '-';
            const tel = cmd.client_telephone || '';
            const idCommande = cmd.id || cmd.commande_id;
            const numeroCommande = cmd.numero_commande || (`CMD-${idCommande}`);

            const rawDate = cmd.date_livraison_souhaitee || cmd.date_livraison;
            let dateLivraison = '-';
            if (rawDate && rawDate !== '-') {
                const d = new Date(rawDate.replace(' ', 'T'));
                dateLivraison = !isNaN(d.getTime())
                    ? d.toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      }).replace(':', 'h').replace(' ', ' à ')
                    : rawDate;
            }

            const rawVille = cmd.ville_livraison || cmd.ville || 'Bordeaux';
            const ville = rawVille
                .toLowerCase()
                .split(' ')
                .map(mot => mot.charAt(0).toUpperCase() + mot.slice(1))
                .join(' ');
            
            const distanceKm = Math.round(parseFloat(cmd.distance_km || cmd.distance || 0));
            const totalTtc = parseFloat(cmd.total_ttc || 0).toFixed(2).replace('.', ',');

            let articleStr = '-';
            if (cmd.articles && Array.isArray(cmd.articles) && cmd.articles.length > 0) {
                articleStr = cmd.articles.map(a => `${a.menu_titre || a.titre} (${a.nb_convives || '-'} p.)`).join(', ');
            } else if (cmd.menu_titre || cmd.titre) {
                articleStr = `${cmd.menu_titre || cmd.titre} (${cmd.nb_convives || '-'} p.)`;
            }

            const st = String(cmd.statut || 'en_attente').toLowerCase().trim();
            const motifInfo = (st === 'annulee' && cmd.motif_annulation)
                ? `<div style="font-size: 11px; color: #991B1B; margin-top: 4px;">Contact : ${escapeHtml(cmd.mode_contact_annulation || '-')} • ${escapeHtml(cmd.motif_annulation)}</div>`
                : '';

            tr.innerHTML = `
                <td><strong>${escapeHtml(numeroCommande)}</strong></td>
                <td>
                    <div>${escapeHtml(prenom)} ${escapeHtml(nom)}</div>
                    <small style="color: var(--color-text-muted);">${escapeHtml(email)}</small>
                    ${tel ? `<br><small style="color: var(--color-text-muted);">📞 ${escapeHtml(tel)}</small>` : ''}
                </td>
                <td>${dateLivraison}</td>
                <td>${escapeHtml(ville)} <small>(${distanceKm} km)</small></td>
                <td>${escapeHtml(articleStr)}${motifInfo}</td>
                <td><strong>${totalTtc} €</strong></td>
                <td>
                    <select class="status-select" data-id="${idCommande}" data-prev="${escapeHtml(st)}" style="padding: 5px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">
                        <option value="en_attente" ${st === 'en_attente' ? 'selected' : ''}>En attente</option>
                        <option value="validee" ${st === 'validee' ? 'selected' : ''}>Acceptée</option>
                        <option value="en_preparation" ${st === 'en_preparation' ? 'selected' : ''}>En préparation</option>
                        <option value="en_cours_livraison" ${st === 'en_cours_livraison' ? 'selected' : ''}>En cours de livraison</option>
                        <option value="livree" ${st === 'livree' ? 'selected' : ''}>Livrée</option>
                        <option value="attente_retour_materiel" ${st === 'attente_retour_materiel' ? 'selected' : ''}>En attente du retour de matériel</option>
                        <option value="terminee" ${st === 'terminee' ? 'selected' : ''}>Terminée</option>
                        <option value="annulee" ${st === 'annulee' ? 'selected' : ''}>Annulée</option>
                    </select>
                </td>
            `;

            tableBody.appendChild(tr);
        });

        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const cmdId = e.target.getAttribute('data-id');
                const nouveauStatut = e.target.value;
                const ancienStatut = e.target.getAttribute('data-prev') || 'en_attente';

                if (nouveauStatut === 'annulee') {
                    selectEnCoursAnnulation = e.target;
                    statutPrecedentAnnulation = ancienStatut;
                    document.getElementById('cancel-cmd-id').value = cmdId;
                    document.getElementById('cancel-mode-contact').value = '';
                    document.getElementById('cancel-motif').value = '';
                    document.getElementById('modal-staff-cancel').style.display = 'flex';
                    return;
                }

                await envoyerMiseAJourStatut(cmdId, nouveauStatut, e.target);
            });
        });
    }

    function initialiserModalAnnulationStaff() {
        const modal = document.getElementById('modal-staff-cancel');
        const btnAbort = document.getElementById('btn-abort-staff-cancel');
        const form = document.getElementById('form-staff-cancel');

        if (btnAbort && modal) {
            btnAbort.addEventListener('click', () => {
                if (selectEnCoursAnnulation) {
                    selectEnCoursAnnulation.value = statutPrecedentAnnulation;
                    selectEnCoursAnnulation = null;
                }
                modal.style.display = 'none';
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const cmdId = document.getElementById('cancel-cmd-id').value;
                const modeContact = document.getElementById('cancel-mode-contact').value;
                const motif = document.getElementById('cancel-motif').value.trim();

                if (!modeContact || !motif) {
                    alert('Veuillez renseigner le mode de contact et le motif d’annulation.');
                    return;
                }

                const ok = await envoyerMiseAJourStatut(cmdId, 'annulee', selectEnCoursAnnulation, {
                    mode_contact: modeContact,
                    motif_annulation: motif
                });

                if (ok) {
                    modal.style.display = 'none';
                    selectEnCoursAnnulation = null;
                }
            });
        }
    }

    async function envoyerMiseAJourStatut(cmdId, nouveauStatut, selectElement, extra = {}) {
        try {
            const res = await fetch(`/api/admin/commandes/${cmdId}/statut`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ statut: nouveauStatut, ...extra })
            });

            const data = await res.json();

            if (res.ok && data.statut === 'succes') {
                if (nouveauStatut === 'attente_retour_materiel' || nouveauStatut === 'annulee') {
                    alert(data.message);
                } else if (selectElement) {
                    selectElement.style.backgroundColor = '#DCFCE7';
                    setTimeout(() => { selectElement.style.backgroundColor = ''; }, 1000);
                }
                chargerCommandes();
                return true;
            } else {
                alert('Erreur : ' + (data.message || 'Impossible de mettre à jour le statut.'));
                chargerCommandes();
                return false;
            }
        } catch (err) {
            alert('Erreur de connexion au serveur.');
            chargerCommandes();
            return false;
        }
    }

    // =========================================================================
    // 4. GESTION DES HORAIRES D'OUVERTURE (ADMIN & EMPLOYÉ)
    // =========================================================================
    chargerHoraires();

    function chargerHoraires() {
        const container = document.getElementById('horaires-inputs-container');
        if (!container) return;

        fetch('/api/horaires')
            .then(res => res.json())
            .then(res => {
                const liste = res.horaires || [];
                if (res.statut === 'succes' && liste.length > 0) {
                    container.innerHTML = liste.map(h => `
                        <div class="menu-form-group">
                            <label for="horaire-${h.id}">${escapeHtml(h.jour_semaine)}</label>
                            <input type="text" id="horaire-${h.id}" data-horaire-id="${h.id}" value="${escapeHtml(h.heures_ouverture)}" required>
                        </div>
                    `).join('');
                } else {
                    container.innerHTML = '<p style="font-size:13px; color:var(--color-text-muted);">Aucun horaire configuré.</p>';
                }
            })
            .catch(() => {
                container.innerHTML = '<p style="font-size:13px; color:var(--color-primary);">Erreur lors du chargement des horaires.</p>';
            });
    }

    const horairesForm = document.getElementById('horaires-form');
    if (horairesForm) {
        horairesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputs = document.querySelectorAll('[data-horaire-id]');
            const horaires = Array.from(inputs).map(inp => ({
                id: Number(inp.getAttribute('data-horaire-id')),
                heures_ouverture: inp.value.trim()
            }));

            try {
                const res = await fetch('/api/admin/horaires', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ horaires })
                });
                const data = await res.json();
                if (res.ok && data.statut === 'succes') {
                    alert('Les horaires d’ouverture ont été mis à jour avec succès.');
                } else {
                    alert('Erreur : ' + (data.message || 'Impossible de sauvegarder les horaires.'));
                }
            } catch (err) {
                alert('Erreur réseau lors de la mise à jour des horaires.');
            }
        });
    }

    // =========================================================================
    // 5. MODÉRATION DES AVIS CLIENTS
    // =========================================================================
    chargerAvis();

    function chargerAvis() {
        if (!avisTableBody) return;

        fetch('/api/admin/avis', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
            .then(res => res.json())
            .then(res => {
                const listeAvis = res.avis || res.donnees || [];
                if (res.statut === 'succes' && listeAvis.length > 0) {
                    renderAvis(listeAvis);
                } else {
                    avisTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--color-text-muted);">Aucun avis client enregistré pour le moment.</td></tr>';
                }
            })
            .catch(() => {
                avisTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-primary); padding: 20px;">Erreur de chargement des avis.</td></tr>';
            });
    }

    function renderAvis(listeAvis) {
        avisTableBody.innerHTML = '';

        listeAvis.forEach(avis => {
            const tr = document.createElement('tr');
            const rawDate = avis.date_creation || avis.created_at;
            let dateAffiche = '-';
            if (rawDate) {
                const d = new Date(rawDate.replace(' ', 'T'));
                dateAffiche = !isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR') : rawDate;
            }

            const auteur = `${avis.prenom || avis.client_prenom || 'Client'} ${avis.nom || avis.client_nom || ''}`.trim();
            const note = Math.min(5, Math.max(1, parseInt(avis.note) || 5));
            const etoiles = '★'.repeat(note) + '☆'.repeat(5 - note);
            const estValide = avis.est_valide == 1 || avis.est_valide === true || String(avis.statut || '').toLowerCase().includes('valid');

            tr.innerHTML = `
                <td>${dateAffiche}</td>
                <td><strong>${escapeHtml(auteur)}</strong></td>
                <td style="color: #B8860B; font-size: 14px; letter-spacing: 1px;">${etoiles}</td>
                <td style="max-width: 380px;">« ${escapeHtml(avis.commentaire)} »</td>
                <td>
                    <span class="avis-badge ${estValide ? 'publie' : 'en-attente'}">
                        ${estValide ? 'Publié' : 'En attente'}
                    </span>
                </td>
                <td>
                    ${!estValide ? `<button type="button" class="btn-avis-approve" data-id="${avis.id}">✓ Valider</button>` : ''}
                    <button type="button" class="btn-avis-reject" data-id="${avis.id}">✕ Refuser</button>
                </td>
            `;

            avisTableBody.appendChild(tr);
        });

        document.querySelectorAll('.btn-avis-approve').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const avisId = e.target.getAttribute('data-id');
                try {
                    const res = await fetch(`/api/admin/avis/${avisId}/valider`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify({ est_valide: 1, statut: 'valide' })
                    });
                    const data = await res.json();
                    if (res.ok && data.statut === 'succes') {
                        chargerAvis();
                    } else {
                        alert('Erreur : ' + (data.message || 'Impossible de valider cet avis.'));
                    }
                } catch (err) {
                    alert('Erreur réseau lors de la validation.');
                }
            });
        });

        document.querySelectorAll('.btn-avis-reject').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const avisId = e.target.getAttribute('data-id');
                if (!confirm('Refuser et supprimer définitivement cet avis ?')) return;

                try {
                    const res = await fetch(`/api/admin/avis/${avisId}`, {
                        method: 'DELETE',
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    const data = await res.json();
                    if (res.ok && data.statut === 'succes') {
                        chargerAvis();
                    } else {
                        alert('Erreur : ' + (data.message || 'Impossible de supprimer cet avis.'));
                    }
                } catch (err) {
                    alert('Erreur réseau lors de la suppression.');
                }
            });
        });
    }

    // =========================================================================
    // 6. MESSAGES & DEMANDES DE DEVIS
    // =========================================================================
    chargerContacts();

    function chargerContacts() {
        if (!contactsTableBody) return;

        fetch('/api/admin/contacts', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
            .then(res => res.json())
            .then(res => {
                const listeContacts = res.contacts || res.donnees || [];
                if (res.statut === 'succes' && listeContacts.length > 0) {
                    renderContacts(listeContacts);
                } else {
                    contactsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--color-text-muted);">Aucun message ou demande de devis reçu pour le moment.</td></tr>';
                }
            })
            .catch(() => {
                contactsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-primary); padding: 20px;">Erreur de chargement des messages.</td></tr>';
            });
    }

    function renderContacts(listeContacts) {
        contactsTableBody.innerHTML = '';

        listeContacts.forEach(msg => {
            const tr = document.createElement('tr');
            const rawDate = msg.date_envoi || msg.created_at;
            let dateAffiche = '-';
            if (rawDate) {
                const d = new Date(rawDate.replace(' ', 'T'));
                dateAffiche = !isNaN(d.getTime())
                    ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : rawDate;
            }

            const estTraite = String(msg.statut || '').toLowerCase() === 'traite';

            tr.innerHTML = `
                <td style="white-space: nowrap;">${dateAffiche}</td>
                <td>
                    <div><strong>${escapeHtml(msg.nom_complet)}</strong></div>
                    <div style="font-size: 12px;"><a href="mailto:${escapeHtml(msg.email)}" style="color: var(--color-primary);">${escapeHtml(msg.email)}</a></div>
                    ${msg.telephone ? `<small style="color: var(--color-text-muted);">${escapeHtml(msg.telephone)}</small>` : ''}
                </td>
                <td><span style="font-size: 12px; font-weight: 600;">${escapeHtml(msg.type_evenement || 'Demande')}</span></td>
                <td style="max-width: 360px; white-space: pre-line;">${escapeHtml(msg.message)}</td>
                <td>
                    <span class="avis-badge ${estTraite ? 'publie' : 'en-attente'}">
                        ${estTraite ? 'Traité' : 'Nouveau'}
                    </span>
                </td>
                <td style="white-space: nowrap;">
                    ${!estTraite ? `<button type="button" class="btn-avis-approve btn-contact-treat" data-id="${msg.id}">✓ Traité</button>` : ''}
                    <button type="button" class="btn-avis-reject btn-contact-delete" data-id="${msg.id}">✕ Supprimer</button>
                </td>
            `;

            contactsTableBody.appendChild(tr);
        });

        document.querySelectorAll('.btn-contact-treat').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const contactId = e.target.getAttribute('data-id');
                try {
                    const res = await fetch(`/api/admin/contacts/${contactId}/traiter`, {
                        method: 'PUT',
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    const data = await res.json();
                    if (res.ok && data.statut === 'succes') {
                        chargerContacts();
                    } else {
                        alert('Erreur : ' + (data.message || 'Impossible de mettre à jour ce message.'));
                    }
                } catch (err) {
                    alert('Erreur réseau lors de la mise à jour.');
                }
            });
        });

        document.querySelectorAll('.btn-contact-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const contactId = e.target.getAttribute('data-id');
                if (!confirm('Supprimer définitivement ce message ?')) return;

                try {
                    const res = await fetch(`/api/admin/contacts/${contactId}`, {
                        method: 'DELETE',
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    const data = await res.json();
                    if (res.ok && data.statut === 'succes') {
                        chargerContacts();
                    } else {
                        alert('Erreur : ' + (data.message || 'Impossible de supprimer ce message.'));
                    }
                } catch (err) {
                    alert('Erreur réseau lors de la suppression.');
                }
            });
        });
    }
});