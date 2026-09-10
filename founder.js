// assets/js/modules/founder.js — панель основателя

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast, showModal } from '../core/ui.js';

// ============================================================
// СТУДЕНТ ОСНОВАТЕЛЯ (невидимый)
// ============================================================
export async function initFounderStudent() {
    if (!state.currentUser || state.currentUser.role !== 'founder') return;

    try {
        const result = await apiCall('getFounderStudent', 'GET', { founder_id: state.currentUser.id });
        if (result && result.id) {
            state.founderStudentData = {
                id: result.id,
                name: result.name || state.currentUser.login,
                group_name: '👑 Основатель',
                balance: result.balance || 0,
                total_earned: result.total_earned || 0,
                infinite_balance: 1,
                attended: 0,
                is_founder: true
            };
        } else {
            state.founderStudentData = {
                id: -state.currentUser.id,
                name: state.currentUser.login,
                group_name: '👑 Основатель',
                balance: 0,
                total_earned: 0,
                infinite_balance: 1,
                attended: 0,
                is_founder: true
            };
        }
    } catch (e) {
        console.error('initFounderStudent error:', e);
        state.founderStudentData = {
            id: -state.currentUser.id,
            name: state.currentUser.login,
            group_name: '👑 Основатель',
            balance: 0,
            total_earned: 0,
            infinite_balance: 1,
            attended: 0,
            is_founder: true
        };
    }

    const founderNameInput = document.getElementById('founderNameInput');
    const founderStudentContent = document.getElementById('founderStudentContent');
    if (founderNameInput) founderNameInput.value = state.currentUser.login;
    if (founderStudentContent) founderStudentContent.style.display = 'block';

    updateFounderStatsDisplay();
}

export function updateFounderStatsDisplay() {
    if (!state.founderStudentData) return;
    const founderBalance = document.getElementById('founderBalance');
    const founderExp = document.getElementById('founderExp');
    const founderAttended = document.getElementById('founderAttended');
    if (founderBalance) founderBalance.innerHTML = (state.founderStudentData.infinite_balance ? '♾️ ' : '') + (state.founderStudentData.balance || 0) + ' 💎';
    if (founderExp) founderExp.textContent = (state.founderStudentData.total_earned || 0) + ' ⭐';
    if (founderAttended) founderAttended.textContent = state.founderStudentData.attended || 0;
}

export async function updateFounderStudentStats() {
    if (!state.founderStudentData) return;

    try {
        const result = await apiCall('getFounderStudent', 'GET', { founder_id: state.currentUser.id });
        if (result && result.id) {
            state.founderStudentData = {
                id: result.id,
                name: result.name || state.currentUser.login,
                group_name: '👑 Основатель',
                balance: result.balance || 0,
                total_earned: result.total_earned || 0,
                infinite_balance: 1,
                attended: result.attended || 0,
                is_founder: true
            };
        }
    } catch (e) {
        console.error('updateFounderStudentStats error:', e);
    }
    updateFounderStatsDisplay();

    if (state.founderToggleMode) {
        const topBalanceValue = document.getElementById('topBalanceValue');
        if (topBalanceValue) {
            if (state.founderStudentData.infinite_balance) {
                topBalanceValue.innerHTML = '&#8734;';
                topBalanceValue.style.fontSize = '20px';
                topBalanceValue.style.fontWeight = '700';
                topBalanceValue.style.color = '#c44dff';
                topBalanceValue.style.textShadow = '0 0 3px #9b4dff';
            } else {
                topBalanceValue.textContent = state.founderStudentData.balance || 0;
                topBalanceValue.style.fontSize = '';
                topBalanceValue.style.fontWeight = '';
                topBalanceValue.style.color = '';
                topBalanceValue.style.textShadow = '';
            }
        }
    }
}

