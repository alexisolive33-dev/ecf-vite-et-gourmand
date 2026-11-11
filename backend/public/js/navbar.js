document.addEventListener('DOMContentLoaded', () => {
    const navContainer = document.querySelector('.navbar-container');
    const nav = document.querySelector('.header-nav nav');
    const userProfileRaw = localStorage.getItem('user_profile') || localStorage.getItem('user');
    let user = null;

    try {
        user = userProfileRaw ? JSON.parse(userProfileRaw) : null;
    } catch (e) {
        user = null;
    }

    const isAdmin = user && (user.role === 'admin' || user.role === 'employe');

    // 1. Mise à jour de l'affichage sur Desktop
    const navConnexionLink = document.querySelector('.btn-connexion') || 
                             document.querySelector('a[href*="login"]') || 
                             Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim().toLowerCase() === 'connexion');

    if (navConnexionLink && user) {
        const profileWrapper = document.createElement('div');
        profileWrapper.style.cssText = 'display: inline-flex; align-items: center; justify-content: flex-end; gap: 10px; justify-self: end;';
        profileWrapper.innerHTML = `
            ${isAdmin ? `
                <a href="/admin.html" style="background: var(--color-primary, #721B29); color: #FFFFFF; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                    ⚙️ Admin
                </a>
            ` : ''}
            <a href="/compte.html" title="Accéder à mon espace client" style="text-decoration: none; font-size: 13px; font-weight: 700; color: var(--color-primary, #721B29); display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                👤 ${user.prenom || 'Client'}
            </a>
            <button type="button" class="btn-logout-trigger" style="background: none; border: 1px solid var(--color-primary, #721B29); color: var(--color-primary, #721B29); padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                Déconnexion
            </button>
        `;
        navConnexionLink.replaceWith(profileWrapper);
    }

    // 2. Gestion du menu mobile (Bouton Hamburger & Tiroir Figma)
    if (navContainer && nav) {
        // Injection du bouton burger s'il n'existe pas encore dans le DOM
        let burgerBtn = navContainer.querySelector('.burger-btn');
        if (!burgerBtn) {
            burgerBtn = document.createElement('button');
            burgerBtn.className = 'burger-btn';
            burgerBtn.setAttribute('type', 'button');
            burgerBtn.setAttribute('aria-label', 'Ouvrir le menu de navigation');
            burgerBtn.setAttribute('aria-expanded', 'false');
            burgerBtn.innerHTML = '<span></span><span></span><span></span>';
            navContainer.appendChild(burgerBtn);
        }

        // Insertion du bloc compte / connexion dans le tiroir mobile
        let mobileAuth = nav.querySelector('.mobile-auth-slot');
        if (!mobileAuth) {
            mobileAuth = document.createElement('div');
            mobileAuth.className = 'mobile-auth-slot';

            if (user) {
                mobileAuth.innerHTML = `
                    <a href="/compte.html" class="btn-cta" style="height: 42px; font-size: 13px; text-decoration: none;">
                        👤 Mon Espace Client (${user.prenom || 'Client'})
                    </a>
                    ${isAdmin ? `
                        <a href="/admin.html" class="btn-cta-secondary" style="height: 38px; font-size: 13px; text-decoration: none; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;">
                            ⚙️ Tableau de Bord Admin
                        </a>
                    ` : ''}
                    <button type="button" class="btn-logout-trigger" style="background: none; border: 1px solid #991B1B; color: #991B1B; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                        Déconnexion
                    </button>
                `;
            } else {
                mobileAuth.innerHTML = `
                    <a href="/login.html" class="btn-cta" style="height: 42px; font-size: 13px; text-decoration: none;">
                        Se connecter / S'inscrire
                    </a>
                `;
            }
            nav.appendChild(mobileAuth);
        }

        // Écouteur d'ouverture / fermeture du hamburger
        burgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = nav.classList.toggle('open');
            burgerBtn.classList.toggle('active', isOpen);
            burgerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Fermer le tiroir quand on clique sur un lien de navigation
        nav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('open');
                burgerBtn.classList.remove('active');
                burgerBtn.setAttribute('aria-expanded', 'false');
            });
        });

        // Fermer le tiroir si on clique en dehors
        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target) && !burgerBtn.contains(e.target)) {
                nav.classList.remove('open');
                burgerBtn.classList.remove('active');
                burgerBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // 3. Écouteur global de déconnexion (desktop et tiroir mobile)
    document.querySelectorAll('.btn-logout-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_profile');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.clear();
            window.location.href = '/';
        });
    });
});