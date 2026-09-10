// assets/js/modules/notifications.js — система уведомлений

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml, formatTimeOnly } from '../core/utils.js';
import { showToast } from '../core/ui.js';

// ============================================================
// ОПРЕДЕЛЕНИЕ ID ДЛЯ УВЕДОМЛЕНИЙ
// ============================================================
// Студент → положительный student_id
// Админ / основатель → отрицательный ID (совпадает с participant_id в чатах)
function getCurrentNotificationUserId() {
    if (state.founderToggleMode && state.currentStudent && state.currentStudent.id) {
        return state.currentStudent.id;
    }
    if (state.currentStudent && state.currentStudent.id) {
        return state.currentStudent.id;
    }
    if (state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'founder')) {
        return -state.currentUser.id;
    }
    return null;
}

function canLoadNotifications() {
    if (state.currentStudent) return true;
    if (state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'founder')) return true;
    return false;
}

// ============================================================
// ЗАГРУЗКА УВЕДОМЛЕНИЙ
// ============================================================
export async function loadNotifications() {
    if (!canLoadNotifications()) return;

    const userId = getCurrentNotificationUserId();
    if (!userId) return;

    try {
        const response = await fetch(state.API_URL + '?endpoint=getNotifications&student_id=' + userId + '&limit=20&t=' + Date.now());
        const data = await response.json();

        if (data.success && data.data) {
            state.notifications = data.data;

            if (state.notifications.length > 0) {
                let maxId = 0;
                for (let i = 0; i < state.notifications.length; i++) {
                    if (state.notifications[i].id > maxId) maxId = state.notifications[i].id;
                }
                state.lastNotificationId = maxId;
            }

            let unreadCount = 0;
            for (let j = 0; j < state.notifications.length; j++) {
                if (!state.notifications[j].is_read) unreadCount++;
            }

            const badge = document.getElementById('notificationsBadge');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }

            if (state.notificationsModalOpen) renderNotificationsModal();
        }
    } catch (e) {
        console.error('Load notifications error:', e);
    }
}

export async function getUnreadNotificationsCount() {
    if (!canLoadNotifications()) return 0;

    const userId = getCurrentNotificationUserId();
    if (!userId) return 0;

    try {
        const response = await fetch(state.API_URL + '?endpoint=getUnreadNotificationsCount&student_id=' + userId + '&t=' + Date.now());
        const data = await response.json();
        if (data.success && data.data) return data.data.unread_count;
        return 0;
    } catch (e) {
        return 0;
    }
}

