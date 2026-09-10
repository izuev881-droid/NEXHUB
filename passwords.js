// assets/js/modules/passwords.js — управление паролями (основатель)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast, showModal } from '../core/ui.js';

// ============================================================
// ЗАГРУЗКА ТАБЛИЦЫ ПАРОЛЕЙ
// ============================================================
export async function loadPasswords(type) {
    if (type === undefined) type = 'all';
    if (!state.currentUser || state.currentUser.role !== 'founder') return;

    const tr = type === 'students' ? 'students' : (type === 'admins' ? 'admins' : 'all');

    const r = await apiCall('getPasswords', 'GET', {
        user_id: state.currentUser.id,
        role: state.currentUser.role,
        target_role: tr
    });

    const tbody = document.getElementById('passwordsTableBody');
    if (!tbody) return;

    if (r && r.length) {
        let html = '';
        for (let i = 0; i < r.length; i++) {
            const u = r[i];
            html += '<tr>' +
                '<td style="padding:8px">' + u.id + '</td>' +
                '<td style="padding:8px">' + escapeHtml(u.login) + '</td>' +
                '<td style="padding:8px"><span style="color:#10b981;">' + escapeHtml(u.password || '—') + '</span></td>' +
                '<td style="padding:8px">' + (u.role === 'founder' ? '👑 Основатель' : (u.role === 'admin' ? '🛡️ Админ' : '🎓 Студент')) + '</td>' +
                '<td style="padding:8px">' + escapeHtml(u.student_name || '—') + '</td>' +
            '</tr>';
        }
        tbody.innerHTML = html;
    } else {
        tbody.innerHTML = '<tr><td colspan="5">Нет данных</td></tr>';
    }
}

// ============================================================
// СМЕНА ПАРОЛЯ
// ============================================================
export function openSelfChangePasswordModal() {
    if (!state.currentUser) return;

    let uid, role, uname, ugroup = '';
    if (state.currentStudent) {
        uid = state.currentStudent.id;
        role = 'student';
        uname = state.currentStudent.name;
        ugroup = state.currentStudent.group_name || '';
    } else {
        uid = state.currentUser.id;
        role = state.currentUser.role;
        uname = state.currentUser.login;
    }
    openChangePasswordModal(uid, role, uname, ugroup);
}

export function openChangePasswordModal(uid, role, uname, ugroup) {
    if (ugroup === undefined) ugroup = '';

    apiCall('canChangePassword', 'GET', { user_id: uid, current_user_id: state.currentUser ? state.currentUser.id : 0 }).then(function(r) {
        if (r && !r.can_change) {
            showToast('❌ ' + (r.reason || 'Нельзя изменить пароль'), 'error');
            return;
        }

        state.currentChangeUserId = uid;
        state.currentChangeUserRole = role;

        const changePwdUserName = document.getElementById('changePwdUserName');
        const changePwdUserRole = document.getElementById('changePwdUserRole');
        const changePwdUserGroup = document.getElementById('changePwdUserGroup');

        if (changePwdUserName) changePwdUserName.textContent = uname;
        if (changePwdUserRole) changePwdUserRole.textContent = role === 'founder' ? 'Основатель' : (role === 'admin' ? 'Администратор' : 'Студент');
        if (changePwdUserGroup) changePwdUserGroup.textContent = ugroup || '—';

        const changePwdNewPassword = document.getElementById('changePwdNewPassword');
        const changePwdConfirmPassword = document.getElementById('changePwdConfirmPassword');
        if (changePwdNewPassword) changePwdNewPassword.value = '';
        if (changePwdConfirmPassword) changePwdConfirmPassword.value = '';

        showModal('changePasswordModal');

        // Инициализация кнопок показа пароля внутри модалки
        setTimeout(function() {
            if (typeof window.initPasswordToggles === 'function') window.initPasswordToggles();
        }, 50);
    });
}

