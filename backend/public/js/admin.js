document.addEventListener('DOMContentLoaded', () => {
    // 1. Contrôle d'accès côté client
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

    // Vérification stricte du rôle (Admin ou Employé)
    const role = (user.role || '').toLowerCase().trim();
    if (role !== 'admin' && role !== 'employe') {
        alert("Accès réservé à l'équipe Vite & Gourmand.");
        window.location.href = '/compte.html';
        return;
    }

    if (!sessionStorage.getItem('vg_user')) {
        sessionStorage.setItem('vg_user', JSON.stringify(user));
    }

    // Affichage utilisateur & adaptation visuelle selon le rôle
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        const roleAffiche = user.role ? user.role.toUpperCase() : 'ADMIN';
        userDisplay.textContent = `👤 ${user.prenom || 'José'} ${user.nom || 'Gourmand'} (${roleAffiche})`;
    }

    if (role === 'employe') {
        const pageTitle = document.querySelector('h1');
        if (pageTitle) pageTitle.textContent = 'Espace Collaborateur — Commandes, Avis & Messages';
        const tagline = document.querySelector('.brand-tagline');
        if (tagline) tagline.textContent = 'Espace Équipe • Vite & Gourmand';
    }

    // Déconnexion propre
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
    const tableBody = document.getElementById('orders-table-body');
    const avisTableBody = document.getElementById('avis-table-body');
    const contactsTableBody = document.getElementById('contacts-table-body');

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // 2. Charger les statistiques MongoDB
    if (statsContainer) {
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
            .catch(err => {
                console.error('Erreur stats MongoDB:', err);
                statsContainer.innerHTML = '<p style="color: var(--color-text-muted);">Indicateurs NoSQL temporairement indisponibles.</p>';
            });
    }

    // 3. Charger la liste des commandes SQL
    chargerCommandes();

    function chargerCommandes() {
        if (!tableBody) return;

        fetch('/api/admin/commandes', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
            .then(res => res.json())
            .then(res => {
                if (res.statut === 'succes' && res.commandes && res.commandes.length > 0) {
                    renderCommandes(res.commandes);
                } else {
                    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--color-text-muted);">Aucune commande trouvée.</td></tr>';
                }
            })
            .catch(err => {
                console.error('Erreur commandes:', err);
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--color-primary); padding: 20px;">Erreur de chargement des commandes.</td></tr>';
            });
    }

    function renderCommandes(commandes) {
        tableBody.innerHTML = '';

        commandes.forEach(cmd => {
            const tr = document.createElement('tr');

            const prenom = cmd.client_prenom || cmd.prenom || 'Client';
            const nom = cmd.client_nom || cmd.nom || '';
            const email = cmd.client_email || cmd.email || '-';

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

            const rawStatut = (cmd.statut || 'en_attente').toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            tr.innerHTML = `
                <td><strong>${escapeHtml(numeroCommande)}</strong></td>
                <td>
                    <div>${escapeHtml(prenom)} ${escapeHtml(nom)}</div>
                    <small style="color: var(--color-text-muted);">${escapeHtml(email)}</small>
                </td>
                <td>${dateLivraison}</td>
                <td>${escapeHtml(ville)} <small>(${distanceKm} km)</small></td>
                <td>${escapeHtml(articleStr)}</td>
                <td><strong>${totalTtc} €</strong></td>
                <td>
                    <select class="status-select" data-id="${idCommande}" style="padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">
                        <option value="en_attente" ${rawStatut.includes('attente') ? 'selected' : ''}>En attente</option>
                        <option value="validee" ${rawStatut.includes('valid') || rawStatut.includes('accept') ? 'selected' : ''}>Validée</option>
                        <option value="en_preparation" ${rawStatut.includes('prep') ? 'selected' : ''}>En préparation</option>
                        <option value="livree" ${rawStatut.includes('livr') ? 'selected' : ''}>Livrée</option>
                        <option value="annulee" ${rawStatut.includes('annul') ? 'selected' : ''}>Annulée</option>
                    </select>
                </td>
            `;

            tableBody.appendChild(tr);
        });

        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const cmdId = e.target.getAttribute('data-id');
                const nouveauStatut = e.target.value;

                try {
                    const res = await fetch(`/api/admin/commandes/${cmdId}/statut`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify({ statut: nouveauStatut })
                    });

                    const data = await res.json();

                    if (res.ok && data.statut === 'succes') {
                        e.target.style.backgroundColor = '#DCFCE7';
                        setTimeout(() => { e.target.style.backgroundColor = ''; }, 1000);
                    } else {
                        alert('Erreur : ' + (data.message || 'Impossible de mettre à jour le statut.'));
                        chargerCommandes();
                    }
                } catch (err) {
                    console.error('Erreur changement statut:', err);
                    alert('Erreur de connexion au serveur.');
                    chargerCommandes();
                }
            });
        });
    }

    // 4. Charger et modérer les avis clients
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
            .catch(err => {
                console.error('Erreur chargement avis:', err);
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
                    <button type="button" class="btn-avis-reject" data-id="${avis.id}">✕ Supprimer</button>
                </td>
            `;

            avisTableBody.appendChild(tr);
        });

        // Action : Valider un avis
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
                    console.error('Erreur validation avis:', err);
                    alert('Erreur réseau lors de la validation.');
                }
            });
        });

        // Action : Supprimer / refuser un avis
        document.querySelectorAll('.btn-avis-reject').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const avisId = e.target.getAttribute('data-id');
                if (!confirm('Supprimer définitivement cet avis ?')) return;

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
                    console.error('Erreur suppression avis:', err);
                    alert('Erreur réseau lors de la suppression.');
                }
            });
        });
    }

    // 5. Charger et traiter les messages de contact
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
            .catch(err => {
                console.error('Erreur chargement messages contact:', err);
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

        // Action : Marquer une demande de contact comme traitée
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
                    console.error('Erreur traitement message:', err);
                    alert('Erreur réseau lors de la mise à jour.');
                }
            });
        });

        // Action : Supprimer un message de contact
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
                    console.error('Erreur suppression message:', err);
                    alert('Erreur réseau lors de la suppression.');
                }
            });
        });
    }
});