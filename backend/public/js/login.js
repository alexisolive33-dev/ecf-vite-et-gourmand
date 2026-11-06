document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorBox = document.getElementById('login-error');
    const submitBtn = document.getElementById('btn-submit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Vérification...';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: emailInput.value.trim(),
                    mot_de_passe: passwordInput.value
                })
            });

            const data = await res.json();

            if (!res.ok || data.statut !== 'succes') {
                errorBox.textContent = data.message || 'Identifiants incorrects.';
                errorBox.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Se connecter';
                return;
            }

            // Sauvegarde de la session administrateur
            sessionStorage.setItem('vg_user', JSON.stringify(data.utilisateur));
            sessionStorage.setItem('vg_token', data.token);

            // Redirection vers le tableau de bord
            window.location.href = '/admin.html';

        } catch (err) {
            errorBox.textContent = 'Erreur réseau lors de la tentative de connexion.';
            errorBox.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Se connecter';
        }
    });
});