export async function confirmChangePassword() {
    const np = document.getElementById('changePwdNewPassword') ? document.getElementById('changePwdNewPassword').value : '';
    const cp = document.getElementById('changePwdConfirmPassword') ? document.getElementById('changePwdConfirmPassword').value : '';

    if (!np || np.length < 4) { showToast('Пароль минимум 4 символа', 'error'); return; }
    if (np !== cp) { showToast('Пароли не совпадают', 'error'); return; }

    await apiCall('changePassword', 'POST', {
        user_id: state.currentChangeUserId,
        new_password: np,
        role: state.currentChangeUserRole,
        current_user_id: state.currentUser ? state.currentUser.id : 0,
        current_user_login: state.currentUser ? state.currentUser.login : ''
    });

    showToast('✅ Пароль изменён', 'success');
    if (typeof window.closeModal === 'function') window.closeModal('changePasswordModal');
}

// ============================================================
// УНИВЕРСАЛЬНЫЙ ПЕРЕКЛЮЧАТЕЛЬ ПОКАЗА ПАРОЛЯ
// ============================================================
export function initPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.password-toggle-btn, .modal-pwd-toggle');

    toggleButtons.forEach(function(btn) {
        btn.removeEventListener('click', btn._passwordToggleHandler);

        const handler = function(e) {
            e.preventDefault();
            e.stopPropagation();

            let targetInput = null;
            if (this.classList.contains('modal-pwd-toggle')) {
                const targetId = this.getAttribute('data-target');
                if (targetId) targetInput = document.getElementById(targetId);
            } else {
                const parent = this.closest('.auth-input-group-new, .modal-body');
                if (parent) targetInput = parent.querySelector('input[type="password"], input[type="text"]');
                if (!targetInput) {
                    const sibling = this.previousElementSibling;
                    if (sibling && sibling.tagName === 'INPUT') targetInput = sibling;
                }
            }

            if (targetInput) {
                const currentType = targetInput.getAttribute('type');
                const newType = currentType === 'password' ? 'text' : 'password';
                targetInput.setAttribute('type', newType);

                const icon = this.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-eye');
                    icon.classList.toggle('fa-eye-slash');
                }
            }
        };

        btn._passwordToggleHandler = handler;
        btn.addEventListener('click', handler);
    });
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initPasswords() {
    if (state.currentUser && state.currentUser.role === 'founder') {
        const pwdTabs = document.querySelectorAll('.password-tab');
        for (let i = 0; i < pwdTabs.length; i++) {
            pwdTabs[i].addEventListener('click', function() {
                const tabs = document.querySelectorAll('.password-tab');
                for (let t = 0; t < tabs.length; t++) tabs[t].classList.remove('active');
                this.classList.add('active');
                loadPasswords(this.dataset.passType);
            });
        }
        loadPasswords('all');
    }

    const confirmChangePasswordBtn = document.getElementById('confirmChangePasswordBtn');
    if (confirmChangePasswordBtn) confirmChangePasswordBtn.addEventListener('click', confirmChangePassword);

    const sidebarChangePwd = document.getElementById('sidebarChangePwd');
    if (sidebarChangePwd) {
        sidebarChangePwd.addEventListener('click', function(e) {
            e.preventDefault();
            openSelfChangePasswordModal();
        });
    }

    const sidebarAdminChangePwd = document.getElementById('sidebarAdminChangePwd');
    if (sidebarAdminChangePwd) {
        sidebarAdminChangePwd.addEventListener('click', function(e) {
            e.preventDefault();
            openSelfChangePasswordModal();
        });
    }
}

// Экспорт в window
window.loadPasswords = loadPasswords;
window.openSelfChangePasswordModal = openSelfChangePasswordModal;
window.openChangePasswordModal = openChangePasswordModal;
window.confirmChangePassword = confirmChangePassword;
window.initPasswordToggles = initPasswordToggles;
window.initPasswords = initPasswords;