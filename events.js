// assets/js/modules/events.js — события (студент)

import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';

export async function renderEvents() {
    const c = document.getElementById('eventsList');
    if (!c) return;

    const e = await apiCall('getEvents');
    if (!e || e.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Нет событий</p></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < e.length; i++) {
        const ev = e[i];
        const eventTime = ev.time ? ev.time.substring(0, 5) : '';
        html += '<div class="event-card">' +
            '<div class="event-date"><i class="fas fa-calendar-day"></i> ' + escapeHtml(ev.date) + ' в ' + escapeHtml(eventTime) + '</div>' +
            '<div class="event-title">' + escapeHtml(ev.title) + '</div>' +
            '<div class="event-location"><i class="fas fa-map-marker-alt"></i> ' + escapeHtml(ev.location || '') + '</div>' +
            '<div class="event-description">' + escapeHtml(ev.description || '') + '</div>' +
        '</div>';
    }
    c.innerHTML = html;
}

window.renderEvents = renderEvents;