export async function updateNotificationsBadge() {
    const count = await getUnreadNotificationsCount();
    const badge = document.getElementById('notificationsBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// ============================================================
// ДЕЙСТВИЯ
// ============================================================
export async function markNotificationRead(notificationId) {
    const userId = getCurrentNotificationUserId();
    if (!userId) return;

    try {
        await apiCall('markNotificationRead', 'POST', {
            student_id: userId,
            notification_id: notificationId
        });
        await updateNotificationsBadge();
    } catch (e) {
        console.error('Mark read error:', e);
    }
}

export async function markAllNotificationsRead() {
    const userId = getCurrentNotificationUserId();
    if (!userId) return;

    try {
        await apiCall('markAllNotificationsRead', 'POST', { student_id: userId });
        await loadNotifications();
        await updateNotificationsBadge();
        if (state.notificationsModalOpen) renderNotificationsModal();
        showToast('Все уведомления отмечены как прочитанные', 'info');
    } catch (e) {
        console.error('Mark all read error:', e);
    }
}

export async function deleteNotification(notificationId) {
    const userId = getCurrentNotificationUserId();
    if (!userId) return;

    try {
        await apiCall('deleteNotification', 'POST', {
            student_id: userId,
            notification_id: notificationId
        });
        await updateNotificationsBadge();
    } catch (e) {
        console.error('Delete notification error:', e);
    }
}

export async function clearReadNotifications() {
    const userId = getCurrentNotificationUserId();
    if (!userId) return;

    try {
        await apiCall('clearReadNotifications', 'POST', { student_id: userId });
        await loadNotifications();
        await updateNotificationsBadge();
        if (state.notificationsModalOpen) renderNotificationsModal();
        showToast('✅ Прочитанные уведомления очищены', 'success');
    } catch (e) {
        console.error('Clear read notifications error:', e);
    }
}

export async function clearAllNotifications() {
    const userId = getCurrentNotificationUserId();
    if (!userId) return;

    try {
        const response = await fetch(state.API_URL + '?endpoint=getNotifications&student_id=' + userId + '&limit=500&t=' + Date.now());
        const data = await response.json();

        if (data.success && data.data) {
            for (let i = 0; i < data.data.length; i++) {
                await apiCall('deleteNotification', 'POST', {
                    student_id: userId,
                    notification_id: data.data[i].id
                });
            }
        }

        await loadNotifications();
        await updateNotificationsBadge();
        if (state.notificationsModalOpen) renderNotificationsModal();
        showToast('✅ Все уведомления удалены', 'success');
    } catch (e) {
        console.error('Clear all notifications error:', e);
    }
}

// ============================================================
// РЕНДЕР МОДАЛКИ
// ============================================================
export function renderNotificationsModal() {
    let existingModal = document.getElementById('notificationsModal');
    if (existingModal) existingModal.remove();

    const existingOverlay = document.querySelector('.notifications-overlay');
    if (existingOverlay) existingOverlay.remove();

    if (!state.notificationsModalOpen) return;

    const modal = document.createElement('div');
    modal.id = 'notificationsModal';
    modal.className = 'notifications-modal';

    let unreadCount = 0;
    let readCount = 0;
    for (let i = 0; i < state.notifications.length; i++) {
        if (!state.notifications[i].is_read) unreadCount++;
        else readCount++;
    }

    let notificationsHtml = '';
    if (state.notifications.length === 0) {
        notificationsHtml = '<div class="notifications-empty">' +
            '<i class="fas fa-bell-slash"></i>' +
            '<p>У вас нет уведомлений</p>' +
        '</div>';
    } else {
        for (let j = 0; j < state.notifications.length; j++) {
            const notif = state.notifications[j];
            notificationsHtml += '<div class="notification-item ' + (!notif.is_read ? 'unread' : '') + '" data-id="' + notif.id + '" data-link="' + (notif.link || '') + '">' +
                '<div class="notification-icon" style="color: ' + notif.color + '; background: ' + notif.color + '15;">' +
                    '<i class="fas fa-' + notif.icon + '"></i>' +
                '</div>' +
                '<div class="notification-content">' +
                    '<div class="notification-title">' + escapeHtml(notif.title) + '</div>' +
                    '<div class="notification-message">' + escapeHtml(notif.message) + '</div>' +
                    '<div class="notification-time">' + (notif.time_ago || formatTimeOnly(notif.created_at)) + '</div>' +
                '</div>' +
                '<div class="notification-actions">' +
                    (!notif.is_read ? '<button class="notification-mark-read" data-id="' + notif.id + '" title="Отметить как прочитанное"><i class="fas fa-check"></i></button>' : '') +
                    '<button class="notification-delete" data-id="' + notif.id + '" title="Удалить"><i class="fas fa-times"></i></button>' +
                '</div>' +
            '</div>';
        }
    }

    modal.innerHTML = '<div class="notifications-header">' +
            '<h3><i class="fas fa-bell"></i> Уведомления ' + (unreadCount > 0 ? '<span style="background:#ef4444; color:white; padding:2px 8px; border-radius:20px; font-size:11px;">' + unreadCount + '</span>' : '') + '</h3>' +
            '<div class="notifications-actions">' +
                (unreadCount > 0 ? '<button class="mark-all-read" id="markAllReadBtn"><i class="fas fa-check-double"></i> Все прочитаны</button>' : '') +
                (readCount > 0 ? '<button class="clear-read-btn" id="clearReadBtn"><i class="fas fa-trash"></i> Очистить прочитанные</button>' : '') +
            '</div>' +
        '</div>' +
        '<div class="notifications-list" id="notificationsList">' +
            notificationsHtml +
        '</div>' +
        (state.notifications.length > 0 ? '<div class="notifications-footer"><button class="clear-all-btn" id="clearAllBtn"><i class="fas fa-trash-alt"></i> Очистить все уведомления</button></div>' : '');

    document.body.appendChild(modal);

    const overlay = document.createElement('div');
    overlay.className = 'notifications-overlay';
    document.body.insertBefore(overlay, modal);

    overlay.addEventListener('click', function(e) {
        e.stopPropagation();
        closeNotificationsModal();
    });

    const escapeHandler = function(e) {
        if (e.key === 'Escape') {
            closeNotificationsModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    modal.style.zIndex = '1000';
    modal.addEventListener('click', function(e) { e.stopPropagation(); });

    const markAllBtn = document.getElementById('markAllReadBtn');
    if (markAllBtn) markAllBtn.addEventListener('click', async function(e) { e.stopPropagation(); await markAllNotificationsRead(); });

    const clearReadBtn = document.getElementById('clearReadBtn');
    if (clearReadBtn) clearReadBtn.addEventListener('click', async function(e) { e.stopPropagation(); await clearReadNotifications(); });

    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', async function(e) {
        e.stopPropagation();
        if (confirm('Удалить все уведомления?')) await clearAllNotifications();
    });

    const notificationItems = document.querySelectorAll('.notification-item');
    for (let k = 0; k < notificationItems.length; k++) {
        const item = notificationItems[k];
        item.addEventListener('click', async function(e) {
            if (state.processingNotification) return;
            if (e.target.closest('.notification-mark-read')) return;
            if (e.target.closest('.notification-delete')) return;

            state.processingNotification = true;

            const id = parseInt(this.dataset.id);
            const link = this.dataset.link;
            let notif = null;
            for (let n = 0; n < state.notifications.length; n++) {
                if (state.notifications[n].id === id) {
                    notif = state.notifications[n];
                    break;
                }
            }

            if (notif && !notif.is_read) await markNotificationRead(id);

            if (link && link.startsWith('#/')) {
                const page = link.substring(2);
                if (typeof window.switchPage === 'function') window.switchPage(page);
            }
            closeNotificationsModal();
            document.removeEventListener('keydown', escapeHandler);

            setTimeout(function() { state.processingNotification = false; }, 500);
        });
    }

    const markReadBtns = document.querySelectorAll('.notification-mark-read');
    for (let m = 0; m < markReadBtns.length; m++) {
        markReadBtns[m].addEventListener('click', async function(e) {
            e.stopPropagation();
            const id = parseInt(this.dataset.id);
            await markNotificationRead(id);
            await loadNotifications();
            renderNotificationsModal();
        });
    }

    const deleteBtns = document.querySelectorAll('.notification-delete');
    for (let d = 0; d < deleteBtns.length; d++) {
        deleteBtns[d].addEventListener('click', async function(e) {
            e.stopPropagation();
            const id = parseInt(this.dataset.id);
            await deleteNotification(id);
            await loadNotifications();
            renderNotificationsModal();
        });
    }
}

export function openNotificationsModal() {
    if (state.notificationsModalOpen) {
        closeNotificationsModal();
        return;
    }
    state.notificationsModalOpen = true;
    loadNotifications().then(function() {
        renderNotificationsModal();
    });
}

export function closeNotificationsModal() {
    state.notificationsModalOpen = false;

    const modal = document.getElementById('notificationsModal');
    if (modal) modal.remove();

    const overlay = document.querySelector('.notifications-overlay');
    if (overlay) overlay.remove();
}

// ============================================================
// POLLING (с защитой)
// ============================================================
let notificationsPollingActive = false;

export async function startNotificationsPolling() {
    if (notificationsPollingActive) return;
    notificationsPollingActive = true;

    async function poll() {
        if (!canLoadNotifications()) {
            state.notificationsPollingInterval = setTimeout(poll, 30000);
            return;
        }

        const userId = getCurrentNotificationUserId();
        if (!userId) {
            state.notificationsPollingInterval = setTimeout(poll, 30000);
            return;
        }

        try {
            const countResponse = await fetch(state.API_URL + '?endpoint=getUnreadNotificationsCount&student_id=' + userId + '&t=' + Date.now());
            const countData = await countResponse.json();

            if (countData.success && countData.data) {
                const newCount = countData.data.unread_count;
                const badgeElement = document.getElementById('notificationsBadge');
                let oldCount = 0;
                if (badgeElement) oldCount = parseInt(badgeElement.textContent || '0');

                if (badgeElement) {
                    if (newCount > 0) {
                        badgeElement.textContent = newCount > 99 ? '99+' : newCount;
                        badgeElement.style.display = 'flex';
                    } else {
                        badgeElement.style.display = 'none';
                    }
                }

                if (newCount > oldCount || state.notificationsModalOpen) {
                    await loadNotifications();
                }

                if (newCount > oldCount && newCount > 0) {
                    let message = '';
                    if (newCount === 1) message = '🔔 У вас 1 новое уведомление';
                    else if (newCount < 5) message = '🔔 У вас ' + newCount + ' новых уведомления';
                    else message = '🔔 У вас ' + newCount + ' новых уведомлений';
                    showToast(message, 'info');
                }
            }
        } catch (e) {
            console.error('Notifications polling error:', e);
        }

        state.notificationsPollingInterval = setTimeout(poll, 30000);
    }

    poll();
}

export function stopNotificationsPolling() {
    if (state.notificationsPollingInterval) {
        clearTimeout(state.notificationsPollingInterval);
        state.notificationsPollingInterval = null;
    }
    notificationsPollingActive = false;
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
let notificationsInitialized = false;

export function initNotifications() {
    if (notificationsInitialized) return;
    notificationsInitialized = true;

    const notificationsBtn = document.getElementById('notificationsBtn');
    if (notificationsBtn) {
        const newBtn = notificationsBtn.cloneNode(true);
        notificationsBtn.parentNode.replaceChild(newBtn, notificationsBtn);
        newBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openNotificationsModal();
        });
    }
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.loadNotifications = loadNotifications;
window.updateNotificationsBadge = updateNotificationsBadge;
window.openNotificationsModal = openNotificationsModal;
window.closeNotificationsModal = closeNotificationsModal;
window.initNotifications = initNotifications;
window.startNotificationsPolling = startNotificationsPolling;
window.stopNotificationsPolling = stopNotificationsPolling;