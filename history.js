// assets/js/modules/history.js — история действий (студент)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml, formatTime } from '../core/utils.js';
import { showToast } from '../core/ui.js';

export async function renderHistory() {
    const c = document.getElementById('historyList');
    if (!c || !state.currentStudent) return;

    c.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';

    const h = await apiCall('getStudentHistory', 'GET', { student_id: state.currentStudent.id });
    if (!h || h.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>История пуста</p></div>';
        return;
    }

    const g = {};
    for (let i = 0; i < h.length; i++) {
        const item = h[i];
        const d = item.date || 'Сегодня';
        if (!g[d]) g[d] = [];
        g[d].push(item);
    }

    let html = '<div class="history-timeline">';
    const dates = Object.keys(g);

    for (let di = 0; di < dates.length; di++) {
        const date = dates[di];
        const items = g[date];

        html += '<div class="history-date-group">' +
            '<div class="history-date-header"><i class="fas fa-calendar-day"></i><span>' + date + '</span></div>' +
            '<div class="history-items">';

        for (let j = 0; j < items.length; j++) {
            const item = items[j];
            const action = item.action;
            const details = item.details || '';

            let ih = '', ic = '', bc = '';

            if (action === 'Покупка') {
                ih = '<i class="fas fa-shopping-cart"></i>';
                ic = 'purchase';
                bc = '#10b981';
            } else if (action === 'Посещение') {
                ih = '<i class="fas fa-check-circle"></i>';
                ic = 'attendance';
                bc = '#8b5cf6';
            } else if (action === 'Снятие отметки') {
                ih = '<i class="fas fa-times-circle"></i>';
                ic = 'remove';
                bc = '#ef4444';
            } else if (action === 'Промокод') {
                ih = '<i class="fas fa-ticket-alt"></i>';
                ic = 'promo';
                bc = '#f59e0b';
            } else if (action === 'Промокод (тег)') {
                ih = '<i class="fas fa-medal"></i>';
                ic = 'promo';
                bc = '#8b5cf6';
            } else {
                ih = '<i class="fas fa-info-circle"></i>';
                ic = 'default';
                bc = '#3b82f6';
            }

            const timeDisplay = formatTime(item.time || '');

            html += '<div class="history-item-card ' + ic + '" style="border-left:3px solid ' + bc + '">' +
                '<div class="history-icon ' + ic + '" style="background:' + bc + '15;color:' + bc + '">' + ih + '</div>' +
                '<div class="history-details">' +
                    '<div class="history-action">' + escapeHtml(action) + '</div>' +
                    '<div class="history-description">' + details + '</div>' +
                '</div>' +
                '<div class="history-time"><i class="far fa-clock"></i> <span>' + timeDisplay + '</span></div>' +
            '</div>';
        }

        html += '</div></div>';
    }

    html += '</div>';
    c.innerHTML = html;
}

export async function clearHistory() {
    if (!confirm('🗑️ Вы уверены, что хотите очистить всю историю действий?')) return;

    await apiCall('clearHistory', 'POST', {
        student_id: state.currentStudent.id,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    showToast('✅ История успешно очищена', 'success');
    await renderHistory();
}

// Экспорт в window
window.renderHistory = renderHistory;
window.clearHistory = clearHistory;