// assets/js/modules/schedule.js — расписание студента

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';

// ============================================================
// РЕНДЕР РАСПИСАНИЯ
// ============================================================
export async function renderSchedule() {
    const c = document.getElementById('scheduleList');
    if (!c) return;

    if (!state.currentStudent || !state.currentStudent.group_name) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>У вас не назначена группа</p></div>';
        return;
    }

    const s = await apiCall('getSchedule', 'GET', {
        group_name: state.currentStudent.group_name,
        day: state.currentDay
    });

    if (!s || s.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>Нет пар</p></div>';
        return;
    }

    const a = await apiCall('getStudentAttendance', 'GET', { student_id: state.currentStudent.id });
    const ap = {};
    if (a && a.length) {
        for (let i = 0; i < a.length; i++) ap[a[i].pair_id] = true;
    }

    let html = '';
    for (let j = 0; j < s.length; j++) {
        const p = s[j];
        html += '<div class="pair-card-new ' + (ap[p.pair_id] ? 'attended' : '') + '">' +
            '<div class="pair-header-new">' +
                '<span class="pair-time"><i class="far fa-clock"></i> ' + escapeHtml(p.time || '—') + '</span>' +
                '<span class="pair-reward">+' + (p.reward || 50) + ' 💎 +' + (p.reward_exp || 25) + ' ⭐</span>' +
            '</div>' +
            '<div class="pair-name">' + escapeHtml(p.name || 'Без названия') + '</div>' +
            '<div class="pair-teacher"><i class="fas fa-chalkboard-teacher"></i> ' + escapeHtml(p.teacher || 'Не указан') + '</div>' +
            (p.room ? '<div class="pair-room"><i class="fas fa-door-open"></i> ' + escapeHtml(p.room) + '</div>' : '') +
            '<div class="attended-badge-new"><i class="fas fa-' + (ap[p.pair_id] ? 'check-circle' : 'clock') + '"></i> ' + (ap[p.pair_id] ? 'Отмечено' : 'Ожидает отметки') + '</div>' +
        '</div>';
    }
    c.innerHTML = html;

    // Обновляем статистику
    if (typeof window.updateStudentStats === 'function') await window.updateStudentStats();
}

// ============================================================
// ПЕРЕКЛЮЧАТЕЛЬ ДНЕЙ НЕДЕЛИ
// ============================================================
export function initScheduleTabs() {
    const ws = document.getElementById('weekSelector');
    if (!ws) return;

    ws.innerHTML = '';
    for (let i = 0; i < state.dayNamesFull.length; i++) {
        const b = document.createElement('button');
        b.className = 'day-btn ' + (state.currentDay === i ? 'active' : '');
        b.textContent = state.dayNamesFull[i];
        b.onclick = (function(dayIndex) {
            return function() {
                state.currentDay = dayIndex;
                const btns = document.querySelectorAll('.day-btn');
                for (let d = 0; d < btns.length; d++) btns[d].classList.remove('active');
                this.classList.add('active');
                renderSchedule();
            };
        })(i);
        ws.appendChild(b);
    }
}

// Экспорт в window
window.renderSchedule = renderSchedule;
window.initScheduleTabs = initScheduleTabs;