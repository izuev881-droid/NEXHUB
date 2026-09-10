// assets/js/modules/titles.js — титулы (студент): магазин, покупка, активация

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast } from '../core/ui.js';

// Локальный хелпер
function getCurrentStudentId() {
    if (state.founderToggleMode && state.currentStudent && state.currentStudent.id) return state.currentStudent.id;
    if (state.currentStudent && state.currentStudent.id) return state.currentStudent.id;
    if (state.currentUser && state.currentUser.role === 'founder' && state.currentUser.student_id) return state.currentUser.student_id;
    return null;
}

// ============================================================
// МАГАЗИН ТИТУЛОВ
// ============================================================
export async function renderTitlesShop() {
    const studentId = getCurrentStudentId();

    const sc = document.getElementById('titlesShopList');
    if (!sc) return;

    if (!studentId) {
        sc.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Не удалось определить пользователя</p></div>';
        return;
    }

    sc.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Загрузка титулов...</div>';

    try {
        const allTitles = await apiCall('getTitles');
        const studentTitles = await apiCall('getStudentTitles', 'GET', { student_id: studentId });

        if (!allTitles || allTitles.length === 0) {
            sc.innerHTML = '<div class="empty-state"><i class="fas fa-medal"></i><p>Нет доступных титулов</p></div>';
            return;
        }

        const ownedTitles = studentTitles && studentTitles.owned ? studentTitles.owned : [];
        const ownedIds = [];
        for (let ot = 0; ot < ownedTitles.length; ot++) ownedIds.push(ownedTitles[ot].id);
        const activeId = studentTitles ? studentTitles.active_title_id : null;

        let html = '';
        for (let t = 0; t < allTitles.length; t++) {
            const title = allTitles[t];
            const isOwned = ownedIds.indexOf(title.id) !== -1;
            const isActive = title.id === activeId;
            const canPurchase = title.purchasable === 1;
            const textColor = title.text_color || '#ffffff';
            const borderColor = title.color || '#9b4dff';
            const rarityClass = title.rarity || 'common';

            let buttonHtml = '';
            let hintText = '';

            if (!isOwned) {
                if (canPurchase) {
                    buttonHtml = '<button class="buy-btn-new" onclick="event.stopPropagation(); handleTitleClick(' + title.id + ', false, false, true, \'' + escapeHtml(title.name) + '\', ' + title.price + ')">💎 Купить за ' + title.price + '</button>';
                    hintText = '💎 Нажмите для покупки';
                } else {
                    buttonHtml = '<button class="buy-btn-new disabled" disabled>🔒 Недоступен</button>';
                    hintText = '🔒 Этот титул недоступен для покупки';
                }
            } else if (isActive) {
                buttonHtml = '<button class="action-btn" onclick="event.stopPropagation(); handleTitleClick(' + title.id + ', true, true, false, \'' + escapeHtml(title.name) + '\', ' + title.price + ')">🔽 Снять титул</button>';
                hintText = '🔽 Нажмите, чтобы снять титул';
            } else {
                buttonHtml = '<button class="action-btn" onclick="event.stopPropagation(); handleTitleClick(' + title.id + ', true, false, false, \'' + escapeHtml(title.name) + '\', ' + title.price + ')">🔼 Надеть титул</button>';
                hintText = '🔼 Нажмите, чтобы надеть титул';
            }

            html += '<div class="title-card ' + (isOwned ? 'owned' : '') + ' ' + (isActive ? 'active' : '') + '" data-title-id="' + title.id + '" style="border-color: ' + borderColor + ';">' +
                '<div class="title-icon" style="font-size: 52px;">' + (title.icon || '⭐') + '</div>' +
                '<div class="title-name" style="color: ' + textColor + '; text-shadow: 0 0 8px ' + borderColor + ';">' + escapeHtml(title.name) + '</div>' +
                (title.description ? '<div class="title-description">' + escapeHtml(title.description) + '</div>' : '') +
                '<div class="title-rarity ' + rarityClass + '" style="border-color: ' + borderColor + ';">' + rarityClass.toUpperCase() + '</div>' +
                (!isOwned && canPurchase ? '<div class="title-price"><i class="fas fa-gem"></i> ' + title.price + '</div>' : '') +
                buttonHtml +
                '<div class="title-hint">' + hintText + '</div>' +
            '</div>';
        }
        sc.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки титулов:', error);
        sc.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки титулов</p></div>';
    }
}

