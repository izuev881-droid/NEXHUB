// assets/js/modules/attendance.js — посещаемость (админ)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast } from '../core/ui.js';

// ============================================================
// РЕНДЕР СТРАНИЦЫ ПОСЕЩАЕМОСТИ
// ============================================================
export async function renderAttendance() {
    const gidElem = document.getElementById('attendanceGroupSelect');
    const gid = gidElem ? gidElem.value : null;
    const dayElem = document.getElementById('attendanceDaySelect');
    const day = dayElem ? parseInt(dayElem.value || '0') : 0;
    const c = document.getElementById('groupAttendanceEditor');

    if (!c || !gid || gid === 'all') return;

    // Находим группу
    let sg = null;
    for (let i = 0; i < state.groups.length; i++) {
        if (state.groups[i].id == gid) { sg = state.groups[i]; break; }
    }
    if (!sg) return;

    const sch = await apiCall('getSchedule', 'GET', { group_name: sg.name, day: day });
    const sl = await apiCall('getStudents');

    const gs = [];
    if (sl) {
        for (let si = 0; si < sl.length; si++) {
            if (sl[si].group_id == gid) gs.push(sl[si]);
        }
    }

    if (!sch || sch.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>Нет пар</p></div>';
        return;
    }

    if (!gs.length) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Нет студентов</p></div>';
        return;
    }

    // Рисуем пары со списком студентов
    let html = '';
    for (let pi = 0; pi < sch.length; pi++) {
        const p = sch[pi];
        let studentsHtml = '';
        for (let si2 = 0; si2 < gs.length; si2++) {
            const s = gs[si2];
            studentsHtml += '<div class="group-student-item" id="st-' + s.id + '-' + p.pair_id + '" onclick="toggleAtt(\'' + s.id + '\',\'' + p.pair_id + '\',' + (p.reward || 50) + ',' + (p.reward_exp || 25) + ')">' +
                '<span>' + escapeHtml(s.name) + '</span><span>⏳</span>' +
            '</div>';
        }

        html += '<div class="group-pair-block">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:15px;">' +
                '<strong>' + p.time + ' - ' + p.name + ' (' + p.teacher + ') +' + (p.reward || 50) + '💎 +' + (p.reward_exp || 25) + '⭐</strong>' +
                '<button class="btn-small" onclick="markAll(\'' + gid + '\',\'' + p.pair_id + '\',' + (p.reward || 50) + ',' + (p.reward_exp || 25) + ')">Отметить всех</button>' +
            '</div>' +
            '<div class="group-students-list" id="students-' + p.pair_id + '">' + studentsHtml + '</div>' +
        '</div>';
    }
    c.innerHTML = html;

    // Загружаем уже отмеченных студентов
    for (let sIdx = 0; sIdx < gs.length; sIdx++) {
        const student = gs[sIdx];
        const att = await apiCall('getStudentAttendance', 'GET', { student_id: student.id });
        if (att) {
            for (let aIdx = 0; aIdx < att.length; aIdx++) {
                const a = att[aIdx];
                const el = document.getElementById('st-' + student.id + '-' + a.pair_id);
                if (el) {
                    el.classList.add('attended');
                    const spans = el.querySelectorAll('span');
                    if (spans.length > 1) spans[1].textContent = '✅';
                }
            }
        }
    }
}

// ============================================================
// ПЕРЕКЛЮЧЕНИЕ ОТМЕТКИ
// ============================================================
export async function toggleAtt(sid, pid, rc, re) {
    const att = await apiCall('getStudentAttendance', 'GET', { student_id: sid });
    let ex = false;
    if (att) {
        for (let i = 0; i < att.length; i++) {
            if (att[i].pair_id === pid) { ex = true; break; }
        }
    }

    const r = await apiCall('toggleAttendance', 'POST', {
        student_id: sid,
        pair_id: pid,
        reward_crystals: rc,
        reward_exp: re,
        action: ex ? 'remove' : 'add',
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    if (r) {
        if (ex) showToast('❌ Отметка снята', 'warning');
        else showToast('✅ Посещение отмечено +' + rc + '💎 +' + re + '⭐', 'success');
        await renderAttendance();
    } else {
        showToast('❌ Ошибка при отметке посещения', 'error');
    }
}

// ============================================================
// ОТМЕТИТЬ ВСЕХ
// ============================================================
export async function markAll(gid, pid, rc, re) {
    if (!confirm('Отметить всех студентов?')) return;

    const sl = await apiCall('getStudents');
    const gs = [];
    if (sl) {
        for (let i = 0; i < sl.length; i++) {
            if (sl[i].group_id == gid) gs.push(sl[i]);
        }
    }

    for (let si = 0; si < gs.length; si++) {
        const att = await apiCall('getStudentAttendance', 'GET', { student_id: gs[si].id });
        let found = false;
        if (att) {
            for (let ai = 0; ai < att.length; ai++) {
                if (att[ai].pair_id === pid) { found = true; break; }
            }
        }
        if (!found) {
            await apiCall('toggleAttendance', 'POST', {
                student_id: gs[si].id,
                pair_id: pid,
                reward_crystals: rc,
                reward_exp: re,
                action: 'add',
                user_id: state.currentUser ? state.currentUser.id : 0,
                user_login: state.currentUser ? state.currentUser.login : ''
            });
        }
    }
    await renderAttendance();
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initAttendance() {
    const loadBtn = document.getElementById('loadGroupScheduleBtn');
    if (loadBtn) loadBtn.addEventListener('click', renderAttendance);
}

// Экспорт в window
window.renderAttendance = renderAttendance;
window.toggleAtt = toggleAtt;
window.markAll = markAll;
window.initAttendance = initAttendance;