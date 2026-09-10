// assets/js/modules/schedule-editor.js — редактор расписания (админ)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast } from '../core/ui.js';

// ============================================================
// СПИСОК ГРУПП (карточки)
// ============================================================
export async function renderScheduleEditor() {
    const c = document.getElementById('groupCardsContainer');
    if (!c) return;

    const gl = await apiCall('getGroups');
    if (!gl || gl.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-layer-group"></i><p>Нет групп</p></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < gl.length; i++) {
        const g = gl[i];
        html += '<div class="group-card ' + (state.selectedScheduleGroup === g.name ? 'active' : '') + '" onclick="selGroup(\'' + g.name + '\')">' +
            '<div class="group-card-icon"><i class="fas fa-layer-group"></i></div>' +
            '<div class="group-card-name">' + escapeHtml(g.name) + '</div>' +
        '</div>';
    }
    c.innerHTML = html;
}

// ============================================================
// ВЫБОР ГРУППЫ
// ============================================================
export async function selGroup(name) {
    state.selectedScheduleGroup = name;
    state.selectedScheduleDay = 0;

    await renderScheduleEditor();

    const scheduleEditorCard = document.getElementById('scheduleEditorCard');
    if (scheduleEditorCard) scheduleEditorCard.style.display = 'block';

    const selectedGroupName = document.getElementById('selectedGroupName');
    if (selectedGroupName) selectedGroupName.textContent = name;

    renderDayTabs();
    await renderPairs();
}

// ============================================================
// ДНИ НЕДЕЛИ
// ============================================================
export function renderDayTabs() {
    const c = document.getElementById('dayTabs');
    if (!c) return;

    let html = '';
    for (let i = 0; i < state.dayNames.length; i++) {
        html += '<button class="day-tab ' + (state.selectedScheduleDay === i ? 'active' : '') + '" onclick="selDay(' + i + ')">' + state.dayNames[i] + '</button>';
    }
    c.innerHTML = html;
}

export async function selDay(day) {
    state.selectedScheduleDay = day;
    renderDayTabs();
    await renderPairs();
}

// ============================================================
// СПИСОК ПАР
// ============================================================
export async function renderPairs() {
    const c = document.getElementById('adminPairsList');
    if (!c) return;

    let go = null;
    for (let i = 0; i < state.groups.length; i++) {
        if (state.groups[i].name === state.selectedScheduleGroup) { go = state.groups[i]; break; }
    }
    if (!go) return;

    const sch = await apiCall('getSchedule', 'GET', { group_name: state.selectedScheduleGroup, day: state.selectedScheduleDay });
    if (!sch || sch.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>Нет пар</p></div>';
        return;
    }

    let html = '';
    for (let pi = 0; pi < sch.length; pi++) {
        const p = sch[pi];
        html += '<div class="pair-edit-item" data-pair-id="' + p.pair_id + '">' +
            '<input type="text" class="pt" value="' + (p.time || '') + '" placeholder="Время" style="width:120px">' +
            '<input type="text" class="pn" value="' + (p.name || '') + '" placeholder="Название" style="flex:2">' +
            '<input type="text" class="ptc" value="' + (p.teacher || '') + '" placeholder="Преподаватель" style="flex:1.5">' +
            '<input type="text" class="pr" value="' + (p.room || '') + '" placeholder="Аудитория" style="width:100px">' +
            '<input type="number" class="prw" value="' + (p.reward || 50) + '" style="width:80px">' +
            '<input type="number" class="prwe" value="' + (p.reward_exp || 25) + '" style="width:80px">' +
            '<button class="admin-edit-btn" onclick="savePair(\'' + p.pair_id + '\')"><i class="fas fa-save"></i></button>' +
            '<button class="admin-delete-btn" onclick="delPair(\'' + p.pair_id + '\')"><i class="fas fa-trash"></i></button>' +
        '</div>';
    }
    c.innerHTML = html;
}

// ============================================================
// СОХРАНЕНИЕ ПАРЫ
// ============================================================
export async function savePair(pid) {
    const d = document.querySelector('.pair-edit-item[data-pair-id="' + pid + '"]');
    if (!d) return;

    await apiCall('updateSchedulePair', 'POST', {
        pair_id: pid,
        time: d.querySelector('.pt').value,
        name: d.querySelector('.pn').value,
        teacher: d.querySelector('.ptc').value,
        room: d.querySelector('.pr').value,
        reward: parseInt(d.querySelector('.prw').value) || 50,
        reward_exp: parseInt(d.querySelector('.prwe').value) || 25,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    showToast('✅ Пара обновлена', 'success');
    await renderPairs();
}

// ============================================================
// УДАЛЕНИЕ ПАРЫ
// ============================================================
export async function delPair(pid) {
    if (!confirm('Удалить пару?')) return;

    await apiCall('deleteSchedulePair', 'POST', {
        pair_id: pid,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    showToast('✅ Пара удалена', 'success');
    await renderPairs();
}

// ============================================================
// ДОБАВЛЕНИЕ ПАРЫ
// ============================================================
export async function addPair() {
    const time = document.getElementById('editPairTime') ? document.getElementById('editPairTime').value.trim() : '';
    const name = document.getElementById('editPairName') ? document.getElementById('editPairName').value.trim() : '';

    if (!time || !name) {
        showToast('Введите время и название', 'error');
        return;
    }

    let go = null;
    for (let i = 0; i < state.groups.length; i++) {
        if (state.groups[i].name === state.selectedScheduleGroup) { go = state.groups[i]; break; }
    }
    if (!go) {
        showToast('Выберите группу', 'error');
        return;
    }

    await apiCall('addSchedulePair', 'POST', {
        day_index: state.selectedScheduleDay,
        group_id: go.id,
        time: time,
        name: name,
        teacher: document.getElementById('editPairTeacher') ? document.getElementById('editPairTeacher').value.trim() || 'Преподаватель' : 'Преподаватель',
        room: document.getElementById('editPairRoom') ? document.getElementById('editPairRoom').value.trim() || '' : '',
        reward: parseInt(document.getElementById('editPairReward') ? document.getElementById('editPairReward').value : 50) || 50,
        reward_exp: parseInt(document.getElementById('editPairRewardExp') ? document.getElementById('editPairRewardExp').value : 25) || 25,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    showToast('✅ Пара добавлена', 'success');

    const editPairName = document.getElementById('editPairName');
    const editPairTeacher = document.getElementById('editPairTeacher');
    const editPairRoom = document.getElementById('editPairRoom');
    const editPairReward = document.getElementById('editPairReward');
    const editPairRewardExp = document.getElementById('editPairRewardExp');
    if (editPairName) editPairName.value = '';
    if (editPairTeacher) editPairTeacher.value = '';
    if (editPairRoom) editPairRoom.value = '';
    if (editPairReward) editPairReward.value = '';
    if (editPairRewardExp) editPairRewardExp.value = '25';

    await renderPairs();
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initScheduleEditor() {
    const adminAddPairBtn = document.getElementById('adminAddPairBtn');
    if (adminAddPairBtn) adminAddPairBtn.addEventListener('click', addPair);
}

// Экспорт в window
window.renderScheduleEditor = renderScheduleEditor;
window.selGroup = selGroup;
window.selDay = selDay;
window.savePair = savePair;
window.delPair = delPair;
window.addPair = addPair;
window.initScheduleEditor = initScheduleEditor;