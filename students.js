// assets/js/modules/students.js — управление студентами (админ)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast, showModal, closeModal } from '../core/ui.js';

// ============================================================
// КЭШ СПИСКА СТУДЕНТОВ
// ============================================================
let studentsCache = {
    data: null,
    time: 0,
    ttl: 5000  // 5 секунд
};

async function fetchStudents(forceRefresh) {
    if (forceRefresh === undefined) forceRefresh = false;
    const now = Date.now();

    if (!forceRefresh && studentsCache.data && (now - studentsCache.time) < studentsCache.ttl) {
        return studentsCache.data;
    }

    const list = await apiCall('getStudents');
    const result = list || [];
    studentsCache.data = result;
    studentsCache.time = now;
    return result;
}

export function invalidateStudentsCache() {
    studentsCache.data = null;
    studentsCache.time = 0;
}

// ============================================================
// РЕНДЕР СПИСКА СТУДЕНТОВ
// ============================================================
export async function renderAdminStudents() {
    const c = document.getElementById('studentsList');
    if (!c) return;

    let list = await fetchStudents();

    if (state.studentsGroupFilter !== 'all') {
        list = list.filter(function(s) { return s.group_id == state.studentsGroupFilter; });
    }
    if (state.studentsSearchTerm) {
        list = list.filter(function(s) { return s.name.toLowerCase().indexOf(state.studentsSearchTerm) !== -1; });
    }

    if (!list.length) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Нет студентов</p></div>';
        return;
    }

    const isFounder = state.currentUser && state.currentUser.role === 'founder';

    let html = '';
    for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const balanceDisplay = s.infinite_balance ? '<span class="infinite-badge">♾️ Бесконечно</span>' : s.balance + ' кристаллов';
        const isFounderStudent = s.user_role === 'founder' || s.is_founder === true || s.id < 0;
        const founderBadge = isFounderStudent ? '<span class="founder-badge" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1a0a2e;margin-left:8px;">👑 Основатель</span>' : '';

        let impersonateButton = '';
        if (isFounder && !isFounderStudent && s.id > 0) {
            impersonateButton = '<button class="action-btn impersonate" onclick="event.stopPropagation(); impersonateStudent(' + s.id + ', \'' + escapeHtml(s.name) + '\')" style="background:linear-gradient(135deg,#f59e0b,#d97706);"><i class="fas fa-sign-in-alt"></i> Войти</button>';
        }

        let renameButton = '';
        if (isFounder && !isFounderStudent && s.id > 0) {
            renameButton = '<button class="action-btn rename" onclick="event.stopPropagation(); renameStudent(' + s.id + ', \'' + escapeHtml(s.name) + '\')" style="background:linear-gradient(135deg,#3b82f6,#2563eb);"><i class="fas fa-pen"></i> Переименовать</button>';
        }

        let deleteButton = '';
        if (!isFounderStudent) {
            deleteButton = '<button class="action-btn delete" onclick="event.stopPropagation(); deleteStudent(' + s.id + ')"><i class="fas fa-trash"></i></button>';
        }

        let groupOptions = '';
        if (!isFounderStudent) {
            for (let g = 0; g < state.groups.length; g++) {
                const group = state.groups[g];
                groupOptions += '<option value="' + group.id + '" ' + (s.group_id == group.id ? 'selected' : '') + '>' + group.name + '</option>';
            }
        }

        html += '<div class="student-card" onclick="openStudentManagement(' + s.id + ')">' +
            '<div class="student-header">' +
                '<div>' +
                    '<div class="student-name">' + escapeHtml(s.name) + founderBadge + '</div>' +
                    '<div class="student-group">' + escapeHtml(s.group_name) + ' | Логин: ' + escapeHtml(s.login || '—') + '</div>' +
                '</div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;" onclick="event.stopPropagation()">' +
                    (!isFounderStudent ? '<select class="group-change-select" onchange="changeStudentGroup(\'' + s.id + '\', this.value)">' + groupOptions + '</select>' : '') +
                    '<button class="action-btn change-pwd" onclick="openChangePasswordModal(' + s.id + ',\'student\',\'' + escapeHtml(s.name) + '\',\'' + escapeHtml(s.group_name || '') + '\')"><i class="fas fa-key"></i> Пароль</button>' +
                    '<button class="action-btn give-title" onclick="event.stopPropagation(); showGiveTitleModal(' + s.id + ', \'' + escapeHtml(s.name) + '\')"><i class="fas fa-medal"></i> Выдать тег</button>' +
                    renameButton + impersonateButton + deleteButton +
                '</div>' +
            '</div>' +
            '<div class="student-stats-row">' +
                '<div class="stat-badge-new crystals"><i class="fas fa-gem"></i> ' + balanceDisplay + '</div>' +
                '<div class="stat-badge-new exp"><i class="fas fa-star"></i> ' + (s.total_earned || 0) + ' опыта</div>' +
                (isFounderStudent ?
                    '<div class="infinite-balance-group"><span class="infinite-balance-label" style="background:linear-gradient(135deg,rgba(251,191,36,0.2),rgba(0,0,0,0.3));"><span>♾️ Бесконечный баланс</span></span></div>' :
                    '<div class="infinite-balance-group"><label class="infinite-balance-label"><input type="checkbox" class="infinite-balance-checkbox" data-student-id="' + s.id + '" ' + (s.infinite_balance ? 'checked' : '') + ' onchange="toggleInfiniteBalance(' + s.id + ', this.checked)"><span>♾️ Бесконечный баланс</span></label></div>'
                ) +
            '</div>' +
            '<div class="student-actions-row" onclick="event.stopPropagation()">' +
                '<div class="control-group">' +
                    '<input type="number" id="bal-' + s.id + '" placeholder="Сумма" style="width:90px">' +
                    '<button class="action-btn add" onclick="addBal(\'' + s.id + '\')"><i class="fas fa-plus"></i></button>' +
                    '<button class="action-btn set" onclick="setBal(\'' + s.id + '\')"><i class="fas fa-equals"></i></button>' +
                '</div>' +
                '<div class="control-group">' +
                    '<input type="number" id="exp-' + s.id + '" placeholder="Опыт" style="width:90px">' +
                    '<button class="action-btn add" onclick="addExp(\'' + s.id + '\')"><i class="fas fa-plus"></i></button>' +
                    '<button class="action-btn set" onclick="setExp(\'' + s.id + '\')"><i class="fas fa-equals"></i></button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    c.innerHTML = html;
}