// ============================================================
// ПЕРЕКЛЮЧЕНИЕ РЕЖИМА ОСНОВАТЕЛЯ (вход/выход)
// ============================================================
export function toggleFounderMode() {
    // ⚡ Работает в обе стороны:
    //   - если founderToggleMode === true → выходим в режим основателя
    //   - если founderToggleMode === false → входим в режим студента-основателя

    if (!state.currentUser || state.currentUser.role !== 'founder') return;

    if (state.founderToggleMode) {
        // ====== ВЫХОД ИЗ РЕЖИМА СТУДЕНТА ======
        state.founderToggleMode = false;
        state.currentStudent = null;

        // Обновляем localStorage
        if (state.currentUser) {
            localStorage.setItem('nexhub_user', JSON.stringify(state.currentUser));
        }
        localStorage.removeItem('nexhub_student');

        // Переключаем навигацию
        const studentNavs = document.querySelectorAll('.student-nav');
        for (let sn = 0; sn < studentNavs.length; sn++) studentNavs[sn].classList.add('hidden');

        const adminNavs = document.querySelectorAll('.admin-nav');
        for (let an = 0; an < adminNavs.length; an++) adminNavs[an].classList.remove('hidden');

        // Обновляем профиль в шапке
        if (typeof window.updateMenuProfile === 'function') window.updateMenuProfile();

        // Обновляем статистику
        updateFounderStudentStats();
        if (typeof window.updateFounderStats === 'function') window.updateFounderStats();

        // Возвращаемся на страницу студентов
        if (typeof window.switchPage === 'function') window.switchPage('students');

        showToast('👑 Вы вернулись в режим основателя', 'success');
    } else {
        // ====== ВХОД В РЕЖИМ СТУДЕНТА-ОСНОВАТЕЛЯ ======
        if (!state.founderStudentData) {
            showToast('❌ Данные студента-основателя не загружены', 'error');
            return;
        }

        state.founderToggleMode = true;
        state.currentStudent = state.founderStudentData;

        // Обновляем localStorage
        if (state.currentUser) {
            localStorage.setItem('nexhub_user', JSON.stringify(state.currentUser));
        }
        localStorage.setItem('nexhub_student', JSON.stringify(state.currentStudent));

        // Переключаем навигацию
        const studentNavs = document.querySelectorAll('.student-nav');
        for (let sn = 0; sn < studentNavs.length; sn++) studentNavs[sn].classList.remove('hidden');

        const adminNavs = document.querySelectorAll('.admin-nav');
        for (let an = 0; an < adminNavs.length; an++) adminNavs[an].classList.add('hidden');

        // Обновляем профиль
        if (typeof window.updateMenuProfile === 'function') window.updateMenuProfile();

        // Открываем расписание
        if (typeof window.switchPage === 'function') window.switchPage('schedule');

        // Обновляем статистику студента
        if (typeof window.updateStudentStats === 'function') window.updateStudentStats();

        showToast('🎓 Вы вошли в режим студента', 'success');
    }
}

// ============================================================
// ИМЯ ОСНОВАТЕЛЯ
// ============================================================
export async function updateFounderName() {
    const n = document.getElementById('founderNameInput') ? document.getElementById('founderNameInput').value.trim() : '';
    if (!n) { showToast('Введите имя', 'error'); return; }

    await apiCall('updateFounderName', 'POST', {
        founder_id: state.currentUser.id,
        name: n
    });

    if (state.founderStudentData) {
        state.founderStudentData.name = n;
        if (state.founderToggleMode) {
            state.currentStudent = state.founderStudentData;
            if (typeof window.updateMenuProfile === 'function') window.updateMenuProfile();
        }
    }
    showToast('✅ Имя обновлено', 'success');
}

// ============================================================
// БАЛАНС ОСНОВАТЕЛЯ
// ============================================================
export async function addFounderBalance() {
    const amountElem = document.getElementById('founderBalanceInput');
    const amount = amountElem ? parseInt(amountElem.value) : 0;
    if (isNaN(amount) || amount === 0) { showToast('Введите сумму', 'error'); return; }

    await apiCall('updateFounderBalance', 'POST', {
        founder_id: state.currentUser.id,
        amount: amount,
        operation: 'add',
        founder_login: state.currentUser.login
    });

    showToast('➕ Баланс обновлен (бесконечный режим активен)', 'success');
    await updateFounderStudentStats();
}

export async function setFounderBalance() {
    const amountElem = document.getElementById('founderBalanceInput');
    const amount = amountElem ? parseInt(amountElem.value) : 0;
    if (isNaN(amount) || amount < 0) { showToast('Введите корректную сумму', 'error'); return; }

    await apiCall('updateFounderBalance', 'POST', {
        founder_id: state.currentUser.id,
        amount: amount,
        operation: 'set',
        founder_login: state.currentUser.login
    });

    showToast('💰 Баланс обновлен (бесконечный режим активен)', 'success');
    await updateFounderStudentStats();
}

