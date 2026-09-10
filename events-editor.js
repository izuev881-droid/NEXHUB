// assets/js/modules/events-editor.js — редактор событий (админ)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast } from '../core/ui.js';

// Локальное состояние фильтров
let adminEventsFilter = 'all';
let adminEventsSearchTerm = '';
let adminEventsSearchTimeout = null;

// ============================================================
// РЕНДЕР СПИСКА СОБЫТИЙ
// ============================================================
export async function renderAdminEvents() {
    const container = document.getElementById('adminEventsList');
    if (!container) return;

    container.innerHTML = `
        <div class="admin-shop-loading">
            <div class="loader-spinner"></div>
            <p>Загрузка событий...</p>
        </div>
    `;

    const events = await apiCall('getEvents');
    if (!events || events.length === 0) {
        container.innerHTML = `
            <div class="admin-events-empty">
                <div class="empty-icon"><i class="fas fa-calendar-alt"></i></div>
                <h3>Нет событий</h3>
                <p>Создайте первое событие, чтобы информировать студентов</p>
                <button class="btn-add-first" onclick="document.getElementById('showAddEventModal').click()">
                    <i class="fas fa-plus"></i> Добавить событие
                </button>
            </div>
        `;
        return;
    }

    let filteredEvents = events;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    if (adminEventsFilter === 'upcoming') {
        filteredEvents = filteredEvents.filter(e => new Date(e.date) >= today);
    } else if (adminEventsFilter === 'today') {
        filteredEvents = filteredEvents.filter(e => new Date(e.date).toDateString() === today.toDateString());
    } else if (adminEventsFilter === 'past') {
        filteredEvents = filteredEvents.filter(e => new Date(e.date) < today);
    } else if (adminEventsFilter === 'this-week') {
        filteredEvents = filteredEvents.filter(e => {
            const eventDate = new Date(e.date);
            return eventDate >= today && eventDate <= weekLater;
        });
    }

    if (adminEventsSearchTerm) {
        const term = adminEventsSearchTerm.toLowerCase().trim();
        filteredEvents = filteredEvents.filter(e =>
            e.title.toLowerCase().includes(term) ||
            (e.location || '').toLowerCase().includes(term) ||
            (e.description || '').toLowerCase().includes(term) ||
            e.id.toString().includes(term)
        );
    }

    const totalEvents = events.length;
    const upcomingEvents = events.filter(e => new Date(e.date) >= today).length;
    const todayEvents = events.filter(e => new Date(e.date).toDateString() === today.toDateString()).length;
    const pastEvents = events.filter(e => new Date(e.date) < today).length;
    const thisWeekEvents = events.filter(e => {
        const d = new Date(e.date);
        return d >= today && d <= weekLater;
    }).length;

    let html = `
        <div class="admin-events-topbar">
            <div class="topbar-left">
                <div class="topbar-icon"><i class="fas fa-calendar-alt"></i></div>
                <div class="topbar-info">
                    <h2>Управление событиями</h2>
                    <p>Всего событий: ${totalEvents}</p>
                </div>
            </div>
            <div class="topbar-right">
                <button class="btn-add-event" onclick="document.getElementById('showAddEventModal').click()">
                    <i class="fas fa-plus"></i> Добавить событие
                </button>
            </div>
        </div>

        <div class="admin-events-stats-grid">
            <div class="admin-events-stat-block">
                <div class="stat-icon-box total"><i class="fas fa-calendar"></i></div>
                <div class="stat-content">
                    <div class="stat-label">Всего</div>
                    <div class="stat-number">${totalEvents}</div>
                </div>
            </div>
            <div class="admin-events-stat-block">
                <div class="stat-icon-box upcoming"><i class="fas fa-calendar-plus"></i></div>
                <div class="stat-content">
                    <div class="stat-label">Предстоящие</div>
                    <div class="stat-number">${upcomingEvents}</div>
                </div>
            </div>
            <div class="admin-events-stat-block">
                <div class="stat-icon-box today"><i class="fas fa-calendar-day"></i></div>
                <div class="stat-content">
                    <div class="stat-label">Сегодня</div>
                    <div class="stat-number">${todayEvents}</div>
                </div>
            </div>
            <div class="admin-events-stat-block">
                <div class="stat-icon-box this-week"><i class="fas fa-calendar-week"></i></div>
                <div class="stat-content">
                    <div class="stat-label">На этой неделе</div>
                    <div class="stat-number">${thisWeekEvents}</div>
                </div>
            </div>
            <div class="admin-events-stat-block">
                <div class="stat-icon-box past"><i class="fas fa-calendar-times"></i></div>
                <div class="stat-content">
                    <div class="stat-label">Прошедшие</div>
                    <div class="stat-number">${pastEvents}</div>
                </div>
            </div>
        </div>

        <div class="admin-events-filters">
            <div class="filter-search">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="adminEventsSearchInput" placeholder="Поиск по названию, месту, описанию..." value="${escapeHtml(adminEventsSearchTerm)}">
            </div>
            <div class="filter-group">
                <button class="filter-chip ${adminEventsFilter === 'all' ? 'active' : ''}" data-filter="all">Все</button>
                <button class="filter-chip ${adminEventsFilter === 'upcoming' ? 'active' : ''}" data-filter="upcoming">Предстоящие</button>
                <button class="filter-chip ${adminEventsFilter === 'today' ? 'active' : ''}" data-filter="today">Сегодня</button>
                <button class="filter-chip ${adminEventsFilter === 'this-week' ? 'active' : ''}" data-filter="this-week">Эта неделя</button>
                <button class="filter-chip ${adminEventsFilter === 'past' ? 'active' : ''}" data-filter="past">Прошедшие</button>
            </div>
        </div>
    `;

    if (filteredEvents.length === 0) {
        html += `
            <div class="admin-events-empty" style="margin-top: 20px;">
                <div class="empty-icon"><i class="fas fa-search"></i></div>
                <h3>Ничего не найдено</h3>
                <p>Попробуйте изменить фильтры или поисковый запрос</p>
            </div>
        `;
    } else {
        html += `<div class="admin-events-grid">`;
        for (const event of filteredEvents) {
            const eventDate = new Date(event.date);
            const isPast = eventDate < today;
            const isToday = eventDate.toDateString() === today.toDateString();
            const isThisWeek = eventDate >= today && eventDate <= weekLater;
            const isUpcoming = eventDate >= today && !isToday;

            let statusClass = 'upcoming';
            let statusLabel = 'Предстоит';
            if (isPast) { statusClass = 'past'; statusLabel = 'Прошло'; }
            else if (isToday) { statusClass = 'today'; statusLabel = 'Сегодня'; }
            else if (isThisWeek) { statusClass = 'this-week'; statusLabel = 'На этой неделе'; }

            const eventCardClass = isPast ? 'past-event' : (isToday ? 'today-event' : (isThisWeek ? 'this-week-event' : 'upcoming-event'));
            const timeValue = event.time ? event.time.substring(0, 5) : '';

            html += `
                <div class="admin-event-card ${eventCardClass}" data-event-id="${event.id}">
                    <span class="event-status-badge ${statusClass}">${statusLabel}</span>

                    <div class="event-header">
                        <div class="event-title-area">
                            <input type="text" class="event-title-input" id="admin-event-title-${event.id}" value="${escapeHtml(event.title)}" placeholder="Название события">
                        </div>
                    </div>

                    <div class="event-body">
                        <div class="event-fields">
                            <div class="field-group">
                                <label><i class="fas fa-calendar-day"></i> Дата</label>
                                <input type="date" id="admin-event-date-${event.id}" value="${event.date}">
                            </div>
                            <div class="field-group">
                                <label><i class="fas fa-clock"></i> Время</label>
                                <input type="time" id="admin-event-time-${event.id}" value="${timeValue}">
                            </div>
                            <div class="field-group" style="grid-column: 1 / -1;">
                                <label><i class="fas fa-map-marker-alt"></i> Место</label>
                                <input type="text" id="admin-event-location-${event.id}" value="${escapeHtml(event.location || '')}" placeholder="Место проведения">
                            </div>
                        </div>

                        <textarea class="event-description-input" id="admin-event-description-${event.id}" placeholder="Описание события..." rows="3">${escapeHtml(event.description || '')}</textarea>

                        <div class="event-info">
                            <span class="info-item"><i class="fas fa-id-badge"></i> <span class="info-value">#${event.id}</span></span>
                            <span class="info-item"><i class="fas fa-calendar-alt"></i> <span class="info-value">${event.date}</span></span>
                            ${timeValue ? `<span class="info-item"><i class="fas fa-clock"></i> <span class="info-value">${timeValue}</span></span>` : ''}
                            ${event.location ? `<span class="info-item"><i class="fas fa-map-marker-alt"></i> <span class="info-value">${escapeHtml(event.location)}</span></span>` : ''}
                        </div>

                        <div class="event-actions">
                            <button class="btn-save-event" onclick="updateEventAdmin(${event.id})">
                                <i class="fas fa-save"></i> Сохранить
                            </button>
                            <button class="btn-delete-event" onclick="deleteEventAdmin(${event.id})">
                                <i class="fas fa-trash"></i> Удалить
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
    }

    container.innerHTML = html;

    // Фильтры
    const filterChips = document.querySelectorAll('.admin-events-filters .filter-chip');
    filterChips.forEach(chip => {
        chip.addEventListener('click', function() {
            adminEventsFilter = this.dataset.filter;
            renderAdminEvents();
        });
    });

    // Поиск
    const searchInput = document.getElementById('adminEventsSearchInput');
    if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener('input', function() {
            if (adminEventsSearchTimeout) clearTimeout(adminEventsSearchTimeout);
            const value = this.value;
            adminEventsSearchTimeout = setTimeout(function() {
                adminEventsSearchTerm = value;
                renderAdminEvents();
            }, 500);
        });

        newSearchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                if (adminEventsSearchTimeout) clearTimeout(adminEventsSearchTimeout);
                adminEventsSearchTerm = this.value;
                renderAdminEvents();
            }
        });
    }
}

// ============================================================
// ДОБАВЛЕНИЕ СОБЫТИЯ
// ============================================================
export async function addEvent() {
    const title = document.getElementById('newEventTitle')?.value.trim();
    const date = document.getElementById('newEventDate')?.value;
    const time = document.getElementById('newEventTime')?.value || '';
    const location = document.getElementById('newEventLocation')?.value.trim() || '';
    const description = document.getElementById('newEventDescription')?.value.trim() || '';

    if (!title) { showToast('Введите название события', 'error'); return; }
    if (!date) { showToast('Выберите дату', 'error'); return; }

    const result = await apiCall('addEvent', 'POST', {
        title,
        date,
        time: time.substring(0, 5),
        location,
        description,
        user_id: state.currentUser?.id || 0,
        user_login: state.currentUser?.login || ''
    });

    if (result) {
        showToast('✅ Событие "' + title + '" добавлено', 'success');
        if (typeof window.closeModal === 'function') window.closeModal('addEventModal');

        document.getElementById('newEventTitle').value = '';
        document.getElementById('newEventDate').value = '';
        document.getElementById('newEventTime').value = '';
        document.getElementById('newEventLocation').value = '';
        document.getElementById('newEventDescription').value = '';

        await renderAdminEvents();
        if (typeof window.renderEvents === 'function') await window.renderEvents();
    } else {
        showToast('❌ Ошибка при добавлении события', 'error');
    }
}

// ============================================================
// ОБНОВЛЕНИЕ СОБЫТИЯ
// ============================================================
export async function updateEventAdmin(id) {
    const title = document.getElementById(`admin-event-title-${id}`)?.value.trim();
    const date = document.getElementById(`admin-event-date-${id}`)?.value;
    const time = document.getElementById(`admin-event-time-${id}`)?.value || '';
    const location = document.getElementById(`admin-event-location-${id}`)?.value.trim() || '';
    const description = document.getElementById(`admin-event-description-${id}`)?.value.trim() || '';

    if (!title) { showToast('Введите название события', 'error'); return; }
    if (!date) { showToast('Выберите дату', 'error'); return; }

    const result = await apiCall('updateEvent', 'POST', {
        event_id: id,
        title,
        date,
        time: time.substring(0, 5),
        location,
        description,
        user_id: state.currentUser?.id || 0,
        user_login: state.currentUser?.login || ''
    });

    if (result) {
        showToast('✅ Событие обновлено', 'success');
        await renderAdminEvents();
        if (typeof window.renderEvents === 'function') await window.renderEvents();
    } else {
        showToast('❌ Ошибка при обновлении события', 'error');
    }
}

// ============================================================
// УДАЛЕНИЕ СОБЫТИЯ
// ============================================================
export async function deleteEventAdmin(id) {
    if (!confirm('Удалить это событие? Это действие нельзя отменить.')) return;

    const result = await apiCall('deleteEvent', 'POST', {
        event_id: id,
        user_id: state.currentUser?.id || 0,
        user_login: state.currentUser?.login || ''
    });

    if (result) {
        showToast('✅ Событие удалено', 'success');
        await renderAdminEvents();
        if (typeof window.renderEvents === 'function') await window.renderEvents();
    } else {
        showToast('❌ Ошибка при удалении события', 'error');
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initEventsEditor() {
    const adminAddEventBtn = document.getElementById('adminAddEventBtn');
    if (adminAddEventBtn) adminAddEventBtn.addEventListener('click', addEvent);
}

// Экспорт в window
window.renderAdminEvents = renderAdminEvents;
window.addEvent = addEvent;
window.updateEventAdmin = updateEventAdmin;
window.deleteEventAdmin = deleteEventAdmin;
window.initEventsEditor = initEventsEditor;