// ============================================================
// ДОБАВЛЕНИЕ СТУДЕНТА
// ============================================================
export async function addStudent() {
    const n = document.getElementById('newStudentName') ? document.getElementById('newStudentName').value.trim() : '';
    const l = document.getElementById('newStudentLogin') ? document.getElementById('newStudentLogin').value.trim() : '';
    const p = document.getElementById('newStudentPassword') ? document.getElementById('newStudentPassword').value : '';
    const gid = document.getElementById('newStudentGroup') ? document.getElementById('newStudentGroup').value : '';

    if (!n || !l || !p) {
        showToast('Заполните все поля', 'error');
        return;
    }
    if (!gid || gid === '') {
        showToast('Выберите группу', 'error');
        return;
    }

    const btn = document.getElementById('adminAddStudentBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Добавление...';
    }

    try {
        const result = await apiCall('addStudent', 'POST', {
            name: n,
            login: l,
            password: p,
            group_id: gid,
            user_id: state.currentUser ? state.currentUser.id : 0,
            user_login: state.currentUser ? state.currentUser.login : ''
        });

        if (result) {
            showToast('✅ Студент добавлен', 'success');
            closeModal('addStudentModal');

            const newStudentName = document.getElementById('newStudentName');
            const newStudentLogin = document.getElementById('newStudentLogin');
            const newStudentPassword = document.getElementById('newStudentPassword');
            const newStudentGroup = document.getElementById('newStudentGroup');
            if (newStudentName) newStudentName.value = '';
            if (newStudentLogin) newStudentLogin.value = '';
            if (newStudentPassword) newStudentPassword.value = '';
            if (newStudentGroup) newStudentGroup.value = '';

            invalidateStudentsCache();
            await renderAdminStudents();
        } else {
            showToast('❌ Ошибка при добавлении студента', 'error');
        }
    } catch (e) {
        console.error('addStudent error:', e);
        showToast('❌ Ошибка при добавлении', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Добавить';
        }
    }
}

