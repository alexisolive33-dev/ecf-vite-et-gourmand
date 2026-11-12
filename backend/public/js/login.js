document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const formForgot = document.getElementById('form-forgot');
    const alertBox = document.getElementById('auth-alert');

    // Récupération des paramètres d'URL (?redirect=... et ?tab=register)
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect');
    const tabParam = urlParams.get('tab');

    function showAlert(message, type = 'danger') {
        if (!alertBox) return;
        alertBox.textContent = message;
        alertBox.className = `auth-alert alert-${type}`;
        alertBox.style.display = 'block';
    }

    function hideAlert() {
        if (!alertBox) return;
        alertBox.style.display = 'none';
    }

    // Bascule entre les formulaires
    window.switchTab = function(tab) {
        hideAlert();
        const tabLogin = document.getElementById('tab-login');
        const tabReg = document.getElementById('tab-register');

        if (formLogin) formLogin.style.display = tab === 'login' ? 'block' : 'none';
        if (formRegister) formRegister.style.display = tab === 'register' ? 'block' : 'none';
        if (formForgot) formForgot.style.display = tab === 'forgot' ? 'block' : 'none';

        if (tabLogin) {
            tabLogin.classList.toggle('active', tab === 'login');
            tabLogin.setAttribute('aria-selected', tab === 'login');
        }
        if (tabReg) {
            tabReg.classList.toggle('active', tab === 'register');
            tabReg.setAttribute('aria-selected', tab === 'register');
        }
    };

    // Ouverture automatique de l'onglet inscription si demandé via l'URL
    if (tabParam === 'register') {
        switchTab('register');
    }

    // Affichage / Masquage du mot de passe à l'inscription
    const toggleRegPwd = document.getElementById('toggle-reg-password');
    const regPwdInput = document.getElementById('reg-password');

    if (toggleRegPwd && regPwdInput) {
        toggleRegPwd.addEventListener('click', () => {
            const estMasque = regPwdInput.type === 'password';
            regPwdInput.type = estMasque ? 'text' : 'password';
            toggleRegPwd.textContent = estMasque ? '🙈' : '👁️';
            toggleRegPwd.setAttribute(
                'aria-label',
                estMasque ? 'Masquer le mot de passe' : 'Afficher le mot de passe en clair'
            );
        });
    }

    // Auto-complétion des communes via le code postal (API Gouv)
    const regCpInput = document.getElementById('reg-cp');
    const regVilleSelect = document.getElementById('reg-ville');

    if (regCpInput && regVilleSelect) {
        regCpInput.addEventListener('input', async (e) => {
            const cp = e.target.value.trim();

            if (!/^[0-9]{5}$/.test(cp)) {
                regVilleSelect.innerHTML = '<option value="">Entrez un code postal (5 chiffres)...</option>';
                return;
            }

            regVilleSelect.innerHTML = '<option value="">Recherche des communes...</option>';
            regVilleSelect.disabled = true;

            try {
                const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom`);
                const communes = await res.json();

                if (!communes || communes.length === 0) {
                    regVilleSelect.innerHTML = '<option value="">Aucune commune trouvée</option>';
                    regVilleSelect.disabled = false;
                    return;
                }

                regVilleSelect.innerHTML = '';
                if (communes.length > 1) {
                    const defaultOpt = document.createElement('option');
                    defaultOpt.value = '';
                    defaultOpt.textContent = `-- Choisissez votre commune (${communes.length}) --`;
                    regVilleSelect.appendChild(defaultOpt);
                }

                communes.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.nom;
                    opt.textContent = c.nom;
                    regVilleSelect.appendChild(opt);
                });

                if (communes.length === 1) {
                    regVilleSelect.value = communes[0].nom;
                }
            } catch (err) {
                console.error('Erreur chargement communes:', err);
                regVilleSelect.innerHTML = '<option value="">Erreur réseau</option>';
            } finally {
                regVilleSelect.disabled = false;
            }
        });
    }

    // 1. Authentification / Connexion
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert();

            const btnSubmit = document.getElementById('btn-login');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Connexion en cours...';
            }

            const payload = {
                email: document.getElementById('login-email').value.trim(),
                mot_de_passe: document.getElementById('login-password').value
            };

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.message || 'Identifiants invalides');
                }

                const userData = data.utilisateur || data.user;
                const token = data.token || data.auth_token;

                // 1. Sauvegarde sessionStorage attendue par admin.js
                sessionStorage.setItem('vg_user', JSON.stringify(userData));

                // 2. Sauvegarde localStorage pour la navbar, le tunnel de commande et l'espace compte
                localStorage.setItem('auth_token', token);
                localStorage.setItem('token', token);
                localStorage.setItem('user_profile', JSON.stringify(userData));
                localStorage.setItem('user', JSON.stringify(userData));

                showAlert('Connexion réussie, redirection...', 'success');

                setTimeout(() => {
                    const role = (userData.role || '').toLowerCase().trim();

                    if (redirectUrl && !redirectUrl.includes('login')) {
                        window.location.href = decodeURIComponent(redirectUrl);
                    } else if (role === 'admin' || role === 'employe') {
                        // José ou employé -> redirection vers le Back-Office
                        window.location.href = '/admin.html';
                    } else {
                        // Client -> redirection vers son Espace Personnel
                        window.location.href = '/compte.html';
                    }
                }, 800);
            } catch (err) {
                showAlert(err.message, 'danger');
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Se connecter';
                }
            }
        });
    }

    // 2. Inscription Client (Règle stricte ECF)
    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert();

            const pwd = document.getElementById('reg-password').value;
            // Exigence ECF : 10 caractères min., 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial
            const regexSecurite = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{10,}$/;

            if (!regexSecurite.test(pwd)) {
                showAlert('Le mot de passe doit comporter au moins 10 caractères, 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial.', 'danger');
                return;
            }

            const btnSubmit = document.getElementById('btn-register');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Création du compte...';
            }

            const emailSaisi = document.getElementById('reg-email').value.trim();

            const payload = {
                nom: document.getElementById('reg-nom').value.trim(),
                prenom: document.getElementById('reg-prenom').value.trim(),
                email: emailSaisi,
                telephone: document.getElementById('reg-tel').value.trim(),
                adresse_postale: document.getElementById('reg-adresse').value.trim(),
                code_postal: document.getElementById('reg-cp').value.trim(),
                ville: document.getElementById('reg-ville').value.trim(),
                mot_de_passe: pwd
            };

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.message || 'Erreur lors de l\'inscription');
                }

                showAlert(data.message, 'success');
                formRegister.reset();
                if (regVilleSelect) {
                    regVilleSelect.innerHTML = '<option value="">Entrez un code postal (5 chiffres)...</option>';
                }

                // Pré-remplit l'email dans l'onglet de connexion pour faciliter l'accès
                const loginEmailInput = document.getElementById('login-email');
                if (loginEmailInput) loginEmailInput.value = emailSaisi;

                setTimeout(() => {
                    switchTab('login');
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = 'Valider mon inscription';
                    }
                }, 1500);
            } catch (err) {
                showAlert(err.message, 'danger');
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Valider mon inscription';
                }
            }
        });
    }

    // 3. Réinitialisation mot de passe par email
    if (formForgot) {
        formForgot.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert();

            const btnSubmit = document.getElementById('btn-forgot');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Envoi en cours...';
            }

            const email = document.getElementById('forgot-email').value.trim();

            try {
                const res = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();

                showAlert(data.message, 'success');
                formForgot.reset();
            } catch (err) {
                showAlert(err.message, 'danger');
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Envoyer le lien de réinitialisation';
                }
            }
        });
    }
});