// ============================================================
// ОПЫТ ОСНОВАТЕЛЯ
// ============================================================
export async function addFounderExp() {
    const amountElem = document.getElementById('founderExpInput');
    const amount = amountElem ? parseInt(amountElem.value) : 0;
    if (isNaN(amount) || amount === 0) { showToast('Введите количество опыта', 'error'); return; }

    const result = await apiCall('updateFounderExperience', 'POST', {
        founder_id: state.currentUser.id,
        amount: amount,
        operation: 'add',
        founder_login: state.currentUser.login
    });

    if (result) {
        showToast('✅ +' + amount + ' опыта получено!', 'success');
        await updateFounderStudentStats();
        if (state.founderToggleMode) {
            if (state.currentStudent) state.currentStudent.total_earned = (state.currentStudent.total_earned || 0) + amount;
            if (typeof window.updateStudentStats === 'function') await window.updateStudentStats();
        }
    } else {
        showToast('❌ Ошибка при начислении опыта', 'error');
    }
}

export async function setFounderExp() {
    const amountElem = document.getElementById('founderExpInput');
    const amount = amountElem ? parseInt(amountElem.value) : 0;
    if (isNaN(amount) || amount < 0) { showToast('Введите корректное количество опыта', 'error'); return; }

    const result = await apiCall('updateFounderExperience', 'POST', {
        founder_id: state.currentUser.id,
        amount: amount,
        operation: 'set',
        founder_login: state.currentUser.login
    });

    if (result) {
        showToast('🎯 Опыт установлен на ' + amount, 'success');
        await updateFounderStudentStats();
        if (state.founderToggleMode) {
            if (state.currentStudent) state.currentStudent.total_earned = amount;
            if (typeof window.updateStudentStats === 'function') await window.updateStudentStats();
        }
    } else {
        showToast('❌ Ошибка при установке опыта', 'error');
    }
}

// ============================================================
// АККАУНТЫ АДМИНОВ
// ============================================================
export async function renderAdminAccounts() {
    const c = document.getElementById('adminsList');
    if (!c) return;

    const users = await apiCall('getAllUsersWithRoles', 'GET', { founder_id: state.currentUser ? state.currentUser.id : 0 });
    if (!users || users.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Нет пользователей</p></div>';
        return;
    }

    const totalUsers = users.length;
    const totalAdmins = users.filter(function(u) { return u.role === 'admin'; }).length;
    const totalStudents = users.filter(function(u) { return u.role === 'student'; }).length;

    const statUsers = document.getElementById('statTotalUsers');
    const statAdmins = document.getElementById('statTotalAdmins');
    const statStudents = document.getElementById('statTotalStudents');

    if (statUsers) statUsers.textContent = totalUsers;
    if (statAdmins) statAdmins.textContent = totalAdmins;
    if (statStudents) statStudents.textContent = totalStudents;

    const adm = users.filter(function(u) { return u.role === 'admin' || u.role === 'founder'; });
    let html = '';
    for (let i = 0; i < adm.length; i++) {
        const a = adm[i];
        const isF = a.role === 'founder';
        const isMe = state.currentUser && state.currentUser.id === a.id;

        html += '<div class="admin-user-card ' + (isF ? 'founder-card' : '') + '">' +
            '<div class="admin-user-info">' +
                '<div class="admin-user-login">' +
                    '<i class="fas ' + (isF ? 'fa-crown' : 'fa-user-shield') + '"></i> ' + escapeHtml(a.login) + ' ' +
                    (isF ? '<span class="founder-badge">Основатель</span>' : '<span class="admin-badge">Админ</span>') +
                    (isMe ? '<span class="current-user-badge">Вы</span>' : '') +
                '</div>' +
            '</div>' +
            ((isF || isMe) ? '' : '<div class="admin-user-actions"><button class="action-btn delete-admin" onclick="delAdminFounder(' + a.id + ',\'' + escapeHtml(a.login) + '\')"><i class="fas fa-trash"></i> Удалить</button></div>') +
        '</div>';
    }
    c.innerHTML = html;
}

export async function delAdminFounder(id, login) {
    if (confirm('Удалить администратора "' + login + '"?')) {
        await apiCall('deleteAdminByFounder', 'POST', {
            admin_id: id,
            founder_id: state.currentUser ? state.currentUser.id : 0,
            founder_login: state.currentUser ? state.currentUser.login : ''
        });
        await renderAdminAccounts();
    }
}

