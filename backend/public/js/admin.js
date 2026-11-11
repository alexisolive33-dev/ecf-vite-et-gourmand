document.addEventListener('DOMContentLoaded', () => {
    // 1. Contrôle d'accès côté client (tolérance sessionStorage et localStorage)
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

    // Vérification stricte du rôle (Admin José ou Employé)
    const role = (user.role || '').toLowerCase().trim();
    if (role !== 'admin' && role !== 'employe') {
        alert("Accès réservé à l'équipe Vite & Gourmand (Julie & José).");
        window.location.href = '/compte.html';
        return;
    }

    // Synchronisation automatique des sessions
    if (!sessionStorage.getItem('vg_user')) {
        sessionStorage.setItem('vg_user', JSON.stringify(user));
    }

    // Affichage utilisateur
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        const roleAffiche = user.role ? user.role.toUpperCase() : 'ADMIN';
        userDisplay.textContent = `👤 ${user.prenom || 'José'} ${user.nom || 'Gourmand'} (${roleAffiche})`;
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
                            <h4>${stat.titre || 'Menu'}</h4>
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

            // 1. Date formatée à la française : JJ/MM/AAAA à HHhMM
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

            // 2. Harmonisation de la ville (Casse propre) et arrondi des kilomètres
            const rawVille = cmd.ville_livraison || cmd.ville || 'Bordeaux';
            const ville = rawVille
                .toLowerCase()
                .split(' ')
                .map(mot => mot.charAt(0).toUpperCase() + mot.slice(1))
                .join(' ');
            
            const distanceKm = Math.round(parseFloat(cmd.distance_km || cmd.distance || 0));

            // 3. Montant total formaté avec virgule
            const totalTtc = parseFloat(cmd.total_ttc || 0).toFixed(2).replace('.', ',');

            let articleStr = '-';
            if (cmd.articles && Array.isArray(cmd.articles) && cmd.articles.length > 0) {
                articleStr = cmd.articles.map(a => `${a.menu_titre || a.titre} (${a.nb_convives || '-'} p.)`).join(', ');
            } else if (cmd.menu_titre || cmd.titre) {
                articleStr = `${cmd.menu_titre || cmd.titre} (${cmd.nb_convives || '-'} p.)`;
            }

            const rawStatut = (cmd.statut || 'en_attente').toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            tr.innerHTML = `
                <td><strong>${numeroCommande}</strong></td>
                <td>
                    <div>${prenom} ${nom}</div>
                    <small style="color: var(--color-text-muted);">${email}</small>
                </td>
                <td>${dateLivraison}</td>
                <td>${ville} <small>(${distanceKm} km)</small></td>
                <td>${articleStr}</td>
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

        // 4. Écouteur sur le changement de statut
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
});