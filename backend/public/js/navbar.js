document.addEventListener('DOMContentLoaded', () => {
    const userProfileRaw = localStorage.getItem('user_profile');
    const user = userProfileRaw ? JSON.parse(userProfileRaw) : null;

    // Détection du lien "Connexion" dans l'en-tête
    const navConnexionLink = document.querySelector('a[href*="login"]') || 
                             Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim().toLowerCase() === 'connexion');

    if (navConnexionLink && user) {
        const profileWrapper = document.createElement('div');
        profileWrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 10px;';
        profileWrapper.innerHTML = `
            <span style="font-size: 13px; font-weight: 600; color: var(--color-primary, #721B29);">
                👤 ${user.prenom}
            </span>
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
                window.location.reload();
            });
        }
    }
});