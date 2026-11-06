document.addEventListener('DOMContentLoaded', () => {
    let listeMenus = [];
    let simulationCourante = null;

    // Éléments du DOM
    const menusContainer = document.getElementById('menus-container');
    const modal = document.getElementById('menu-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    const modalPlatsContainer = document.getElementById('modal-plats-container');
    const btnCommanderModal = document.getElementById('btn-commander-modal');

    // Éléments du simulateur
    const selectMenu = document.getElementById('select-menu');
    const inputConvives = document.getElementById('input-convives');
    const inputDate = document.getElementById('input-date');
    const inputVille = document.getElementById('input-ville');
    const inputDistance = document.getElementById('input-distance');
    const inputAdresse = document.getElementById('input-adresse');
    const btnCalculer = document.getElementById('btn-calculer');
    const btnValiderCommande = document.getElementById('btn-valider-commande');
    const convivesHelp = document.getElementById('convives-help');

    // Blocs d'affichage devis
    const resultPlaceholder = document.getElementById('result-placeholder');
    const resultContent = document.getElementById('result-content');
    const errorBox = document.getElementById('devis-error-box');

    // 1. Initialiser la date minimale autorisée (J + 7 jours)
    const dateMin = new Date();
    dateMin.setDate(dateMin.getDate() + 7);
    const dateMinIso = dateMin.toISOString().slice(0, 16);
    inputDate.min = dateMinIso;
    inputDate.value = dateMinIso; // valeur indicative par défaut

    // 2. Charger les menus depuis l'API REST
    fetch('/api/menus')
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes' && res.donnees.length > 0) {
                listeMenus = res.donnees;
                renderMenus(listeMenus);
                populateMenuSelect(listeMenus);
            }
        })
        .catch(err => console.error('Erreur chargement menus:', err));

    function renderMenus(menus) {
        menusContainer.innerHTML = '';
        menus.forEach(menu => {
            const card = document.createElement('article');
            card.className = 'menu-card';
            card.innerHTML = `
                <div class="menu-card-header">
                    <div class="menu-card-badges">
                        <span class="badge badge-theme">${menu.theme}</span>
                        <span class="badge badge-regime">${menu.regime}</span>
                    </div>
                    <h3 class="menu-card-title">${menu.titre}</h3>
                </div>
                <div class="menu-card-body">
                    <p class="menu-card-desc">${menu.description}</p>
                    <ul class="menu-specs">
                        <li>Convives minimum : <span>${menu.convives_min} pers.</span></li>
                        <li>Délai de commande : <span>${menu.delai_min_jours} jours min.</span></li>
                        <li>Stock restant : <span>${menu.stock_disponible} dispo.</span></li>
                    </ul>
                </div>
                <div class="menu-card-footer">
                    <div class="menu-price">${parseFloat(menu.prix_unitaire_ttc).toFixed(2)} € <small>/ pers.</small></div>
                    <button class="btn btn-accent btn-details" data-id="${menu.id}">Voir le menu</button>
                </div>
            `;
            menusContainer.appendChild(card);
        });

        document.querySelectorAll('.btn-details').forEach(button => {
            button.addEventListener('click', (e) => {
                ouvrirDetailsMenu(e.target.getAttribute('data-id'));
            });
        });
    }

    function populateMenuSelect(menus) {
        selectMenu.innerHTML = '<option value="">-- Choisir une formule --</option>';
        menus.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.titre} (${parseFloat(m.prix_unitaire_ttc).toFixed(2)} € / pers.)`;
            selectMenu.appendChild(opt);
        });
    }

    // Mise à jour de l'aide sur le nombre minimum de convives
    selectMenu.addEventListener('change', () => {
        const m = listeMenus.find(item => item.id == selectMenu.value);
        if (m) {
            convivesHelp.textContent = `Convives minimum requis : ${m.convives_min} personnes (Remise -10% dès ${parseInt(m.convives_min) + 5} pers.)`;
            if (!inputConvives.value || parseInt(inputConvives.value) < parseInt(m.convives_min)) {
                inputConvives.value = m.convives_min;
            }
        }
    });

    // 3. Modale Allergènes INCO
    let selectedMenuModalId = null;
    function ouvrirDetailsMenu(id) {
        selectedMenuModalId = id;
        fetch(`/api/menus/${id}`)
            .then(res => res.json())
            .then(res => {
                if (res.statut !== 'succes') return;
                const menu = res.donnees;

                modalTitle.textContent = menu.titre;
                modalDesc.textContent = menu.description;
                modalPlatsContainer.innerHTML = '';

                if (menu.plats) {
                    menu.plats.forEach(plat => {
                        const platDiv = document.createElement('div');
                        platDiv.className = 'plat-item';
                        let badgesHtml = '';
                        if (plat.allergenes && plat.allergenes.length > 0) {
                            badgesHtml = plat.allergenes.map(a => `<span class="badge-inco">⚠️ ${a.nom}</span>`).join(' ');
                        } else {
                            badgesHtml = '<span style="font-size: 0.75rem; color: var(--success);">Aucun allergène majeur déclaré</span>';
                        }
                        platDiv.innerHTML = `
                            <div class="plat-category">${plat.categorie}</div>
                            <div class="plat-nom">${plat.nom}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted);">${plat.description || ''}</div>
                            <div class="allergenes-list">${badgesHtml}</div>
                        `;
                        modalPlatsContainer.appendChild(platDiv);
                    });
                }
                modal.classList.add('active');
            });
    }

    modalCloseBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    btnCommanderModal.addEventListener('click', () => {
        if (selectedMenuModalId) {
            selectMenu.value = selectedMenuModalId;
            selectMenu.dispatchEvent(new Event('change'));
            modal.classList.remove('active');
            document.getElementById('simulateur').scrollIntoView({ behavior: 'smooth' });
        }
    });

    // 4. Calcul du Devis via l'API
    btnCalculer.addEventListener('click', () => {
        errorBox.style.display = 'none';

        const payload = {
            menu_id: parseInt(selectMenu.value),
            nb_convives: parseInt(inputConvives.value),
            distance_km: parseFloat(inputDistance.value || 0),
            date_livraison: inputDate.value.replace('T', ' ') + ':00',
            ville: inputVille.value.trim()
        };

        if (!payload.menu_id || !payload.nb_convives || !payload.date_livraison || !payload.ville) {
            alert('Veuillez remplir tous les champs du formulaire.');
            return;
        }

        fetch('/api/commandes/simuler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) {
                afficherErreurs(data.erreurs || [data.message]);
                return;
            }
            afficherDevis(data.simulation);
        })
        .catch(err => console.error('Erreur simulation:', err));
    });

    function afficherDevis(sim) {
        simulationCourante = sim;
        resultPlaceholder.style.display = 'none';
        resultContent.style.display = 'block';

        document.getElementById('res-menu-titre').textContent = sim.menu_titre;
        document.getElementById('res-convives').textContent = `${sim.nb_convives} personnes`;
        document.getElementById('res-prix-unit').textContent = `${sim.prix_unitaire_ttc.toFixed(2)} €`;
        document.getElementById('res-total-brut').textContent = `${sim.sous_total_brut.toFixed(2)} €`;

        const discountBox = document.getElementById('res-discount-container');
        if (sim.remise_appliquee) {
            discountBox.style.display = 'flex';
            document.getElementById('res-remise').textContent = `- ${sim.montant_remise.toFixed(2)} €`;
        } else {
            discountBox.style.display = 'none';
        }

        document.getElementById('res-frais-livraison').textContent = `${sim.frais_livraison.toFixed(2)} € (${sim.ville_livraison}, ${sim.distance_km} km)`;
        document.getElementById('res-total-ttc').textContent = `${sim.total_ttc.toFixed(2)} €`;
    }

    function afficherErreurs(erreurs) {
        errorBox.innerHTML = '<strong>Validation impossible :</strong><br>' + erreurs.join('<br>');
        errorBox.style.display = 'block';
        resultContent.style.display = 'block';
        resultPlaceholder.style.display = 'none';
    }

    // 5. Enregistrement réel de la commande
    btnValiderCommande.addEventListener('click', () => {
        if (!simulationCourante) return;

        const payload = {
            menu_id: simulationCourante.menu_id,
            nb_convives: simulationCourante.nb_convives,
            distance_km: simulationCourante.distance_km,
            date_livraison: simulationCourante.date_livraison,
            ville: simulationCourante.ville_livraison,
            adresse_livraison: inputAdresse.value.trim() || 'Adresse fournie par client',
            utilisateur_id: 4 // Client de test par défaut
        };

        btnValiderCommande.disabled = true;
        btnValiderCommande.textContent = 'Enregistrement en cours...';

        fetch('/api/commandes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes') {
                alert(`Commande validée avec succès !\nNuméro de commande : ${res.commande.numero_commande}\nTotal : ${res.commande.total_ttc} €`);
                window.location.reload();
            } else {
                alert('Erreur : ' + res.message);
                btnValiderCommande.disabled = false;
                btnValiderCommande.textContent = 'Confirmer et commander';
            }
        })
        .catch(err => {
            alert('Erreur de communication avec le serveur.');
            btnValiderCommande.disabled = false;
            btnValiderCommande.textContent = 'Confirmer et commander';
        });
    });
});