// ============================================================
// УДАЛЕНИЕ
// ============================================================
export async function deleteStudent(id) {
    if (id < 0) {
        showToast('❌ Нельзя удалить основателя', 'error');
        return;
    }
    if (!state.currentUser || (state.currentUser.role !== 'founder' && state.currentUser.role !== 'admin')) {
        showToast('❌ Недостаточно прав для удаления', 'error');
        return;
    }

    if (confirm('Удалить студента? Это действие нельзя отменить.')) {
        const result = await apiCall('deleteStudent', 'POST', {
            student_id: id,
            user_id: state.currentUser ? state.currentUser.id : 0,
            user_login: state.currentUser ? state.currentUser.login : ''
        });

        if (result) {
            showToast('✅ Студент удалён', 'success');
            invalidateStudentsCache();
            await renderAdminStudents();
        } else {
            showToast('❌ Ошибка при удалении', 'error');
        }
    }
}

// ============================================================
// БАЛАНС И ОПЫТ
// ============================================================
export async function addBal(id) {
    const v = parseInt(document.getElementById('bal-' + id) ? document.getElementById('bal-' + id).value : 0) || 0;
    if (v > 0) {
        await apiCall('updateBalance', 'POST', {
            student_id: id,
            amount: v,
            operation: 'add',
            user_id: state.currentUser ? state.currentUser.id : 0,
            user_login: state.currentUser ? state.currentUser.login : ''
        });
        invalidateStudentsCache();
        await renderAdminStudents();
    }
}

export async function setBal(id) {
    const v = parseInt(document.getElementById('bal-' + id) ? document.getElementById('bal-' + id).value : 0) || 0;
    await apiCall('updateBalance', 'POST', {
        student_id: id,
        amount: v,
        operation: 'set',
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });
    invalidateStudentsCache();
    await renderAdminStudents();
}

export async function addExp(id) {
    const v = parseInt(document.getElementById('exp-' + id) ? document.getElementById('exp-' + id).value : 0) || 0;
    if (v > 0) {
        await apiCall('updateExperience', 'POST', {
            student_id: id,
            amount: v,
            operation: 'add',
            user_id: state.currentUser ? state.currentUser.id : 0,
            user_login: state.currentUser ? state.currentUser.login : ''
        });
        invalidateStudentsCache();
        await renderAdminStudents();
    }
}

export async function setExp(id) {
    const v = parseInt(document.getElementById('exp-' + id) ? document.getElementById('exp-' + id).value : 0) || 0;
    await apiCall('updateExperience', 'POST', {
        student_id: id,
        amount: v,
        operation: 'set',
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });
    invalidateStudentsCache();
    await renderAdminStudents();
}

// ============================================================
// СМЕНА ГРУППЫ
// ============================================================
export async function changeStudentGroup(id, gid) {
    await apiCall('changeStudentGroup', 'POST', {
        student_id: id,
        group_id: gid,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });
    invalidateStudentsCache();
    await renderAdminStudents();
}

// ============================================================
// БЕСКОНЕЧНЫЙ БАЛАНС
// ============================================================
export async function toggleInfiniteBalance(studentId, isInfinite) {
    if (!state.currentUser || (state.currentUser.role !== 'founder' && state.currentUser.role !== 'admin')) {
        showToast('Недостаточно прав', 'error');
        return;
    }

    await apiCall('toggleInfiniteBalance', 'POST', {
        student_id: studentId,
        infinite: isInfinite ? 1 : 0,
        user_id: state.currentUser.id,
        user_login: state.currentUser.login
    });

    showToast(isInfinite ? '✅ Бесконечный баланс включён' : '🔒 Бесконечный баланс выключен', 'success');

    if (state.currentStudent && state.currentStudent.id == studentId) {
        state.currentStudent.infinite_balance = isInfinite;
        if (typeof window.updateMenuProfile === 'function') window.updateMenuProfile();
        if (typeof window.renderShop === 'function') await window.renderShop();
        if (typeof window.updateStudentStats === 'function') await window.updateStudentStats();
    }
    if (state.founderStudentData && state.founderStudentData.id == studentId) {
        state.founderStudentData.infinite_balance = isInfinite;
        if (state.founderToggleMode) {
            state.currentStudent = state.founderStudentData;
            if (typeof window.updateMenuProfile === 'function') window.updateMenuProfile();
            if (typeof window.renderShop === 'function') await window.renderShop();
        }
    }

    invalidateStudentsCache();
    await renderAdminStudents();
}

