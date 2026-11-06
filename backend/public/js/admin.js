document.addEventListener('DOMContentLoaded', () => {
    // 1. Contrôle d'accès côté client
    const userRaw = sessionStorage.getItem('vg_user');
    if (!userRaw) {
        window.location.href = '/login.html';
        return;
    }

    const user = JSON.parse(userRaw);
    document.getElementById('user-display').textContent = `👤 ${user.prenom} ${user.nom} (${user.role.toUpperCase()})`;

    // Déconnexion
    document.getElementById('btn-logout').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = '/login.html';
    });

    const statsContainer = document.getElementById('stats-container');
    const tableBody = document.getElementById('orders-table-body');

 // 2. Charger les statistiques MongoDB (Classes alignées sur le UI Kit)
fetch('/api/stats/popularite')
    .then(res => res.json())
    .then(res => {
        if (res.statut === 'succes' && res.donnees.length > 0) {
            statsContainer.innerHTML = '';
            res.donnees.forEach(stat => {
                const card = document.createElement('div');
                card.className = 'stat-card-box';
                card.innerHTML = `
                    <h4>${stat.titre}</h4>
                    <div class="stat-card-number">${stat.nb_vues} <span>vues</span></div>
                `;
                statsContainer.appendChild(card);
            });
        } else {
            statsContainer.innerHTML = '<p style="color: var(--color-text-muted);">Aucune donnée de consultation enregistrée.</p>';
        }
    })
    .catch(err => console.error('Erreur stats MongoDB:', err));
    
    // 3. Charger la liste des commandes SQL
    chargerCommandes();

    function chargerCommandes() {
        fetch('/api/admin/commandes')
            .then(res => res.json())
            .then(res => {
                if (res.statut === 'succes' && res.commandes.length > 0) {
                    renderCommandes(res.commandes);
                } else {
                    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Aucune commande trouvée.</td></tr>';
                }
            })
            .catch(err => console.error('Erreur commandes:', err));
    }

    function renderCommandes(commandes) {
        tableBody.innerHTML = '';
        commandes.forEach(cmd => {
            const tr = document.createElement('tr');

            // Extraction des articles
            let articleStr = '-';
            if (cmd.articles && cmd.articles.length > 0) {
                articleStr = cmd.articles.map(a => `${a.menu_titre} (${a.nb_convives} p.)`).join(', ');
            }

            tr.innerHTML = `
                <td><strong>${cmd.numero_commande}</strong></td>
                <td>
                    <div>${cmd.client_prenom} ${cmd.client_nom}</div>
                    <small style="color: var(--text-muted);">${cmd.client_email}</small>
                </td>
                <td>${cmd.date_livraison_souhaitee}</td>
                <td>${cmd.ville_livraison} <small>(${cmd.distance_km} km)</small></td>
                <td>${articleStr}</td>
                <td><strong>${parseFloat(cmd.total_ttc).toFixed(2)} €</strong></td>
                <td>
                    <select class="status-select ${cmd.statut}" data-id="${cmd.id}">
                        <option value="en_attente" ${cmd.statut === 'en_attente' ? 'selected' : ''}>En attente</option>
                        <option value="validee" ${cmd.statut === 'validee' ? 'selected' : ''}>Validée</option>
                        <option value="en_preparation" ${cmd.statut === 'en_preparation' ? 'selected' : ''}>En préparation</option>
                        <option value="livree" ${cmd.statut === 'livree' ? 'selected' : ''}>Livrée</option>
                        <option value="annulee" ${cmd.statut === 'annulee' ? 'selected' : ''}>Annulée</option>
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
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ statut: nouveauStatut })
                    });

                    if (res.ok) {
                        e.target.className = `status-select ${nouveauStatut}`;
                    } else {
                        alert('Erreur lors du changement de statut.');
                        chargerCommandes();
                    }
                } catch (err) {
                    alert('Erreur de connexion au serveur.');
                    chargerCommandes();
                }
            });
        });
    }
});