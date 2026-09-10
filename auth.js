// assets/js/modules/auth.js — авторизация, сессия, вход/выход

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { showToast } from '../core/ui.js';

// ============================================================
// ВХОД
// ============================================================
export async function login(login, password) {
    const d = await apiCall('login', 'POST', {
        login: login,
        password: password,
        role: state.selectedRole
    });

    if (!d) {
        showToast('❌ Неверный логин или пароль', 'error');
        return false;
    }

    // Очищаем кэш титулов при входе
    state.userTitleCache = {};
    state.userTitleColorCache = {};

    state.currentUser = d.user;
    state.currentStudent = d.student || null;
    state.currentSessionToken = d.session_token;

    if (state.currentUser) {
        state.currentUser.session_token = state.currentSessionToken;
    }

    // Сохраняем в localStorage
    localStorage.setItem('nexhub_user', JSON.stringify(state.currentUser));
    if (state.currentStudent) {
        localStorage.setItem('nexhub_student', JSON.stringify(state.currentStudent));
    } else {
        localStorage.removeItem('nexhub_student');
    }

    // Сбрасываем режим impersonate
    state.founderToggleMode = false;
    state.founderStudentData = null;

    // Запускаем проверку сессии
    if (state.sessionCheckInterval) clearInterval(state.sessionCheckInterval);
    state.sessionCheckInterval = setInterval(async function() {
        if (!await checkSessionAndLockdown()) {
            clearInterval(state.sessionCheckInterval);
        }
    }, 3000);

    return true;
}

// ============================================================
// ВЫХОД
// ============================================================
export function logout() {
    if (state.currentUser) {
        apiCall('logout', 'POST', { user_id: state.currentUser.id });
    }
    performLogout();
}

export function performLogout() {
    state.currentUser = null;
    state.currentStudent = null;
    state.currentSessionToken = null;
    state.founderStudentData = null;
    state.founderToggleMode = false;

    // Очищаем кэш
    state.userTitleCache = {};
    state.userTitleColorCache = {};

    localStorage.removeItem('nexhub_user');
    localStorage.removeItem('nexhub_student');

    if (state.sessionCheckInterval) clearInterval(state.sessionCheckInterval);
    if (state.unreadCheckInterval) clearInterval(state.unreadCheckInterval);

    const authOverlay = document.getElementById('authOverlay');
    const mainApp = document.getElementById('mainApp');

    if (authOverlay) authOverlay.classList.remove('hidden');
    if (mainApp) mainApp.classList.remove('visible');
}

// ============================================================
// ПРОВЕРКА СЕССИИ И БЛОКИРОВКИ
// ============================================================
export async function checkSessionAndLockdown() {
    if (!state.currentUser) return true;

    // Проверка блокировки
    try {
        const lockdownResponse = await fetch(state.API_URL + '?endpoint=getLockdownStatus&t=' + Date.now());
        const lockdownData = await lockdownResponse.json();

        if (lockdownData.success && lockdownData.data.enabled && state.currentUser.role !== 'founder') {
            performLogout();
            showLockdownScreen(lockdownData.data.message);
            return false;
        }
    } catch (e) { /* ignore */ }

    // Проверка токена сессии
    try {
        const r = await apiCall('checkSession', 'GET', {
            user_id: state.currentUser.id,
            session_token: state.currentSessionToken || (state.currentUser.session_token || '')
        });

        if (r && !r.valid) {
            if (r.lockdown) showLockdownScreen('Доступ ограничен администратором');
            performLogout();
            return false;
        }
        return true;
    } catch (e) {
        return true;
    }
}

// ============================================================
// ЭКРАН БЛОКИРОВКИ
// ============================================================
export function showLockdownScreen(message) {
    const lockdownScreen = document.getElementById('lockdownScreen');
    const lockdownMessageElem = document.getElementById('lockdownMessage');
    const mainApp = document.getElementById('mainApp');

    if (lockdownMessageElem) {
        lockdownMessageElem.textContent = message || 'Сайт временно заблокирован администратором';
    }
    if (lockdownScreen) lockdownScreen.style.display = 'flex';
    if (mainApp) mainApp.classList.remove('visible');
}

export function hideLockdownScreen() {
    const lockdownScreen = document.getElementById('lockdownScreen');
    if (lockdownScreen) lockdownScreen.style.display = 'none';
}

// ============================================================
// ФОРМА АВТОРИЗАЦИИ (обработчики UI)
// ============================================================
export function initAuthForm() {
    // Переключение вкладок (студент / админ)
    const authTabs = document.querySelectorAll('.auth-tab-new');
    for (let i = 0; i < authTabs.length; i++) {
        authTabs[i].addEventListener('click', function() {
            const tabs = document.querySelectorAll('.auth-tab-new');
            for (let t = 0; t < tabs.length; t++) {
                tabs[t].classList.remove('active');
            }
            this.classList.add('active');
            state.selectedRole = this.dataset.role;
        });
    }

    // Форма входа
    const loginForm = document.getElementById('loginForm');
    const loginInput = document.getElementById('loginInput');
    const passwordInput = document.getElementById('passwordInput');

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (await login(loginInput.value, passwordInput.value)) {
                document.dispatchEvent(new CustomEvent('user:logged-in'));
            }
        });
    }

    // Показ/скрытие пароля
    const togglePwdBtn = document.getElementById('togglePasswordBtn');
    if (togglePwdBtn && passwordInput) {
        togglePwdBtn.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = this.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    }

    // Навигация стрелками
    if (loginInput && passwordInput) {
        loginInput.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                passwordInput.focus();
            }
        });
        passwordInput.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                loginInput.focus();
            }
        });
    }

    // Кнопка выхода в верхней панели
    initHeaderLogout();
}

// ============================================================
// КНОПКА ВЫХОДА В ВЕРХНЕЙ ПАНЕЛИ
// ============================================================
export function initHeaderLogout() {
    const logoutBtn = document.getElementById('headerLogoutBtn');
    if (!logoutBtn) return;

    // Клонируем, чтобы сбросить старые обработчики
    const newBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);

    newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (confirm('Вы уверены, что хотите выйти?')) {
            logout();
        }
    });
}

// Экспорт в window
window.login = login;
window.logout = logout;
window.performLogout = performLogout;
window.showLockdownScreen = showLockdownScreen;
window.hideLockdownScreen = hideLockdownScreen;
window.initAuthForm = initAuthForm;
window.initHeaderLogout = initHeaderLogout;
window.checkSessionAndLockdown = checkSessionAndLockdown;