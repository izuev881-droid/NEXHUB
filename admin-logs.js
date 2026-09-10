// assets/js/modules/admin-logs.js — логи администраторов (основатель)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml, formatDateTime } from '../core/utils.js';
import { showToast } from '../core/ui.js';

// ============================================================
// ЗАГРУЗКА ЛОГОВ
// ============================================================
export async function loadAdminLogs() {
    if (!state.currentUser || state.currentUser.role !== 'founder') return;

    const r = await apiCall('getAdminLogs', 'GET', { founder_id: state.currentUser.id });
    const tbody = document.getElementById('logsTableBody');
    const filterSelect = document.getElementById('logsAdminFilter');

    if (!tbody) return;

    // Заполняем фильтр администраторов
    if (filterSelect && r && r.logs) {
        const adminsSet = {};
        for (let li = 0; li < r.logs.length; li++) adminsSet[r.logs[li].admin_login] = true;
        const admins = Object.keys(adminsSet);
        const currentFilter = filterSelect.value;

        let options = '<option value="">Все администраторы</option>';
        for (let ai = 0; ai < admins.length; ai++) {
            options += '<option value="' + escapeHtml(admins[ai]) + '" ' + (currentFilter === admins[ai] ? 'selected' : '') + '>' + escapeHtml(admins[ai]) + '</option>';
        }
        filterSelect.innerHTML = options;
    }

    const selectedAdmin = filterSelect ? filterSelect.value : '';
    const filteredLogs = (r && r.logs)
        ? (selectedAdmin ? r.logs.filter(function(log) { return log.admin_login === selectedAdmin; }) : r.logs)
        : [];

    if (filteredLogs.length > 0) {
        let html = '';
        for (let li2 = 0; li2 < filteredLogs.length; li2++) {
            const l = filteredLogs[li2];
            html += '<tr>' +
                '<td style="padding:8px">' + formatDateTime(l.created_at) + '</td>' +
                '<td style="padding:8px"><span class="admin-login-tag"><i class="fas fa-user-shield"></i> ' + escapeHtml(l.admin_login) + '</span></td>' +
                '<td style="padding:8px"><span class="action-tag ' + getActionClass(l.action) + '">' + escapeHtml(l.action) + '</span></td>' +
                '<td style="padding:8px">' + escapeHtml(l.details || '—') + '</td>' +
                '<td style="padding:8px"><span class="ip-tag"><i class="fas fa-globe"></i> ' + (l.ip_address || '—') + '</span></td>' +
            '</tr>';
        }
        tbody.innerHTML = html;
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-logs">Нет записей в логах</td></tr>';
    }
}

// ============================================================
// КЛАСС ДЕЙСТВИЯ
// ============================================================
export function getActionClass(action) {
    if (action.indexOf('Вход') !== -1 || action.indexOf('Выход') !== -1) return 'action-auth';
    if (action.indexOf('Создание') !== -1 || action.indexOf('Добавление') !== -1) return 'action-create';
    if (action.indexOf('Удаление') !== -1) return 'action-delete';
    if (action.indexOf('Изменение') !== -1 || action.indexOf('Смена') !== -1 || action.indexOf('Редактирование') !== -1) return 'action-edit';
    if (action.indexOf('Блокировка') !== -1) return 'action-lockdown';
    if (action.indexOf('Загрузка') !== -1) return 'action-upload';
    return 'action-default';
}

// ============================================================
// ОЧИСТКА ЛОГОВ
// ============================================================
export async function clearAdminLogs() {
    if (!state.currentUser || state.currentUser.role !== 'founder') {
        showToast('Доступ запрещен', 'error');
        return;
    }
    if (!confirm('⚠️ ВНИМАНИЕ! Это действие безвозвратно удалит ВСЕ логи действий администраторов. Вы уверены?')) return;

    const r = await apiCall('clearAdminLogs', 'POST', {
        founder_id: state.currentUser.id,
        founder_login: state.currentUser.login
    });

    if (r && r.cleared) {
        showToast('✅ Все логи администраторов очищены', 'success');
        await loadAdminLogs();
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initAdminLogs() {
    const lf = document.getElementById('logsAdminFilter');
    if (lf) lf.addEventListener('change', function() { loadAdminLogs(); });

    const rb = document.getElementById('refreshLogsBtn');
    if (rb) rb.addEventListener('click', function() { loadAdminLogs(); });

    const clb = document.getElementById('clearAdminLogsBtn');
    if (clb) clb.addEventListener('click', clearAdminLogs);
}

// Экспорт в window
window.loadAdminLogs = loadAdminLogs;
window.clearAdminLogs = clearAdminLogs;
window.initAdminLogs = initAdminLogs;