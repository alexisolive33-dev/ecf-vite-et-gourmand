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
    inputDate.value = dateMinIso;

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

    function createSpecItem(label, valeur) {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = valeur;
        li.append(document.createTextNode(`${label} : `), span);
        return li;
    }

    function renderMenus(menus) {
        const fragment = document.createDocumentFragment();

        menus.forEach(menu => {
            const card = document.createElement('article');
            card.className = 'menu-card';

            // En-tête de carte
            const header = document.createElement('div');
            header.className = 'menu-card-header';

            const badgesDiv = document.createElement('div');
            badgesDiv.className = 'menu-card-badges';

            const spanTheme = document.createElement('span');
            spanTheme.className = 'badge badge-theme';
            spanTheme.textContent = menu.theme || '';

            const spanRegime = document.createElement('span');
            spanRegime.className = 'badge badge-regime';
            spanRegime.textContent = menu.regime || '';

            badgesDiv.append(spanTheme, spanRegime);

            const title = document.createElement('h3');
            title.className = 'menu-card-title';
            title.textContent = menu.titre || '';

            header.append(badgesDiv, title);

            // Corps de carte
            const body = document.createElement('div');
            body.className = 'menu-card-body';

            const desc = document.createElement('p');
            desc.className = 'menu-card-desc';
            desc.textContent = menu.description || '';

            const specsList = document.createElement('ul');
            specsList.className = 'menu-specs';
            specsList.append(
                createSpecItem('Convives minimum', `${menu.convives_min} pers.`),
                createSpecItem('Délai de commande', `${menu.delai_min_jours} jours min.`),
                createSpecItem('Stock restant', `${menu.stock_disponible} dispo.`)
            );

            body.append(desc, specsList);

            // Pied de carte
            const footer = document.createElement('div');
            footer.className = 'menu-card-footer';

            const priceDiv = document.createElement('div');
            priceDiv.className = 'menu-price';
            const smallUnit = document.createElement('small');
            smallUnit.textContent = '/ pers.';
            priceDiv.append(
                document.createTextNode(`${parseFloat(menu.prix_unitaire_ttc || 0).toFixed(2)} € `),
                smallUnit
            );

            const btnDetails = document.createElement('button');
            btnDetails.type = 'button';
            btnDetails.className = 'btn btn-accent btn-details';
            btnDetails.textContent = 'Voir le menu';
            btnDetails.addEventListener('click', () => ouvrirDetailsMenu(menu.id));

            footer.append(priceDiv, btnDetails);
            card.append(header, body, footer);
            fragment.appendChild(card);
        });

        menusContainer.replaceChildren(fragment);
    }

    function populateMenuSelect(menus) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Choisir une formule --';

        const options = [defaultOpt];
        menus.forEach(m => {
            const opt = document.createElement('option');
            opt.value = String(m.id);
            opt.textContent = `${m.titre} (${parseFloat(m.prix_unitaire_ttc || 0).toFixed(2)} € / pers.)`;
            options.push(opt);
        });

        selectMenu.replaceChildren(...options);
    }

    // Mise à jour de l'aide sur le nombre minimum de convives
    selectMenu.addEventListener('change', () => {
        const m = listeMenus.find(item => item.id == selectMenu.value);
        if (m) {
            convivesHelp.textContent = `Convives minimum requis : ${m.convives_min} personnes (Remise -10% dès ${parseInt(m.convives_min, 10) + 5} pers.)`;
            if (!inputConvives.value || parseInt(inputConvives.value, 10) < parseInt(m.convives_min, 10)) {
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

                modalTitle.textContent = menu.titre || '';
                modalDesc.textContent = menu.description || '';

                const fragment = document.createDocumentFragment();
                if (menu.plats) {
                    menu.plats.forEach(plat => {
                        const platDiv = document.createElement('div');
                        platDiv.className = 'plat-item';

                        const catDiv = document.createElement('div');
                        catDiv.className = 'plat-category';
                        catDiv.textContent = plat.categorie || '';

                        const nomDiv = document.createElement('div');
                        nomDiv.className = 'plat-nom';
                        nomDiv.textContent = plat.nom || '';

                        const descDiv = document.createElement('div');
                        descDiv.style.fontSize = '0.85rem';
                        descDiv.style.color = 'var(--text-muted)';
                        descDiv.textContent = plat.description || '';

                        const allergenesDiv = document.createElement('div');
                        allergenesDiv.className = 'allergenes-list';

                        if (plat.allergenes && plat.allergenes.length > 0) {
                            plat.allergenes.forEach((a, idx) => {
                                if (idx > 0) allergenesDiv.appendChild(document.createTextNode(' '));
                                const badge = document.createElement('span');
                                badge.className = 'badge-inco';
                                badge.textContent = `⚠️ ${a.nom}`;
                                allergenesDiv.appendChild(badge);
                            });
                        } else {
                            const safeSpan = document.createElement('span');
                            safeSpan.style.fontSize = '0.75rem';
                            safeSpan.style.color = 'var(--success)';
                            safeSpan.textContent = 'Aucun allergène majeur déclaré';
                            allergenesDiv.appendChild(safeSpan);
                        }

                        platDiv.append(catDiv, nomDiv, descDiv, allergenesDiv);
                        fragment.appendChild(platDiv);
                    });
                }

                modalPlatsContainer.replaceChildren(fragment);
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
            menu_id: parseInt(selectMenu.value, 10),
            nb_convives: parseInt(inputConvives.value, 10),
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
        const strong = document.createElement('strong');
        strong.textContent = 'Validation impossible :';

        const nodes = [strong];
        erreurs.forEach(err => {
            nodes.push(document.createElement('br'), document.createTextNode(String(err || '')));
        });

        errorBox.replaceChildren(...nodes);
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
            utilisateur_id: 4
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
        .catch(() => {
            alert('Erreur de communication avec le serveur.');
            btnValiderCommande.disabled = false;
            btnValiderCommande.textContent = 'Confirmer et commander';
        });
    });
});