// ============================================================
// ПЕРЕИМЕНОВАНИЕ
// ============================================================
export async function renameStudent(studentId, currentName) {
    if (!state.currentUser || state.currentUser.role !== 'founder') {
        showToast('Доступ запрещен', 'error');
        return;
    }
    if (studentId < 0) {
        showToast('Нельзя переименовать основателя', 'error');
        return;
    }

    const newName = prompt('Введите новое имя студента:', currentName);
    if (!newName || newName === currentName) return;

    if (newName.length < 2 || newName.length > 50) {
        showToast('Имя должно быть от 2 до 50 символов', 'error');
        return;
    }

    showToast('🔄 Сохранение...', 'info');

    const result = await apiCall('renameStudent', 'POST', {
        student_id: studentId,
        new_name: newName,
        user_id: state.currentUser.id,
        user_login: state.currentUser.login
    });

    if (result) {
        showToast('✅ Студент переименован: ' + result.old_name + ' → ' + result.new_name, 'success');
        invalidateStudentsCache();
        await renderAdminStudents();
    } else {
        showToast('❌ Ошибка при переименовании', 'error');
    }
}

// ============================================================
// ВЫДАТЬ ТЕГ (модалка)
// ============================================================
export async function showGiveTitleModal(studentId, studentName) {
    const allTitles = await apiCall('getTitles');
    if (!allTitles || allTitles.length === 0) {
        showToast('Нет доступных тегов', 'error');
        return;
    }

    const existingModal = document.getElementById('giveTitleModal');
    if (existingModal) existingModal.remove();

    let optionsHtml = '';
    for (let i = 0; i < allTitles.length; i++) {
        const t = allTitles[i];
        optionsHtml += '<option value="' + t.id + '">' + t.icon + ' ' + escapeHtml(t.name) + ' (' + t.rarity + ')</option>';
    }

    const modalHtml = '<div class="modal active" id="giveTitleModal">' +
        '<div class="modal-content">' +
            '<div class="modal-header">' +
                '<h3><i class="fas fa-medal"></i> Выдать тег студенту: ' + escapeHtml(studentName) + '</h3>' +
                '<button class="modal-close" id="giveTitleModalCloseBtn">&times;</button>' +
            '</div>' +
            '<div class="modal-body">' +
                '<select id="titleToGiveSelect" class="title-select">' + optionsHtml + '</select>' +
            '</div>' +
            '<div class="modal-footer">' +
                '<button class="btn-cancel" id="giveTitleModalCancelBtn">Отмена</button>' +
                '<button class="btn-primary" id="giveTitleModalConfirmBtn">Выдать</button>' +
            '</div>' +
        '</div>' +
    '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const closeBtn = document.getElementById('giveTitleModalCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', function() {
        const modal = document.getElementById('giveTitleModal');
        if (modal) modal.remove();
    });

    const cancelBtn = document.getElementById('giveTitleModalCancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', function() {
        const modal = document.getElementById('giveTitleModal');
        if (modal) modal.remove();
    });

    const modal = document.getElementById('giveTitleModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.remove();
        });
    }

    const confirmBtn = document.getElementById('giveTitleModalConfirmBtn');
    if (confirmBtn) {
        confirmBtn.onclick = async function() {
            const titleId = document.getElementById('titleToGiveSelect').value;
            await confirmGiveTitle(studentId, titleId);
            const modalEl = document.getElementById('giveTitleModal');
            if (modalEl) modalEl.remove();
        };
    }
}

export async function confirmGiveTitle(studentId, titleId) {
    const result = await apiCall('giveTitle', 'POST', {
        student_id: studentId,
        title_id: titleId,
        user_id: state.currentUser.id,
        user_login: state.currentUser.login
    });
    if (result) {
        showToast('✅ Тег успешно выдан', 'success');
    }
}

