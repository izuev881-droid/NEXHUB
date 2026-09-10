// assets/js/modules/leaderboard.js — рейтинг студентов

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';

function podiumItem(s, p, emoji, medal, cls, crown) {
    if (crown === undefined) crown = false;
    return '<div class="podium-item podium-' + p + '">' +
        (crown ? '<div class="podium-crown"><i class="fas fa-crown"></i></div>' : '') +
        '<div class="podium-number">' + p + '</div>' +
        '<div class="podium-avatar">' + emoji + '</div>' +
        '<div class="podium-name">' + escapeHtml(s.name) + '</div>' +
        '<div class="podium-group">' + escapeHtml(s.group_name || '') + '</div>' +
        '<div class="podium-score">🎓 ' + (s.total_earned || 0) + '</div>' +
        '<div class="podium-medal ' + cls + '">' + medal + '</div>' +
    '</div>';
}

export async function renderLeaderboard() {
    const c = document.getElementById('leaderboardContainer');
    if (!c) return;

    const s = await apiCall('getLeaderboard');
    if (!s || s.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>Нет данных</p></div>';
        return;
    }

    const t3 = s.slice(0, 3);
    const rest = s.slice(3);

    let h = '<div class="leaderboard-podium">';
    if (t3[1]) h += podiumItem(t3[1], 2, '🥈', 'Серебро', 'silver');
    if (t3[0]) h += podiumItem(t3[0], 1, '👑', 'Золото', 'gold', true);
    if (t3[2]) h += podiumItem(t3[2], 3, '🥉', 'Бронза', 'bronze');
    h += '</div><div class="leaderboard-rest"><div class="leaderboard-rest-title">Остальные участники</div>';

    for (let i = 0; i < rest.length; i++) {
        const student = rest[i];
        const isCurrent = state.currentStudent && student.id === state.currentStudent.id;
        h += '<div class="leaderboard-item ' + (isCurrent ? 'current-user' : '') + '">' +
            '<div class="leaderboard-rank">#' + (i + 4) + '</div>' +
            '<div class="leaderboard-info">' +
                '<div class="leaderboard-name">' + escapeHtml(student.name) + '</div>' +
                '<div class="leaderboard-group">' + escapeHtml(student.group_name || '') + '</div>' +
            '</div>' +
            '<div class="leaderboard-score">🎓 ' + (student.total_earned || 0) + '</div>' +
        '</div>';
    }
    h += '</div>';
    c.innerHTML = h;
}

export async function renderAdminLeaderboard() {
    const c = document.getElementById('leaderboardAdminContainer');
    if (!c) return;

    const s = await apiCall('getLeaderboard');
    if (!s || s.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>Нет данных</p></div>';
        return;
    }

    const t3 = s.slice(0, 3);
    const rest = s.slice(3);

    let h = '<div class="leaderboard-podium">';
    if (t3[1]) h += podiumItem(t3[1], 2, '🥈', 'Серебро', 'silver');
    if (t3[0]) h += podiumItem(t3[0], 1, '👑', 'Золото', 'gold', true);
    if (t3[2]) h += podiumItem(t3[2], 3, '🥉', 'Бронза', 'bronze');
    h += '</div><div class="leaderboard-rest"><div class="leaderboard-rest-title">Остальные участники</div>';

    for (let i = 0; i < rest.length; i++) {
        const student = rest[i];
        h += '<div class="leaderboard-item">' +
            '<div class="leaderboard-rank">#' + (i + 4) + '</div>' +
            '<div class="leaderboard-info">' +
                '<div class="leaderboard-name">' + escapeHtml(student.name) + '</div>' +
                '<div class="leaderboard-group">' + escapeHtml(student.group_name || '') + '</div>' +
            '</div>' +
            '<div class="leaderboard-score">🎓 ' + (student.total_earned || 0) + '</div>' +
        '</div>';
    }
    h += '</div>';
    c.innerHTML = h;
}

// Экспорт в window
window.renderLeaderboard = renderLeaderboard;
window.renderAdminLeaderboard = renderAdminLeaderboard;