export async function addAdmin() {
    const l = document.getElementById('newAdminLogin') ? document.getElementById('newAdminLogin').value.trim() : '';
    const p = document.getElementById('newAdminPassword') ? document.getElementById('newAdminPassword').value : '';
    const cp = document.getElementById('newAdminConfirmPassword') ? document.getElementById('newAdminConfirmPassword').value : '';

    if (!l || !p) { showToast('Заполните поля', 'error'); return; }
    if (p !== cp) { showToast('Пароли не совпадают', 'error'); return; }
    if (p.length < 4) { showToast('Пароль минимум 4 символа', 'error'); return; }

    await apiCall('addAdmin', 'POST', {
        login: l,
        password: p,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    showToast('✅ Администратор добавлен', 'success');
    if (typeof window.closeModal === 'function') window.closeModal('addAdminModal');

    const newAdminLogin = document.getElementById('newAdminLogin');
    const newAdminPassword = document.getElementById('newAdminPassword');
    const newAdminConfirmPassword = document.getElementById('newAdminConfirmPassword');
    if (newAdminLogin) newAdminLogin.value = '';
    if (newAdminPassword) newAdminPassword.value = '';
    if (newAdminConfirmPassword) newAdminConfirmPassword.value = '';

    await renderAdminAccounts();
}

// ============================================================
// ОБНОВЛЕНИЕ СТАТИСТИКИ ОСНОВАТЕЛЯ
// ============================================================
export async function updateFounderStats() {
    if (!state.currentUser || state.currentUser.role !== 'founder') return;

    try {
        const [users, students, items, events, titles, groups, promos, messages] = await Promise.all([
            apiCall('getAllUsersWithRoles', 'GET', { founder_id: state.currentUser.id }),
            apiCall('getStudents', 'GET', {}),
            apiCall('getShopItems', 'GET', {}),
            apiCall('getEvents', 'GET', {}),
            apiCall('getTitles', 'GET', {}),
            apiCall('getGroups', 'GET', {}),
            apiCall('getPromocodes', 'GET', {}),
            apiCall('getCommonMessages', 'GET', {})
        ]);

        const totalUsers = users ? users.length : 0;
        const totalAdmins = users ? users.filter(function(u) { return u.role === 'admin'; }).length : 0;
        const totalStudents = users ? users.filter(function(u) { return u.role === 'student'; }).length : 0;

        let todayAttendance = 0;
        const today = new Date().toDateString();
        if (students) {
            for (let i = 0; i < Math.min(students.length, 20); i++) {
                const att = await apiCall('getStudentAttendance', 'GET', { student_id: students[i].id });
                if (att) {
                    for (let j = 0; j < att.length; j++) {
                        if (new Date(att[j].created_at).toDateString() === today) todayAttendance++;
                    }
                }
            }
        }

        let totalCrystals = 0;
        let totalExp = 0;
        if (students) {
            for (let s = 0; s < students.length; s++) {
                totalCrystals += students[s].balance || 0;
                totalExp += students[s].total_earned || 0;
            }
        }

        const elements = {
            'statTotalUsers': totalUsers,
            'statTotalAdmins': totalAdmins,
            'statTotalStudents': totalStudents,
            'statTodayAttendance': todayAttendance,
            'statTotalItems': items ? items.length : 0,
            'statTotalCrystals': totalCrystals,
            'statTotalExp': totalExp,
            'statTotalPromos': promos ? promos.length : 0,
            'statTotalEvents': events ? events.length : 0,
            'statTotalTitles': titles ? titles.length : 0,
            'statTotalGroups': groups ? groups.length : 0,
            'statTotalMessages': messages ? messages.length : 0
        };

        for (const id in elements) {
            const el = document.getElementById(id);
            if (el) el.textContent = elements[id];
        }
    } catch (e) {
        console.error('Update founder stats error:', e);
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initFounderPanel() {
    const showAddAdminModal = document.getElementById('showAddAdminModal');
    if (showAddAdminModal) showAddAdminModal.addEventListener('click', function() { showModal('addAdminModal'); });

    const adminAddAdminBtn = document.getElementById('adminAddAdminBtn');
    if (adminAddAdminBtn) adminAddAdminBtn.addEventListener('click', addAdmin);
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.initFounderStudent = initFounderStudent;
window.updateFounderStatsDisplay = updateFounderStatsDisplay;
window.updateFounderStudentStats = updateFounderStudentStats;
window.toggleFounderMode = toggleFounderMode;
window.updateFounderName = updateFounderName;
window.addFounderBalance = addFounderBalance;
window.setFounderBalance = setFounderBalance;
window.addFounderExp = addFounderExp;
window.setFounderExp = setFounderExp;
window.renderAdminAccounts = renderAdminAccounts;
window.delAdminFounder = delAdminFounder;
window.addAdmin = addAdmin;
window.updateFounderStats = updateFounderStats;
window.initFounderPanel = initFounderPanel;