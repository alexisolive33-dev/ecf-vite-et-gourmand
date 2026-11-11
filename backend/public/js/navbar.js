document.addEventListener('DOMContentLoaded', () => {
    const userProfileRaw = localStorage.getItem('user_profile');
    let user = null;

    try {
        user = userProfileRaw ? JSON.parse(userProfileRaw) : null;
    } catch (e) {
        user = null;
    }

    const navConnexionLink = document.querySelector('.btn-connexion') || 
                             document.querySelector('a[href*="login"]') || 
                             Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim().toLowerCase() === 'connexion');

    if (navConnexionLink && user) {
        const isAdmin = user.role === 'admin' || user.role === 'employe';
        const profileWrapper = document.createElement('div');
        profileWrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 10px;';
        profileWrapper.innerHTML = `
            ${isAdmin ? `
                <a href="/admin.html" style="background: var(--color-primary, #721B29); color: #FFFFFF; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                    ⚙️ Admin
                </a>
            ` : ''}
            <a href="/compte.html" title="Accéder à mon espace client" style="text-decoration: none; font-size: 13px; font-weight: 600; color: var(--color-primary, #721B29); display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
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
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                sessionStorage.clear();
                window.location.href = '/';
            });
        }
    }
});