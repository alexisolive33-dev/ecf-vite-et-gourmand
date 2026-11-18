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
    let commandesChartInstance = null;

    function formatEuro(val) {
        return parseFloat(val || 0).toFixed(2).replace('.', ',');
    }

    function afficherLigneMessageTable(tbody, colspan, texte, isError = false) {
        if (!tbody) return;
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = colspan;
        td.style.textAlign = 'center';
        td.style.padding = isError ? '20px' : '24px';
        td.style.color = isError ? 'var(--color-primary)' : 'var(--color-text-muted)';
        td.textContent = texte;
        tr.appendChild(td);
        tbody.replaceChildren(tr);
    }

    function afficherMessageParagraphe(container, texte, isError = false) {
        if (!container) return;
        const p = document.createElement('p');
        p.style.fontSize = '13px';
        p.style.color = isError ? 'var(--color-primary)' : 'var(--color-text-muted)';
        p.textContent = texte;
        container.replaceChildren(p);
    }

    function setKpiValue(element, valeur, unite) {
        if (!element) return;
        const span = document.createElement('span');
        span.textContent = unite;
        element.replaceChildren(document.createTextNode(`${valeur} `), span);
    }

    // =========================================================================
    // 0. SECTIONS RÉSERVÉES À L'ADMINISTRATEUR (JOSÉ)
    // =========================================================================
    if (role === 'admin') {
        const adminOnlyBlock = document.getElementById('admin-only-sections');
        if (adminOnlyBlock) adminOnlyBlock.style.display = 'block';

        chargerGraphiqueCommandesMenus();
        initialiserCalculateurCA();
        chargerChiffreAffaires();
        initialiserGestionEmployes();
        chargerEmployes();
    }

    async function chargerGraphiqueCommandesMenus() {
        const canvas = document.getElementById('chart-commandes-menus');
        const sourceBadge = document.getElementById('nosql-orders-source');
        if (!canvas) return;

        try {
            const res = await fetch('/api/admin/stats/commandes-menus', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (!res.ok || data.statut !== 'succes') return;

            if (sourceBadge && data.source) {
                sourceBadge.textContent = data.source;
            }

            const items = data.donnees || [];
            const labels = items.map(i => i.titre);
            const values = items.map(i => Number(i.nb_commandes || 0));

            if (commandesChartInstance) {
                commandesChartInstance.destroy();
            }

            if (typeof Chart !== 'undefined') {
                commandesChartInstance = new Chart(canvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Nombre de commandes (NoSQL MongoDB)',
                            data: values,
                            backgroundColor: ['#721B29', '#B8860B', '#9E2A3B', '#D4A843', '#4B5563'],
                            borderRadius: 6,
                            maxBarThickness: 56
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: true, position: 'top' }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { precision: 0 }
                            }
                        }
                    }
                });
            }
        } catch (err) {
            console.error('Erreur chargement graphique NoSQL:', err);
        }
    }

    function initialiserCalculateurCA() {
        const btnCalc = document.getElementById('btn-calc-ca');
        const btnReset = document.getElementById('btn-reset-ca');
        const selectMenu = document.getElementById('ca-filter-menu');

        if (btnCalc) btnCalc.addEventListener('click', chargerChiffreAffaires);
        if (selectMenu) selectMenu.addEventListener('change', chargerChiffreAffaires);
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (selectMenu) selectMenu.value = '';
                const d1 = document.getElementById('ca-date-debut');
                const d2 = document.getElementById('ca-date-fin');
                if (d1) d1.value = '';
                if (d2) d2.value = '';
                chargerChiffreAffaires();
            });
        }
    }

    async function chargerChiffreAffaires() {
        const tbody = document.getElementById('ca-table-body');
        if (!tbody) return;

        const menuId = document.getElementById('ca-filter-menu')?.value || '';
        const dateDebut = document.getElementById('ca-date-debut')?.value || '';
        const dateFin = document.getElementById('ca-date-fin')?.value || '';

        const params = new URLSearchParams();
        if (menuId) params.set('menu_id', menuId);
        if (dateDebut) params.set('date_debut', dateDebut);
        if (dateFin) params.set('date_fin', dateFin);

        try {
            const res = await fetch(`/api/admin/stats/chiffre-affaires?${params.toString()}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (!res.ok || data.statut !== 'succes') return;

            const totaux = data.totaux || {};
            setKpiValue(document.getElementById('kpi-ca-total'), formatEuro(totaux.ca_total_ttc), '€');
            setKpiValue(document.getElementById('kpi-ca-commandes'), totaux.total_commandes || 0, 'commandes');
            setKpiValue(document.getElementById('kpi-ca-convives'), totaux.total_convives || 0, 'convives');

            const lignes = data.par_menu || [];
            if (lignes.length === 0) {
                afficherLigneMessageTable(tbody, 6, 'Aucune donnée sur cette sélection.');
                return;
            }

            const fragment = document.createDocumentFragment();
            lignes.forEach(l => {
                const tr = document.createElement('tr');

                const tdTitre = document.createElement('td');
                const strongTitre = document.createElement('strong');
                strongTitre.textContent = l.menu_titre || '';
                tdTitre.appendChild(strongTitre);

                const tdCmd = document.createElement('td');
                tdCmd.textContent = String(l.nb_commandes ?? 0);

                const tdConv = document.createElement('td');
                tdConv.textContent = `${l.total_convives ?? 0} pers.`;

                const tdRepas = document.createElement('td');
                tdRepas.textContent = `${formatEuro(l.ca_repas_ttc)} €`;

                const tdLivraison = document.createElement('td');
                tdLivraison.textContent = `${formatEuro(l.ca_livraison_ttc)} €`;

                const tdTotal = document.createElement('td');
                const strongTotal = document.createElement('strong');
                strongTotal.style.color = 'var(--color-primary)';
                strongTotal.textContent = `${formatEuro(l.ca_total_ttc)} €`;
                tdTotal.appendChild(strongTotal);

                tr.append(tdTitre, tdCmd, tdConv, tdRepas, tdLivraison, tdTotal);
                fragment.appendChild(tr);
            });

            tbody.replaceChildren(fragment);
        } catch (err) {
            console.error('Erreur calcul CA:', err);
        }
    }

    function initialiserGestionEmployes() {
        const form = document.getElementById('create-employe-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                email: document.getElementById('emp-email').value.trim(),
                mot_de_passe: document.getElementById('emp-password').value,
                prenom: document.getElementById('emp-prenom').value.trim(),
                nom: document.getElementById('emp-nom').value.trim()
            };

            try {
                const res = await fetch('/api/admin/employes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.statut === 'succes') {
                    alert(data.message);
                    form.reset();
                    chargerEmployes();
                } else {
                    alert('Erreur : ' + (data.message || 'Impossible de créer le compte employé.'));
                }
            } catch (err) {
                alert('Erreur réseau lors de la création du compte employé.');
            }
        });
    }

    async function chargerEmployes() {
        const tbody = document.getElementById('employes-table-body');
        if (!tbody) return;

        try {
            const res = await fetch('/api/admin/employes', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await res.json();
            const employes = data.employes || [];

            if (!res.ok || employes.length === 0) {
                afficherLigneMessageTable(tbody, 5, 'Aucun compte employé enregistré.');
                return;
            }

            const fragment = document.createDocumentFragment();
            employes.forEach(emp => {
                const actif = Number(emp.est_actif) === 1;
                const tr = document.createElement('tr');

                const tdNom = document.createElement('td');
                const strongNom = document.createElement('strong');
                strongNom.textContent = `${emp.prenom || ''} ${emp.nom || ''}`.trim();
                tdNom.appendChild(strongNom);

                const tdEmail = document.createElement('td');
                tdEmail.textContent = emp.email || '';

                const tdRole = document.createElement('td');
                const spanRole = document.createElement('span');
                spanRole.className = 'user-badge';
                spanRole.style.fontSize = '11px';
                spanRole.style.padding = '3px 10px';
                spanRole.textContent = 'EMPLOYÉ';
                tdRole.appendChild(spanRole);

                const tdStatut = document.createElement('td');
                const spanStatut = document.createElement('span');
                spanStatut.className = `avis-badge ${actif ? 'publie' : 'desactive'}`;
                spanStatut.textContent = actif ? 'Actif' : 'Désactivé (départ)';
                tdStatut.appendChild(spanStatut);

                const tdActions = document.createElement('td');
                const btnToggle = document.createElement('button');
                btnToggle.type = 'button';
                btnToggle.className = actif
                    ? 'btn-avis-reject btn-toggle-emp'
                    : 'btn-avis-approve btn-toggle-emp';
                btnToggle.textContent = actif ? 'Désactiver le compte' : 'Réactiver le compte';

                btnToggle.addEventListener('click', async () => {
                    const cibleActif = !actif;
                    const msg = cibleActif
                        ? 'Réactiver ce compte employé ?'
                        : 'Rendre ce compte employé inutilisable (départ de l’entreprise) ?';
                    if (!confirm(msg)) return;

                    try {
                        const r = await fetch(`/api/admin/employes/${emp.id}/statut`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                            },
                            body: JSON.stringify({ est_actif: cibleActif })
                        });
                        const d = await r.json();
                        if (r.ok && d.statut === 'succes') {
                            chargerEmployes();
                        } else {
                            alert('Erreur : ' + (d.message || 'Action impossible.'));
                        }
                    } catch (err) {
                        alert('Erreur réseau.');
                    }
                });

                tdActions.appendChild(btnToggle);
                tr.append(tdNom, tdEmail, tdRole, tdStatut, tdActions);
                fragment.appendChild(tr);
            });

            tbody.replaceChildren(fragment);
        } catch (err) {
            afficherLigneMessageTable(tbody, 5, 'Erreur de chargement des employés.', true);
        }
    }

    // =========================================================================
    // 1. STATISTIQUES MONGODB (VUES)
    // =========================================================================
    chargerStatsMongo();

    function chargerStatsMongo() {
        if (!statsContainer) return;
        fetch('/api/stats/popularite')
            .then(res => res.json())
            .then(res => {
                if (res.statut === 'succes' && res.donnees && res.donnees.length > 0) {
                    const fragment = document.createDocumentFragment();
                    res.donnees.forEach(stat => {
                        const card = document.createElement('div');
                        card.className = 'stat-card-box';

                        const h4 = document.createElement('h4');
                        h4.textContent = stat.titre || 'Menu';

                        const numDiv = document.createElement('div');
                        numDiv.className = 'stat-card-number';
                        const spanVues = document.createElement('span');
                        spanVues.textContent = 'vues';
                        numDiv.append(document.createTextNode(`${stat.nb_vues || 0} `), spanVues);

                        card.append(h4, numDiv);
                        fragment.appendChild(card);
                    });
                    statsContainer.replaceChildren(fragment);
                } else {
                    afficherMessageParagraphe(statsContainer, 'Aucune donnée de consultation enregistrée.');
                }
            })
            .catch(() => {
                afficherMessageParagraphe(statsContainer, 'Indicateurs NoSQL temporairement indisponibles.');
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

        const fragment = document.createDocumentFragment();
        referentielAllergenes.forEach(a => {
            const label = document.createElement('label');
            label.className = 'plat-check-item';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'plat_allergenes';
            input.value = String(a.id);

            const span = document.createElement('span');
            span.textContent = a.nom || '';

            label.append(input, span);
            fragment.appendChild(label);
        });

        container.replaceChildren(fragment);
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

        const fragment = document.createDocumentFragment();
        categories.forEach(cat => {
            const box = document.createElement('div');
            box.className = 'plats-category-box';

            const h5 = document.createElement('h5');
            h5.textContent = cat.label;
            box.appendChild(h5);

            const items = referentielPlats.filter(p => p.categorie === cat.key);
            if (items.length === 0) {
                const pEmpty = document.createElement('p');
                pEmpty.style.fontSize = '12px';
                pEmpty.style.color = 'var(--color-text-muted)';
                pEmpty.textContent = 'Aucun plat dans cette catégorie.';
                box.appendChild(pEmpty);
            } else {
                items.forEach(p => {
                    const label = document.createElement('label');
                    label.className = 'plat-check-item';

                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    input.name = 'menu_plats';
                    input.value = String(p.id);
                    input.checked = selectedSet.has(Number(p.id));

                    const span = document.createElement('span');
                    span.textContent = p.nom || '';

                    if (p.allergenes && p.allergenes.length > 0) {
                        const small = document.createElement('small');
                        small.style.color = '#92400E';
                        small.textContent = ` (${p.allergenes.map(a => a.nom).join(', ')})`;
                        span.appendChild(small);
                    }

                    label.append(input, span);
                    box.appendChild(label);
                });
            }

            fragment.appendChild(box);
        });

        container.replaceChildren(fragment);
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
                    if (role === 'admin') chargerChiffreAffaires();
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

                const caSelect = document.getElementById('ca-filter-menu');
                if (caSelect) {
                    const currentVal = caSelect.value;
                    const optDefault = document.createElement('option');
                    optDefault.value = '';
                    optDefault.textContent = 'Tous les menus';

                    const options = [optDefault];
                    menusCache.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = String(m.id);
                        opt.textContent = m.titre || '';
                        options.push(opt);
                    });

                    caSelect.replaceChildren(...options);
                    caSelect.value = currentVal;
                }

                if (res.statut === 'succes' && menusCache.length > 0) {
                    renderMenus(menusCache);
                } else {
                    afficherLigneMessageTable(menusTableBody, 6, 'Aucun menu actif dans le catalogue.');
                }
            })
            .catch(() => {
                afficherLigneMessageTable(menusTableBody, 6, 'Erreur de chargement des menus.', true);
            });
    }

    function renderMenus(menus) {
        const labelsTheme = { noel: 'Noël', paques: 'Pâques', classique: 'Classique', evenement: 'Événement' };
        const labelsRegime = { classique: 'Classique', vegetarien: 'Végétarien', vegan: 'Vegan' };
        const fragment = document.createDocumentFragment();

        menus.forEach(menu => {
            const tr = document.createElement('tr');
            const prixUnit = parseFloat(menu.prix_unitaire_ttc || 0);
            const convivesMin = parseInt(menu.convives_min || 4, 10);
            const totalMin = (prixUnit * convivesMin).toFixed(2).replace('.', ',');
            const prixUnitStr = prixUnit.toFixed(2).replace('.', ',');
            const stock = parseInt(menu.stock_disponible || 0, 10);
            const stockBadgeClass = stock > 3 ? 'publie' : 'en-attente';

            // Colonne 1 : Image
            const tdImg = document.createElement('td');
            const img = document.createElement('img');
            img.src = menu.image_url || '';
            img.alt = menu.titre || '';
            img.className = 'menu-thumb';
            img.addEventListener('error', () => {
                img.style.display = 'none';
            });
            tdImg.appendChild(img);

            // Colonne 2 : Titre & Plats
            const tdTitre = document.createElement('td');
            tdTitre.style.maxWidth = '340px';

            const divTitre = document.createElement('div');
            const strongTitre = document.createElement('strong');
            strongTitre.textContent = menu.titre || '';
            divTitre.appendChild(strongTitre);

            const divPlats = document.createElement('div');
            divPlats.style.fontSize = '12px';
            divPlats.style.color = 'var(--color-text-muted)';
            divPlats.style.marginTop = '2px';
            if (menu.plats && menu.plats.length > 0) {
                divPlats.textContent = menu.plats.map(p => p.nom).join(' • ');
            } else {
                const emEmpty = document.createElement('em');
                emEmpty.style.color = 'var(--color-text-muted)';
                emEmpty.textContent = 'Aucun plat associé';
                divPlats.appendChild(emEmpty);
            }
            tdTitre.append(divTitre, divPlats);

            // Colonne 3 : Thème & Régime
            const tdBadge = document.createElement('td');
            const spanBadge = document.createElement('span');
            spanBadge.className = 'user-badge';
            spanBadge.style.fontSize = '11px';
            spanBadge.style.padding = '3px 10px';
            spanBadge.textContent = `${labelsTheme[menu.theme] || menu.theme} • ${labelsRegime[menu.regime] || menu.regime}`;
            tdBadge.appendChild(spanBadge);

            // Colonne 4 : Tarification
            const tdPrix = document.createElement('td');
            const divPrix = document.createElement('div');
            const strongPrix = document.createElement('strong');
            strongPrix.textContent = `${prixUnitStr} €`;
            divPrix.append(strongPrix, document.createTextNode(' / pers.'));

            const smallMin = document.createElement('small');
            smallMin.style.color = 'var(--color-text-muted)';
            smallMin.textContent = `Min. ${convivesMin} pers. (${totalMin} €)`;
            tdPrix.append(divPrix, smallMin);

            // Colonne 5 : Stock & Délai
            const tdStock = document.createElement('td');
            const divStock = document.createElement('div');
            const spanStock = document.createElement('span');
            spanStock.className = `avis-badge ${stockBadgeClass}`;
            spanStock.textContent = `${stock} dispo.`;
            divStock.appendChild(spanStock);

            const smallDelai = document.createElement('small');
            smallDelai.style.color = 'var(--color-text-muted)';
            smallDelai.textContent = `Délai ${menu.delai_min_jours}j • ${menu.conditions_stockage || ''}`;
            tdStock.append(divStock, smallDelai);

            // Colonne 6 : Actions
            const tdActions = document.createElement('td');
            tdActions.style.whiteSpace = 'nowrap';

            const btnEdit = document.createElement('button');
            btnEdit.type = 'button';
            btnEdit.className = 'btn-avis-approve btn-menu-edit';
            btnEdit.textContent = '✎ Modifier';
            btnEdit.addEventListener('click', () => ouvrirEditionMenu(menu));

            const btnDelete = document.createElement('button');
            btnDelete.type = 'button';
            btnDelete.className = 'btn-avis-reject btn-menu-delete';
            btnDelete.style.marginLeft = '6px';
            btnDelete.textContent = '✕ Supprimer';
            btnDelete.addEventListener('click', async () => {
                if (!confirm('Retirer ce menu du catalogue ?')) return;
                try {
                    const res = await fetch(`/api/admin/menus/${menu.id}`, {
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

            tdActions.append(btnEdit, btnDelete);
            tr.append(tdImg, tdTitre, tdBadge, tdPrix, tdStock, tdActions);
            fragment.appendChild(tr);
        });

        menusTableBody.replaceChildren(fragment);
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
                    afficherLigneMessageTable(tableBody, 7, 'Aucune commande trouvée.');
                }
            })
            .catch(() => {
                afficherLigneMessageTable(tableBody, 7, 'Erreur de chargement des commandes.', true);
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
            afficherLigneMessageTable(tableBody, 7, 'Aucune commande ne correspond à ces critères.');
            return;
        }
        renderCommandes(filtrees);
    }

    function renderCommandes(commandes) {
        const statutsDisponibles = [
            { value: 'en_attente', label: 'En attente' },
            { value: 'validee', label: 'Acceptée' },
            { value: 'en_preparation', label: 'En préparation' },
            { value: 'en_cours_livraison', label: 'En cours de livraison' },
            { value: 'livree', label: 'Livrée' },
            { value: 'attente_retour_materiel', label: 'En attente du retour de matériel' },
            { value: 'terminee', label: 'Terminée' },
            { value: 'annulee', label: 'Annulée' }
        ];

        const fragment = document.createDocumentFragment();

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

            // Colonne 1 : Numéro
            const tdNum = document.createElement('td');
            const strongNum = document.createElement('strong');
            strongNum.textContent = numeroCommande;
            tdNum.appendChild(strongNum);

            // Colonne 2 : Client
            const tdClient = document.createElement('td');
            const divClient = document.createElement('div');
            divClient.textContent = `${prenom} ${nom}`.trim();
            const smallEmail = document.createElement('small');
            smallEmail.style.color = 'var(--color-text-muted)';
            smallEmail.textContent = email;
            tdClient.append(divClient, smallEmail);

            if (tel) {
                const smallTel = document.createElement('small');
                smallTel.style.color = 'var(--color-text-muted)';
                smallTel.textContent = `📞 ${tel}`;
                tdClient.append(document.createElement('br'), smallTel);
            }

            // Colonne 3 : Date
            const tdDate = document.createElement('td');
            tdDate.textContent = dateLivraison;

            // Colonne 4 : Ville & Distance
            const tdLieu = document.createElement('td');
            const smallKm = document.createElement('small');
            smallKm.textContent = `(${distanceKm} km)`;
            tdLieu.append(document.createTextNode(`${ville} `), smallKm);

            // Colonne 5 : Articles & Motif annulation
            const tdArticles = document.createElement('td');
            tdArticles.appendChild(document.createTextNode(articleStr));
            if (st === 'annulee' && cmd.motif_annulation) {
                const divMotif = document.createElement('div');
                divMotif.style.fontSize = '11px';
                divMotif.style.color = '#991B1B';
                divMotif.style.marginTop = '4px';
                divMotif.textContent = `Contact : ${cmd.mode_contact_annulation || '-'} • ${cmd.motif_annulation}`;
                tdArticles.appendChild(divMotif);
            }

            // Colonne 6 : Total
            const tdTotal = document.createElement('td');
            const strongTotal = document.createElement('strong');
            strongTotal.textContent = `${totalTtc} €`;
            tdTotal.appendChild(strongTotal);

            // Colonne 7 : Sélecteur statut
            const tdStatut = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'status-select';
            select.dataset.prev = st;
            select.style.padding = '5px 8px';
            select.style.borderRadius = '4px';
            select.style.fontWeight = '600';
            select.style.fontSize = '12px';

            statutsDisponibles.forEach(optInfo => {
                const opt = document.createElement('option');
                opt.value = optInfo.value;
                opt.textContent = optInfo.label;
                if (st === optInfo.value) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener('change', async (e) => {
                const nouveauStatut = e.target.value;
                const ancienStatut = e.target.dataset.prev || 'en_attente';

                if (nouveauStatut === 'annulee') {
                    selectEnCoursAnnulation = e.target;
                    statutPrecedentAnnulation = ancienStatut;
                    document.getElementById('cancel-cmd-id').value = idCommande;
                    document.getElementById('cancel-mode-contact').value = '';
                    document.getElementById('cancel-motif').value = '';
                    document.getElementById('modal-staff-cancel').style.display = 'flex';
                    return;
                }

                await envoyerMiseAJourStatut(idCommande, nouveauStatut, e.target);
            });

            tdStatut.appendChild(select);
            tr.append(tdNum, tdClient, tdDate, tdLieu, tdArticles, tdTotal, tdStatut);
            fragment.appendChild(tr);
        });

        tableBody.replaceChildren(fragment);
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
                if (role === 'admin') chargerChiffreAffaires();
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
                    const fragment = document.createDocumentFragment();
                    liste.forEach(h => {
                        const group = document.createElement('div');
                        group.className = 'menu-form-group';

                        const label = document.createElement('label');
                        label.htmlFor = `horaire-${h.id}`;
                        label.textContent = h.jour_semaine || '';

                        const input = document.createElement('input');
                        input.type = 'text';
                        input.id = `horaire-${h.id}`;
                        input.setAttribute('data-horaire-id', String(h.id));
                        input.value = h.heures_ouverture || '';
                        input.required = true;

                        group.append(label, input);
                        fragment.appendChild(group);
                    });
                    container.replaceChildren(fragment);
                } else {
                    afficherMessageParagraphe(container, 'Aucun horaire configuré.');
                }
            })
            .catch(() => {
                afficherMessageParagraphe(container, 'Erreur lors du chargement des horaires.', true);
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
                    afficherLigneMessageTable(avisTableBody, 6, 'Aucun avis client enregistré pour le moment.');
                }
            })
            .catch(() => {
                afficherLigneMessageTable(avisTableBody, 6, 'Erreur de chargement des avis.', true);
            });
    }

    function renderAvis(listeAvis) {
        const fragment = document.createDocumentFragment();

        listeAvis.forEach(avis => {
            const tr = document.createElement('tr');
            const rawDate = avis.date_creation || avis.created_at;
            let dateAffiche = '-';
            if (rawDate) {
                const d = new Date(rawDate.replace(' ', 'T'));
                dateAffiche = !isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR') : rawDate;
            }

            const auteur = `${avis.prenom || avis.client_prenom || 'Client'} ${avis.nom || avis.client_nom || ''}`.trim();
            const note = Math.min(5, Math.max(1, parseInt(avis.note, 10) || 5));
            const etoiles = '★'.repeat(note) + '☆'.repeat(5 - note);
            const estValide = avis.est_valide == 1 || avis.est_valide === true || String(avis.statut || '').toLowerCase().includes('valid');

            const tdDate = document.createElement('td');
            tdDate.textContent = dateAffiche;

            const tdAuteur = document.createElement('td');
            const strongAuteur = document.createElement('strong');
            strongAuteur.textContent = auteur;
            tdAuteur.appendChild(strongAuteur);

            const tdNote = document.createElement('td');
            tdNote.style.color = '#B8860B';
            tdNote.style.fontSize = '14px';
            tdNote.style.letterSpacing = '1px';
            tdNote.textContent = etoiles;

            const tdCommentaire = document.createElement('td');
            tdCommentaire.style.maxWidth = '380px';
            tdCommentaire.textContent = `« ${avis.commentaire || ''} »`;

            const tdStatut = document.createElement('td');
            const spanStatut = document.createElement('span');
            spanStatut.className = `avis-badge ${estValide ? 'publie' : 'en-attente'}`;
            spanStatut.textContent = estValide ? 'Publié' : 'En attente';
            tdStatut.appendChild(spanStatut);

            const tdActions = document.createElement('td');
            if (!estValide) {
                const btnApprove = document.createElement('button');
                btnApprove.type = 'button';
                btnApprove.className = 'btn-avis-approve';
                btnApprove.style.marginRight = '6px';
                btnApprove.textContent = '✓ Valider';
                btnApprove.addEventListener('click', async () => {
                    try {
                        const res = await fetch(`/api/admin/avis/${avis.id}/valider`, {
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
                tdActions.appendChild(btnApprove);
            }

            const btnReject = document.createElement('button');
            btnReject.type = 'button';
            btnReject.className = 'btn-avis-reject';
            btnReject.textContent = '✕ Refuser';
            btnReject.addEventListener('click', async () => {
                if (!confirm('Refuser et supprimer définitivement cet avis ?')) return;
                try {
                    const res = await fetch(`/api/admin/avis/${avis.id}`, {
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

            tdActions.appendChild(btnReject);
            tr.append(tdDate, tdAuteur, tdNote, tdCommentaire, tdStatut, tdActions);
            fragment.appendChild(tr);
        });

        avisTableBody.replaceChildren(fragment);
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
                    afficherLigneMessageTable(contactsTableBody, 6, 'Aucun message ou demande de devis reçu pour le moment.');
                }
            })
            .catch(() => {
                afficherLigneMessageTable(contactsTableBody, 6, 'Erreur de chargement des messages.', true);
            });
    }

    function renderContacts(listeContacts) {
        const fragment = document.createDocumentFragment();

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

            const tdDate = document.createElement('td');
            tdDate.style.whiteSpace = 'nowrap';
            tdDate.textContent = dateAffiche;

            const tdExpediteur = document.createElement('td');
            const divNom = document.createElement('div');
            const strongNom = document.createElement('strong');
            strongNom.textContent = msg.nom_complet || '';
            divNom.appendChild(strongNom);

            const divEmail = document.createElement('div');
            divEmail.style.fontSize = '12px';
            const linkEmail = document.createElement('a');
            const cleanEmail = String(msg.email || '').replace(/[\r\n]/g, '');
            linkEmail.href = `mailto:${cleanEmail}`;
            linkEmail.style.color = 'var(--color-primary)';
            linkEmail.textContent = cleanEmail;
            divEmail.appendChild(linkEmail);

            tdExpediteur.append(divNom, divEmail);

            if (msg.telephone) {
                const smallTel = document.createElement('small');
                smallTel.style.color = 'var(--color-text-muted)';
                smallTel.textContent = msg.telephone;
                tdExpediteur.appendChild(smallTel);
            }

            const tdSujet = document.createElement('td');
            const spanSujet = document.createElement('span');
            spanSujet.style.fontSize = '12px';
            spanSujet.style.fontWeight = '600';
            spanSujet.textContent = msg.type_evenement || 'Demande';
            tdSujet.appendChild(spanSujet);

            const tdMessage = document.createElement('td');
            tdMessage.style.maxWidth = '360px';
            tdMessage.style.whiteSpace = 'pre-line';
            tdMessage.textContent = msg.message || '';

            const tdStatut = document.createElement('td');
            const spanStatut = document.createElement('span');
            spanStatut.className = `avis-badge ${estTraite ? 'publie' : 'en-attente'}`;
            spanStatut.textContent = estTraite ? 'Traité' : 'Nouveau';
            tdStatut.appendChild(spanStatut);

            const tdActions = document.createElement('td');
            tdActions.style.whiteSpace = 'nowrap';

            if (!estTraite) {
                const btnTreat = document.createElement('button');
                btnTreat.type = 'button';
                btnTreat.className = 'btn-avis-approve';
                btnTreat.style.marginRight = '6px';
                btnTreat.textContent = '✓ Traité';
                btnTreat.addEventListener('click', async () => {
                    try {
                        const res = await fetch(`/api/admin/contacts/${msg.id}/traiter`, {
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
                tdActions.appendChild(btnTreat);
            }

            const btnDelete = document.createElement('button');
            btnDelete.type = 'button';
            btnDelete.className = 'btn-avis-reject';
            btnDelete.textContent = '✕ Supprimer';
            btnDelete.addEventListener('click', async () => {
                if (!confirm('Supprimer définitivement ce message ?')) return;
                try {
                    const res = await fetch(`/api/admin/contacts/${msg.id}`, {
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

            tdActions.appendChild(btnDelete);
            tr.append(tdDate, tdExpediteur, tdSujet, tdMessage, tdStatut, tdActions);
            fragment.appendChild(tr);
        });

        contactsTableBody.replaceChildren(fragment);
    }
});