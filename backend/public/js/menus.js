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

    function afficherMessageGrille(texte, isError = false) {
        if (!catalogGrid) return;
        const p = document.createElement('p');
        p.style.gridColumn = '1 / -1';
        p.style.textAlign = 'center';
        if (isError) p.style.color = 'var(--color-primary)';
        p.textContent = texte;
        catalogGrid.replaceChildren(p);
    }

    // 1. Récupération des formules depuis l'API REST
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
                afficherMessageGrille('Aucun menu disponible pour le moment.');
            }
        })
        .catch(err => {
            console.error('Erreur API menus:', err);
            afficherMessageGrille('Impossible de charger les formules.', true);
        });

    // 2. Écouteurs des filtres
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

            if (convivesFilterActive && parseInt(menu.convives_min, 10) > currentMinConvives) {
                return false;
            }

            return true;
        });

        renderCatalog(filtered);
    }

    // 4. Rendu visuel du catalogue
    function renderCatalog(menus) {
        if (!catalogGrid) return;

        if (menus.length === 0) {
            const emptyBox = document.createElement('div');
            emptyBox.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 40px; background: #FFFFFF; border-radius: 8px; border: 1px solid var(--color-border);';

            const pTitle = document.createElement('p');
            pTitle.style.cssText = 'font-weight: 600; color: var(--color-primary); margin-bottom: 8px;';
            pTitle.textContent = 'Aucune formule ne correspond à vos critères de recherche.';

            const pSub = document.createElement('p');
            pSub.style.cssText = 'font-size: 13px; color: var(--color-text-muted);';
            pSub.textContent = "Essayez d'ajuster le budget ou de réinitialiser les filtres.";

            emptyBox.append(pTitle, pSub);
            catalogGrid.replaceChildren(emptyBox);
            return;
        }

        const fragment = document.createDocumentFragment();

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

            const regimeAffiche = menu.regime ? (menu.regime.charAt(0).toUpperCase() + menu.regime.slice(1)) : 'Classique';
            const imageUrl = menu.image_url || '/assets/images/menus/default-menu.webp';
            const delai = menu.delai_min_jours || 7;
            const stockage = menu.conditions_stockage || 'Conserver entre 0°C et +4°C';

            // 1. Image & Badges
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'card-menu-image';

            const spanRegime = document.createElement('span');
            spanRegime.className = 'pill-regime';
            spanRegime.textContent = regimeAffiche;

            const spanStock = document.createElement('span');
            spanStock.className = 'pill-stock';
            spanStock.textContent = `Il reste ${menu.stock_disponible} commandes`;

            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = `Présentation du menu ${menu.titre || ''}`;
            img.loading = 'lazy';
            img.width = 400;
            img.height = 180;
            img.addEventListener('error', () => {
                img.src = '/assets/images/menus/default-menu.webp';
            }, { once: true });

            imgWrapper.append(spanRegime, spanStock, img);

            // 2. Corps de carte
            const body = document.createElement('div');
            body.className = 'card-menu-body';

            const surtitre = document.createElement('span');
            surtitre.className = 'surtitre-or';
            surtitre.textContent = `THÈME : ${(menu.theme || '').toUpperCase()}`;

            const h3Titre = document.createElement('h3');
            h3Titre.textContent = menu.titre || '';

            const pDesc = document.createElement('p');
            pDesc.textContent = menu.description || '';

            const condBox = document.createElement('div');
            condBox.style.cssText = 'background: #F9FAFB; border-left: 3px solid var(--color-primary); padding: 6px 10px; margin: 10px 0; font-size: 11px; color: #4B5563;';
            const strongCond = document.createElement('strong');
            strongCond.textContent = 'Conditions : ';
            condBox.append(strongCond, document.createTextNode(`Réservation ${delai}j avant • ${stockage}`));

            const labelAllergenes = document.createElement('div');
            labelAllergenes.style.cssText = 'font-size: 11px; color: var(--color-text-muted); margin-bottom: 6px;';
            labelAllergenes.textContent = 'Allergènes :';

            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'allergenes-tags-container';

            if (allergenesSet.size > 0) {
                Array.from(allergenesSet).slice(0, 4).forEach((nom, idx) => {
                    if (idx > 0) tagsContainer.appendChild(document.createTextNode(' '));
                    const tag = document.createElement('span');
                    tag.className = 'allergen-tag';
                    tag.textContent = nom;
                    tagsContainer.appendChild(tag);
                });
            } else {
                const safeTag = document.createElement('span');
                safeTag.className = 'allergen-tag';
                safeTag.style.color = 'var(--badge-success-text)';
                safeTag.textContent = 'Sans allergènes majeurs';
                tagsContainer.appendChild(safeTag);
            }

            const priceDiv = document.createElement('div');
            priceDiv.className = 'card-menu-price';
            priceDiv.textContent = `${parseFloat(menu.prix_unitaire_ttc || 0).toFixed(2).replace('.', ',')} €`;

            const minDiv = document.createElement('div');
            minDiv.className = 'card-menu-min';
            minDiv.textContent = `/ personne (Min. ${menu.convives_min} pers.)`;

            const ctaLink = document.createElement('a');
            ctaLink.href = `/commande.html?id=${menu.id}`;
            ctaLink.className = 'btn-cta';
            ctaLink.style.cssText = 'height: 40px; font-size: 13px; width: 100%; text-align: center; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;';
            ctaLink.textContent = 'Découvrir le menu & Devis →';

            body.append(surtitre, h3Titre, pDesc, condBox, labelAllergenes, tagsContainer, priceDiv, minDiv, ctaLink);
            card.append(imgWrapper, body);
            fragment.appendChild(card);
        });

        catalogGrid.replaceChildren(fragment);
    }
});