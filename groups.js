// assets/js/modules/groups.js — управление группами (админ)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast, showModal, closeModal } from '../core/ui.js';

// ============================================================
// СПИСОК ГРУПП
// ============================================================
export async function renderAdminGroups() {
    const c = document.getElementById('groupsList');
    if (!c) return;

    const gl = await apiCall('getGroups');
    if (!gl || gl.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-layer-group"></i><p>Нет групп</p></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < gl.length; i++) {
        const g = gl[i];
        html += '<div class="group-card-new">' +
            '<span>' + escapeHtml(g.name) + '</span>' +
            '<button class="action-btn delete" onclick="delGroup(\'' + g.id + '\', \'' + escapeHtml(g.name) + '\')"><i class="fas fa-trash"></i></button>' +
        '</div>';
    }
    c.innerHTML = html;
}

// ============================================================
// СОЗДАНИЕ ГРУППЫ
// ============================================================
export async function addGroup() {
    const n = document.getElementById('newGroupName') ? document.getElementById('newGroupName').value.trim() : '';

    if (!n) {
        showToast('Введите название группы', 'error');
        return;
    }

    const btn = document.getElementById('adminAddGroupBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Создание...';
    }

    try {
        const result = await apiCall('addGroup', 'POST', {
            name: n,
            user_id: state.currentUser ? state.currentUser.id : 0,
            user_login: state.currentUser ? state.currentUser.login : ''
        });

        if (result) {
            showToast('✅ Группа "' + n + '" создана', 'success');
            closeModal('addGroupModal');

            const newGroupName = document.getElementById('newGroupName');
            if (newGroupName) newGroupName.value = '';

            await loadGroups();
            await renderAdminGroups();

            if (typeof window.populateSelects === 'function') await window.populateSelects();
        } else {
            showToast('❌ Ошибка при создании группы', 'error');
        }
    } catch (e) {
        console.error('addGroup error:', e);
        showToast('❌ Ошибка при создании', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Создать';
        }
    }
}

// ============================================================
// УДАЛЕНИЕ ГРУППЫ
// ============================================================
export async function delGroup(id, name) {
    const groupName = name || 'эту группу';

    if (!confirm('Удалить группу "' + groupName + '"? Студенты останутся без группы.')) return;

    const result = await apiCall('deleteGroup', 'POST', {
        group_id: id,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    if (result) {
        showToast('✅ Группа удалена', 'success');
        await loadGroups();
        await renderAdminGroups();
        if (typeof window.populateSelects === 'function') await window.populateSelects();
    } else {
        showToast('❌ Ошибка при удалении группы', 'error');
    }
}

// ============================================================
// ЗАГРУЗКА ГРУПП В STATE
// ============================================================
export async function loadGroups() {
    const d = await apiCall('getGroups');
    if (d) {
        state.groups = d;
        return d;
    }
    return [];
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ МОДУЛЯ ГРУПП (модалки и кнопки)
// ============================================================
let groupsInitDone = false;

export function initGroupsModule() {
    if (groupsInitDone) return;
    groupsInitDone = true;

    // Кнопка "Создать группу" — открывает модалку
    const showAddGroupModal = document.getElementById('showAddGroupModal');
    if (showAddGroupModal) {
        const newBtn = showAddGroupModal.cloneNode(true);
        showAddGroupModal.parentNode.replaceChild(newBtn, showAddGroupModal);
        newBtn.addEventListener('click', function() {
            showModal('addGroupModal');
        });
    } else {
        console.warn('⚠️ Кнопка showAddGroupModal не найдена');
    }

    // Кнопка "Создать" внутри модалки — создаёт группу
    const adminAddGroupBtn = document.getElementById('adminAddGroupBtn');
    if (adminAddGroupBtn) {
        const newBtn = adminAddGroupBtn.cloneNode(true);
        adminAddGroupBtn.parentNode.replaceChild(newBtn, adminAddGroupBtn);
        newBtn.addEventListener('click', addGroup);
    } else {
        console.warn('⚠️ Кнопка adminAddGroupBtn не найдена');
    }
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.renderAdminGroups = renderAdminGroups;
window.addGroup = addGroup;
window.delGroup = delGroup;
window.loadGroups = loadGroups;
window.initGroupsModule = initGroupsModule;