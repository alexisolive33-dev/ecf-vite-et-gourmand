document.addEventListener('DOMContentLoaded', () => {
    let allMenus = [];
    let currentRegime = '';
    let currentMinConvives = 4;
    let convivesFilterActive = false;

    const catalogGrid = document.getElementById('catalog-grid');
    const rangePrix = document.getElementById('filter-range-prix');
    const labelPrixMax = document.getElementById('label-prix-max');
    const selectTheme = document.getElementById('filter-theme');
    const checkboxesBudget = document.querySelectorAll('.filter-budget');
    const dietPills = document.querySelectorAll('.diet-pill');
    const btnConvivesMinus = document.getElementById('btn-convives-minus');
    const btnConvivesPlus = document.getElementById('btn-convives-plus');
    const valConvives = document.getElementById('val-convives');
    const btnReset = document.getElementById('btn-reset-filters');

    function normaliser(str) {
        return (str || '')
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    // 1. Récupération des menus depuis l'API REST
    fetch('/api/menus')
        .then(res => res.json())
        .then(res => {
            if (res.statut === 'succes' && res.donnees.length > 0) {
                Promise.all(res.donnees.map(menu => 
                    fetch(`/api/menus/${menu.id}`)
                        .then(r => r.json())
                        .then(detail => detail.statut === 'succes' ? detail.donnees : menu)
                        .catch(() => menu)
                )).then(fullMenus => {
                    allMenus = fullMenus;
                    applyFilters();
                });
            } else {
                catalogGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Aucun menu disponible pour le moment.</p>';
            }
        })
        .catch(err => {
            console.error('Erreur API menus:', err);
            catalogGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--color-primary);">Impossible de charger les formules.</p>';
        });

    // 2. Écouteurs de filtres
    if (rangePrix) {
        rangePrix.addEventListener('input', (e) => {
            if (labelPrixMax) labelPrixMax.textContent = `Prix maximum : ${e.target.value} € / pers`;
            applyFilters();
        });
    }

    if (selectTheme) selectTheme.addEventListener('change', applyFilters);
    checkboxesBudget.forEach(cb => cb.addEventListener('change', applyFilters));

    dietPills.forEach(pill => {
        pill.addEventListener('click', () => {
            dietPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentRegime = pill.getAttribute('data-regime') || '';
            applyFilters();
        });
    });

    if (btnConvivesMinus) {
        btnConvivesMinus.addEventListener('click', () => {
            if (currentMinConvives > 1) {
                currentMinConvives--;
                convivesFilterActive = true;
                if (valConvives) valConvives.textContent = `${currentMinConvives} pers.`;
                applyFilters();
            }
        });
    }

    if (btnConvivesPlus) {
        btnConvivesPlus.addEventListener('click', () => {
            currentMinConvives++;
            convivesFilterActive = true;
            if (valConvives) valConvives.textContent = `${currentMinConvives} pers.`;
            applyFilters();
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (rangePrix) rangePrix.value = 65;
            if (labelPrixMax) labelPrixMax.textContent = 'Prix maximum : 65 € / pers';
            if (selectTheme) selectTheme.value = '';
            currentRegime = '';
            convivesFilterActive = false;
            currentMinConvives = 4;
            if (valConvives) valConvives.textContent = '4 pers.';
            dietPills.forEach(p => p.classList.remove('active'));
            if (dietPills[0]) dietPills[0].classList.add('active');
            checkboxesBudget.forEach(cb => cb.checked = false);
            applyFilters();
        });
    }

    // 3. Moteur de filtrage dynamique
    function applyFilters() {
        const maxPrice = rangePrix ? parseFloat(rangePrix.value) : 999;
        const selectedTheme = selectTheme ? normaliser(selectTheme.value) : '';
        const checkedBudgets = Array.from(checkboxesBudget).filter(cb => cb.checked).map(cb => cb.value);

        const filtered = allMenus.filter(menu => {
            const price = parseFloat(menu.prix_unitaire_ttc);
            const menuRegime = normaliser(menu.regime);
            const targetRegime = normaliser(currentRegime);

            if (price > maxPrice) return false;

            if (checkedBudgets.length > 0) {
                const matchBudget = checkedBudgets.some(b => {
                    if (b === 'under-30') return price < 30;
                    if (b === '30-50') return price >= 30 && price <= 50;
                    if (b === 'over-50') return price > 50;
                    return true;
                });
                if (!matchBudget) return false;
            }

            if (selectedTheme && normaliser(menu.theme) !== selectedTheme) return false;

            if (targetRegime) {
                if (targetRegime === 'vegetarien') {
                    if (menuRegime !== 'vegetarien' && menuRegime !== 'vegan') return false;
                } else if (menuRegime !== targetRegime) {
                    return false;
                }
            }

            if (convivesFilterActive && parseInt(menu.convives_min) > currentMinConvives) {
                return false;
            }

            return true;
        });

        renderCatalog(filtered);
    }

    // 4. Rendu visuel du catalogue
    function renderCatalog(menus) {
        catalogGrid.innerHTML = '';

        if (menus.length === 0) {
            catalogGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: #FFFFFF; border-radius: 8px; border: 1px solid var(--color-border);">
                    <p style="font-weight: 600; color: var(--color-primary); margin-bottom: 8px;">Aucune formule ne correspond à vos critères de recherche.</p>
                    <p style="font-size: 13px; color: var(--color-text-muted);">Essayez d'ajuster le budget ou de réinitialiser les filtres.</p>
                </div>
            `;
            return;
        }

        const estConnecte = !!localStorage.getItem('auth_token');

        menus.forEach(menu => {
            const card = document.createElement('article');
            card.className = 'card-menu-catalog';

            const allergenesSet = new Set();
            if (menu.plats && Array.isArray(menu.plats)) {
                menu.plats.forEach(plat => {
                    if (plat.allergenes && Array.isArray(plat.allergenes)) {
                        plat.allergenes.forEach(a => allergenesSet.add(a.nom));
                    }
                });
            }

            let tagsHtml = '';
            if (allergenesSet.size > 0) {
                tagsHtml = Array.from(allergenesSet).slice(0, 4).map(nom => 
                    `<span class="allergen-tag">${nom}</span>`
                ).join(' ');
            } else {
                tagsHtml = '<span class="allergen-tag" style="color: var(--badge-success-text);">Sans allergènes majeurs</span>';
            }

            const regimeAffiche = menu.regime ? (menu.regime.charAt(0).toUpperCase() + menu.regime.slice(1)) : 'Classique';
            const imageUrl = menu.image_url || '/assets/images/menus/default-menu.webp';
            const delai = menu.delai_min_jours || 7;
            const stockage = menu.conditions_stockage || 'Conserver entre 0°C et +4°C';

            // Lien direct ou redirection d'authentification exigée par l'ECF
            const targetUrl = estConnecte 
                ? `/commande.html?id=${menu.id}` 
                : `/login.html?redirect=${encodeURIComponent('/commande.html?id=' + menu.id)}`;

            card.innerHTML = `
                <div class="card-menu-image">
                    <span class="pill-regime">${regimeAffiche}</span>
                    <span class="pill-stock">● Il reste ${menu.stock_disponible} commandes</span>
                    <img 
                        src="${imageUrl}" 
                        alt="Présentation du menu ${menu.titre}" 
                        loading="lazy"
                        width="400"
                        height="180"
                        onerror="this.onerror=null; this.src='/assets/images/menus/default-menu.webp';"
                    >
                </div>
                <div class="card-menu-body">
                    <span class="surtitre-or">THÈME : ${(menu.theme || '').toUpperCase()}</span>
                    <h3>${menu.titre}</h3>
                    <p>${menu.description}</p>
                    
                    <!-- Exigence ECF : Mise en évidence des conditions -->
                    <div style="background: #F9FAFB; border-left: 3px solid var(--color-primary); padding: 6px 10px; margin: 10px 0; font-size: 11px; color: #4B5563;">
                        <strong>Conditions :</strong> Réservation ${delai}j avant • ${stockage}
                    </div>

                    <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 6px;">Allergènes :</div>
                    <div class="allergenes-tags-container">
                        ${tagsHtml}
                    </div>

                    <div class="card-menu-price">${parseFloat(menu.prix_unitaire_ttc).toFixed(2)} €</div>
                    <div class="card-menu-min">/ personne (Min. ${menu.convives_min} pers.)</div>

                    <a href="${targetUrl}" class="btn-cta" style="height: 40px; font-size: 13px; width: 100%; text-align: center; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;">
                        ${estConnecte ? 'Commander ce menu &rarr;' : 'Se connecter pour commander &rarr;'}
                    </a>
                </div>
            `;

            catalogGrid.appendChild(card);
        });
    }
});