// ============================================================
// ОБРАБОТКА КЛИКА ПО ТИТУЛУ
// ============================================================
export async function handleTitleClick(titleId, isOwned, isActive, canPurchase, titleName, titlePrice) {
    const studentId = getCurrentStudentId();

    if (!studentId) {
        showToast('❌ Не удалось определить студента. Возможно, вы не авторизованы.', 'error');
        return;
    }

    // ПОКУПКА
    if (!isOwned) {
        if (!canPurchase) {
            showToast('❌ Этот титул недоступен для покупки', 'warning');
            return;
        }

        if (!confirm('Купить титул "' + titleName + '" за ' + titlePrice + ' 💎?')) return;

        try {
            const result = await apiCall('buyTitle', 'POST', {
                student_id: studentId,
                title_id: titleId,
                user_id: state.currentUser ? state.currentUser.id : 0,
                user_login: state.currentUser ? state.currentUser.login : ''
            });

            if (result && result.bought) {
                showToast('✅ Куплен титул: ' + titleName, 'success');
                if (typeof window.updateStudentStats === 'function') await window.updateStudentStats();
                await renderTitlesShop();
                if (typeof window.updateTopProfileTitle === 'function') await window.updateTopProfileTitle();
                await refreshTitleInChat();
            } else {
                showToast('❌ Ошибка при покупке титула', 'error');
            }
        } catch (e) {
            console.error('Buy title error:', e);
            showToast('❌ Ошибка при покупке титула', 'error');
        }
        return;
    }

    // СНЯТИЕ
    if (isActive) {
        const result = await apiCall('deactivateTitle', 'POST', { student_id: studentId });
        if (result) {
            showToast('🔒 Титул снят', 'info');
            await renderTitlesShop();
            if (typeof window.updateTopProfileTitle === 'function') await window.updateTopProfileTitle();
            await refreshTitleInChat();
        }
        return;
    }

    // НАДЕВАНИЕ
    if (isOwned && !isActive) {
        const result = await apiCall('activateTitle', 'POST', { student_id: studentId, title_id: titleId });
        if (result) {
            showToast('✅ Титул надет!', 'success');
            await renderTitlesShop();
            if (typeof window.updateTopProfileTitle === 'function') await window.updateTopProfileTitle();
            await refreshTitleInChat();
        }
        return;
    }
}

// ============================================================
// ОБНОВЛЕНИЕ ТИТУЛА В ЧАТАХ
// ============================================================
export async function refreshTitleInChat() {
    const studentId = getCurrentStudentId();
    if (!studentId) return;

    delete state.userTitleCache[studentId];
    delete state.userTitleColorCache[studentId];

    try {
        await fetch(state.API_URL + '?endpoint=notifyTitleChange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentId })
        });
    } catch (e) { /* ignore */ }

    if (typeof window.renderCommonChat === 'function') await window.renderCommonChat();
    if (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder() && typeof window.renderAdminCommonChat === 'function') {
        await window.renderAdminCommonChat();
    }
}

// ============================================================
// КЭШ ТИТУЛОВ ДЛЯ ЧАТОВ
// ============================================================
export async function getUserTitleForChat(studentId) {
    if (!studentId || studentId === 'admin') return null;
    if (state.userTitleCache[studentId]) return state.userTitleCache[studentId];

    const title = await apiCall('getUserTitleForChat', 'GET', { student_id: studentId });
    if (title) {
        state.userTitleCache[studentId] = title;
        state.userTitleColorCache[studentId] = title.text_color || title.color;
        setTimeout(function() {
            delete state.userTitleCache[studentId];
            delete state.userTitleColorCache[studentId];
        }, 600000);
    }
    return title;
}

export function createTitleBadge(title, isChat) {
    if (isChat === undefined) isChat = false;
    if (!title) return '';

    const isAdmin = title.name === 'Admin';
    const cssClass = isChat ? 'chat-title-badge' : 'title-badge-display';
    const adminClass = isAdmin ? ' admin-title' : '';
    const rarityClass = isAdmin ? '' : ' ' + title.rarity;
    const textColor = title.text_color || '#ffffff';
    const borderColor = title.color || '#9b4dff';

    if (isAdmin) {
        return '<span class="' + cssClass + adminClass + '" style="border:1px solid ' + borderColor + '; color:' + textColor + ';">' + title.icon + ' ' + escapeHtml(title.name) + '</span>';
    }
    return '<span class="' + cssClass + rarityClass + '" style="color:' + textColor + '; background:' + borderColor + '20; border:1px solid ' + borderColor + ';">' + title.icon + ' ' + escapeHtml(title.name) + '</span>';
}

// Экспорт в window
window.renderTitlesShop = renderTitlesShop;
window.handleTitleClick = handleTitleClick;
window.refreshTitleInChat = refreshTitleInChat;
window.getUserTitleForChat = getUserTitleForChat;
window.createTitleBadge = createTitleBadge;