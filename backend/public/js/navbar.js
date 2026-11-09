document.addEventListener('DOMContentLoaded', () => {
    const userProfileRaw = localStorage.getItem('user_profile');
    let user = null;

    try {
        user = userProfileRaw ? JSON.parse(userProfileRaw) : null;
    } catch (e) {
        user = null;
    }

    // Détection du bouton ou lien de connexion
    const navConnexionLink = document.querySelector('.btn-connexion') || 
                             document.querySelector('a[href*="login"]') || 
                             Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim().toLowerCase() === 'connexion');

    if (navConnexionLink && user) {
        const profileWrapper = document.createElement('div');
        profileWrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 12px;';
        profileWrapper.innerHTML = `
            <a href="/compte.html" title="Accéder à mon espace client" style="text-decoration: none; font-size: 13px; font-weight: 700; color: var(--color-primary, #721B29); display: inline-flex; align-items: center; gap: 5px; transition: opacity 0.2s;">
                👤 ${user.prenom}
            </a>
            <button type="button" id="btn-logout" style="background: none; border: 1px solid var(--color-primary, #721B29); color: var(--color-primary, #721B29); padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                Déconnexion
            </button>
        `;

        navConnexionLink.replaceWith(profileWrapper);

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_profile');
                window.location.href = '/';
            });
        }
    }
});