// ============================================================
// ВХОД ОТ ЛИЦА СТУДЕНТА
// ============================================================
export async function impersonateStudent(studentId, studentName) {
    if (!state.currentUser || state.currentUser.role !== 'founder') {
        showToast('Доступ запрещен', 'error');
        return;
    }

    if (!confirm('Войти в аккаунт студента "' + studentName + '"? Вы сможете вернуться обратно кликнув по профилю.')) {
        return;
    }

    showToast('🔄 Вход в аккаунт студента...', 'info');

    try {
        const result = await apiCall('impersonateStudent', 'POST', {
            founder_id: state.currentUser.id,
            student_id: studentId
        });

        if (result && result.id) {
            state.currentStudent = {
                id: result.id,
                name: result.name,
                group_name: result.group_name || 'Без группы',
                balance: result.balance || 0,
                total_earned: result.total_earned || 0,
                infinite_balance: result.infinite_balance || 0,
                is_impersonating: true
            };
            state.founderToggleMode = true;

            const studentNavs = document.querySelectorAll('.student-nav');
            for (let sn = 0; sn < studentNavs.length; sn++) studentNavs[sn].classList.remove('hidden');

            const adminNavs = document.querySelectorAll('.admin-nav');
            for (let an = 0; an < adminNavs.length; an++) adminNavs[an].classList.add('hidden');

            if (typeof window.updateMenuProfile === 'function') window.updateMenuProfile();
            if (typeof window.updateStudentStats === 'function') await window.updateStudentStats();

            showToast('✅ Вы вошли как ' + studentName, 'success');
            if (typeof window.switchPage === 'function') window.switchPage('schedule');

            if (typeof window.renderSchedule === 'function') await window.renderSchedule();
            if (typeof window.renderShop === 'function') await window.renderShop();
            if (typeof window.renderTitlesShop === 'function') await window.renderTitlesShop();
        } else {
            showToast('❌ Не удалось войти в аккаунт студента', 'error');
        }
    } catch (e) {
        console.error('Impersonate error:', e);
        showToast('❌ Ошибка при входе в аккаунт', 'error');
    }
}

export function openStudentManagement(sid) {
    const card = document.querySelector('.student-card[onclick*="' + sid + '"]');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('student-card-highlight');
        setTimeout(function() { card.classList.remove('student-card-highlight'); }, 2000);
    }
}

// ============================================================
// ФИЛЬТРЫ СТУДЕНТОВ
// ============================================================
let studentFiltersDone = false;

export function initStudentFilters() {
    if (studentFiltersDone) return;
    studentFiltersDone = true;

    const stSearch = document.getElementById('studentsSearchInput');
    if (stSearch) {
        stSearch.addEventListener('input', function(e) {
            state.studentsSearchTerm = e.target.value.toLowerCase();
            renderAdminStudents();
        });
    }

    const grFilter = document.getElementById('studentsGroupFilter');
    if (grFilter) {
        grFilter.addEventListener('change', function(e) {
            state.studentsGroupFilter = e.target.value;
            renderAdminStudents();
        });
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ МОДУЛЯ СТУДЕНТОВ (модалки и кнопки)
// ============================================================
let studentsInitDone = false;

export function initStudentsModule() {
    if (studentsInitDone) return;
    studentsInitDone = true;

    // Кнопка "Добавить студента" — открывает модалку
    const showAddStudentModal = document.getElementById('showAddStudentModal');
    if (showAddStudentModal) {
        const newBtn = showAddStudentModal.cloneNode(true);
        showAddStudentModal.parentNode.replaceChild(newBtn, showAddStudentModal);
        newBtn.addEventListener('click', function() {
            showModal('addStudentModal');
        });
    } else {
        console.warn('⚠️ Кнопка showAddStudentModal не найдена');
    }

    // Кнопка "Добавить" внутри модалки — создаёт студента
    const adminAddStudentBtn = document.getElementById('adminAddStudentBtn');
    if (adminAddStudentBtn) {
        const newBtn = adminAddStudentBtn.cloneNode(true);
        adminAddStudentBtn.parentNode.replaceChild(newBtn, adminAddStudentBtn);
        newBtn.addEventListener('click', addStudent);
    } else {
        console.warn('⚠️ Кнопка adminAddStudentBtn не найдена');
    }

    // Фильтры
    initStudentFilters();
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.renderAdminStudents = renderAdminStudents;
window.addStudent = addStudent;
window.deleteStudent = deleteStudent;
window.addBal = addBal;
window.setBal = setBal;
window.addExp = addExp;
window.setExp = setExp;
window.changeStudentGroup = changeStudentGroup;
window.toggleInfiniteBalance = toggleInfiniteBalance;
window.renameStudent = renameStudent;
window.showGiveTitleModal = showGiveTitleModal;
window.confirmGiveTitle = confirmGiveTitle;
window.impersonateStudent = impersonateStudent;
window.openStudentManagement = openStudentManagement;
window.initStudentFilters = initStudentFilters;
window.initStudentsModule = initStudentsModule;
window.invalidateStudentsCache = invalidateStudentsCache;