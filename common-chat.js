// assets/js/modules/common-chat.js — общий чат (студент + админ)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml, formatTimeOnly, containsProfanity, formatFileSizeDisplay, getFileIconByName } from '../core/utils.js';
import { showToast } from '../core/ui.js';

// ============================================================
// ФЛАГИ ЗАЩИТЫ ОТ ДУБЛИРОВАНИЯ
// ============================================================
let commonSendInProgress = false;
let adminCommonSendInProgress = false;
let commonPollingActive = false;
let titlePollingActive = false;
let commonChatEnterInitialized = false;
let commonChatButtonsInitialized = false;

// ============================================================
// ХЕЛПЕРЫ
// ============================================================
function getCurrentStudentId() {
    if (state.founderToggleMode && state.currentStudent && state.currentStudent.id) return state.currentStudent.id;
    if (state.currentStudent && state.currentStudent.id) return state.currentStudent.id;
    if (state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'founder')) return -state.currentUser.id;
    return null;
}

export function renderCommonChatMessageText(text) {
    if (!text) return '';

    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    const decodedText = textarea.value;

    const fileMatch = decodedText.match(/\[FILE:(.+?)\|(.+?)\|(\d+)\]/);
    if (fileMatch) {
        const filePath = fileMatch[1];
        const originalName = fileMatch[2];
        const fileSizeBytes = parseInt(fileMatch[3]);
        const fullUrl = filePath.startsWith('http') ? filePath : '/' + filePath;
        const sizeDisplay = formatFileSizeDisplay(fileSizeBytes);
        const icon = getFileIconByName(originalName);
        return '<div class="message-file-container" onclick="downloadFile(\'' + fullUrl + '\', \'' + escapeHtml(originalName) + '\')">' +
                    '<div class="message-file-icon"><i class="fas ' + icon + '"></i></div>' +
                    '<div class="message-file-info">' +
                        '<div class="message-file-name">' + escapeHtml(originalName) + '</div>' +
                        '<div class="message-file-size">' + sizeDisplay + '</div>' +
                    '</div>' +
                    '<div class="message-file-download"><i class="fas fa-download"></i></div>' +
                '</div>';
    }

    const imageMatch = decodedText.match(/\[IMAGE:(.+?)\]/);
    if (imageMatch) {
        const imagePath = imageMatch[1];
        const fullImageUrl = imagePath.startsWith('http') ? imagePath : '/' + imagePath;
        return '<div class="common-message-image-container"><img src="' + fullImageUrl + '?v=' + Date.now() + '" class="common-message-image" loading="lazy" onclick="openImageViewer(\'' + fullImageUrl + '\')" onerror="this.parentElement.innerHTML=\'<div class=\'message-image-error\'><i class=\'fas fa-image-slash\'></i> Изображение не загружено</div>\'"></div>';
    }

    let escaped = escapeHtml(decodedText).replace(/\n/g, '<br>');
    escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>');
    return escaped;
}

// ============================================================
// СТУДЕНТ: ОБЩИЙ ЧАТ
// ============================================================
export async function renderCommonChat() {
    const container = document.getElementById('commonMessagesArea');
    if (!container) return;

    const msgs = await apiCall('getCommonMessages');
    if (!msgs || msgs.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>Нет сообщений</p></div>';
        state.lastMessageId = 0;
        return;
    }

    if (msgs.length > 0) {
        let maxId = 0;
        for (let mi = 0; mi < msgs.length; mi++) {
            if (msgs[mi].id > maxId) maxId = msgs[mi].id;
        }
        state.lastMessageId = maxId;
    }

    const studentIds = [];
    for (let si = 0; si < msgs.length; si++) {
        const msg = msgs[si];
        if (msg.author_id !== 'admin') {
            if (studentIds.indexOf(msg.author_id) === -1) studentIds.push(msg.author_id);
        }
    }

    const titles = {};
    for (let ti = 0; ti < studentIds.length; ti++) {
        const sid = studentIds[ti];
        if (typeof window.getUserTitleForChat === 'function') {
            const title = await window.getUserTitleForChat(sid);
            if (title) titles[sid] = title;
        }
    }

    const currentUserId = state.currentStudent ? state.currentStudent.id : (state.currentUser ? state.currentUser.id : 0);
    const isAdmin = typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder();

    const grouped = {};
    for (let mg = 0; mg < msgs.length; mg++) {
        const m = msgs[mg];
        const d = m.created_at ? new Date(m.created_at).toLocaleDateString('ru-RU') : 'Сегодня';
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(m);
    }

    let html = '';
    const dates = Object.keys(grouped);

    for (let di = 0; di < dates.length; di++) {
        const date = dates[di];
        const messages = grouped[date];
        html += '<div class="message-date-separator"><span>' + date + '</span></div>';

        for (let mi2 = 0; mi2 < messages.length; mi2++) {
            const m = messages[mi2];
            const time = m.created_at ? formatTimeOnly(m.created_at) : '';
            const isAdminAuthor = m.author_id === 'admin' || m.author_group === 'ADMIN';

            let authorDisplay = escapeHtml(m.author_name);
            if (isAdminAuthor) authorDisplay += ' <span class="admin-badge-tag">ADMIN</span>';

            const titleBadge = (!isAdminAuthor && titles[m.author_id] && typeof window.createTitleBadge === 'function')
                ? ' ' + window.createTitleBadge(titles[m.author_id], true)
                : '';

            const groupDisplay = (!isAdminAuthor && m.author_group)
                ? '<span class="common-message-group">' + escapeHtml(m.author_group) + '</span>'
                : '';

            const avatarClass = isAdminAuthor ? ' admin-avatar-chat' : '';

            let authorStyle = '';
            if (!isAdminAuthor && titles[m.author_id] && titles[m.author_id].text_color) {
                authorStyle = ' style="color:' + titles[m.author_id].text_color + ';"';
            } else if (isAdminAuthor) {
                authorStyle = ' class="admin-author-chat"';
            }

            const canDelete = isAdmin || (!isAdminAuthor && m.author_id == currentUserId);
            let deleteButton = '';
            if (canDelete && !m.is_deleted) {
                deleteButton = '<button class="message-delete-btn" onclick="event.stopPropagation(); deleteCommonMessage(\'' + m.message_id + '\', \'' + m.author_id + '\', ' + (isAdmin ? 1 : 0) + ')" title="Удалить сообщение">' +
                    '<i class="fas fa-trash-alt"></i>' +
                '</button>';
            }

            html += '<div class="common-message ' + (m.is_deleted ? 'deleted' : '') + '" data-message-id="' + m.id + '">' +
                        '<div class="common-message-avatar' + avatarClass + '"><i class="fas ' + (isAdminAuthor ? 'fa-crown' : 'fa-user-graduate') + '"></i></div>' +
                        '<div class="common-message-content">' +
                            '<div class="common-message-header">' +
                                '<span class="common-message-author"' + authorStyle + '>' + authorDisplay + titleBadge + '</span>' +
                                groupDisplay +
                                '<span class="common-message-time">' + time + '</span>' +
                                deleteButton +
                            '</div>' +
                            '<div class="common-message-text">' + (m.is_deleted ? '<em>Сообщение удалено</em>' : renderCommonChatMessageText(m.text)) + '</div>' +
                        '</div>' +
                    '</div>';
        }
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ============================================================
// ОТПРАВКА СООБЩЕНИЯ СТУДЕНТОМ
// ============================================================
export async function sendCommonMessage() {
    if (commonSendInProgress) return;

    const inp = document.getElementById('commonMessageInput');
    const text = inp ? inp.value.trim() : '';

    if (!text) {
        showToast('Введите сообщение', 'error');
        return;
    }
    if (text.length > 500) {
        showToast('Слишком длинное', 'error');
        return;
    }
    if (containsProfanity(text)) {
        showToast('❌ Сообщение содержит запрещённые слова и не может быть отправлено', 'error');
        return;
    }
    if (!state.currentStudent) {
        showToast('Не удалось определить студента', 'error');
        return;
    }

    commonSendInProgress = true;

    const sendBtn = document.getElementById('sendCommonMessageBtn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    }

    try {
        const result = await apiCall('sendCommonMessage', 'POST', {
            author_id: state.currentStudent.id.toString(),
            author_name: state.currentStudent.name,
            author_group: state.currentStudent.group_name || 'Без группы',
            text: text
        });

        if (result) {
            if (inp) inp.value = '';
            const counter = document.getElementById('charCounter');
            if (counter) counter.textContent = '0/500';

            state.lastMessageId = 0;
            await renderCommonChat();
            if (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder() && typeof window.renderAdminCommonChat === 'function') {
                await window.renderAdminCommonChat();
            }
        } else {
            showToast('Ошибка при отправке', 'error');
        }
    } catch (e) {
        console.error('sendCommonMessage error:', e);
        showToast('Ошибка при отправке', 'error');
    } finally {
        setTimeout(function() {
            commonSendInProgress = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить';
            }
        }, 300);
    }
}

export async function deleteCommonMessage(messageId, authorId, isAdminFlag) {
    const currentUserId = state.currentStudent ? state.currentStudent.id : (state.currentUser ? state.currentUser.id : 0);
    const isAdmin = isAdminFlag || (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder());

    if (!isAdmin && authorId != currentUserId && authorId != 'admin') {
        showToast('❌ Можно удалять только свои сообщения', 'error');
        return;
    }

    const result = await apiCall('deleteCommonMessage', 'POST', {
        message_id: messageId,
        user_id: currentUserId,
        user_login: state.currentUser ? state.currentUser.login : '',
        is_admin: isAdmin ? 1 : 0
    });

    if (result) {
        showToast('🗑️ Сообщение удалено', 'success');
        state.lastMessageId = 0;
        await renderCommonChat();
        if (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder() && typeof window.renderAdminCommonChat === 'function') {
            await window.renderAdminCommonChat();
        }
    } else {
        showToast('❌ Не удалось удалить сообщение', 'error');
    }
}

// ============================================================
// АДМИН: ОБЩИЙ ЧАТ
// ============================================================
export async function renderAdminCommonChat() {
    const container = document.getElementById('adminCommonMessagesArea');
    if (!container) return;

    const msgs = await apiCall('getCommonMessages');
    if (!msgs || msgs.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>Нет сообщений</p></div>';
        state.lastMessageId = 0;
        return;
    }

    if (msgs.length > 0) {
        let maxId = 0;
        for (let mi = 0; mi < msgs.length; mi++) {
            if (msgs[mi].id > maxId) maxId = msgs[mi].id;
        }
        state.lastMessageId = maxId;
    }

    const studentIds = [];
    for (let si = 0; si < msgs.length; si++) {
        const msg = msgs[si];
        if (msg.author_id !== 'admin') {
            if (studentIds.indexOf(msg.author_id) === -1) studentIds.push(msg.author_id);
        }
    }

    const titles = {};
    for (let ti = 0; ti < studentIds.length; ti++) {
        const sid = studentIds[ti];
        if (typeof window.getUserTitleForChat === 'function') {
            const title = await window.getUserTitleForChat(sid);
            if (title) titles[sid] = title;
        }
    }

    const grouped = {};
    for (let mg = 0; mg < msgs.length; mg++) {
        const m = msgs[mg];
        const d = m.created_at ? new Date(m.created_at).toLocaleDateString('ru-RU') : 'Сегодня';
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(m);
    }

    let html = '';
    const dates = Object.keys(grouped);

    for (let di = 0; di < dates.length; di++) {
        const date = dates[di];
        const messages = grouped[date];
        html += '<div class="message-date-separator"><span>' + date + '</span></div>';

        for (let mi2 = 0; mi2 < messages.length; mi2++) {
            const m = messages[mi2];
            const time = m.created_at ? formatTimeOnly(m.created_at) : '';
            const isAdminAuthor = m.author_id === 'admin' || m.author_group === 'ADMIN';

            let authorDisplay = escapeHtml(m.author_name);
            if (isAdminAuthor) authorDisplay += ' <span class="admin-badge-tag">ADMIN</span>';

            const titleBadge = (!isAdminAuthor && titles[m.author_id] && typeof window.createTitleBadge === 'function')
                ? ' ' + window.createTitleBadge(titles[m.author_id], true)
                : '';

            const groupDisplay = (!isAdminAuthor && m.author_group)
                ? '<span class="common-message-group">' + escapeHtml(m.author_group) + '</span>'
                : '';

            const avatarClass = isAdminAuthor ? ' admin-avatar-chat' : '';

            let authorStyle = '';
            if (!isAdminAuthor && titles[m.author_id] && titles[m.author_id].text_color) {
                authorStyle = ' style="color:' + titles[m.author_id].text_color + ';"';
            } else if (isAdminAuthor) {
                authorStyle = ' class="admin-author-chat"';
            }

            let deleteButton = '';
            if (!m.is_deleted) {
                deleteButton = '<button class="message-delete-btn" onclick="event.stopPropagation(); deleteCommonMessage(\'' + m.message_id + '\', \'' + m.author_id + '\', 1)" title="Удалить сообщение">' +
                    '<i class="fas fa-trash-alt"></i>' +
                '</button>';
            }

            html += '<div class="common-message ' + (m.is_deleted ? 'deleted' : '') + '" data-message-id="' + m.id + '">' +
                        '<div class="common-message-avatar' + avatarClass + '"><i class="fas ' + (isAdminAuthor ? 'fa-crown' : 'fa-user-graduate') + '"></i></div>' +
                        '<div class="common-message-content">' +
                            '<div class="common-message-header">' +
                                '<span class="common-message-author"' + authorStyle + '>' + authorDisplay + titleBadge + '</span>' +
                                groupDisplay +
                                '<span class="common-message-time">' + time + '</span>' +
                                deleteButton +
                            '</div>' +
                            '<div class="common-message-text">' + (m.is_deleted ? '<em>Сообщение удалено</em>' : renderCommonChatMessageText(m.text)) + '</div>' +
                        '</div>' +
                    '</div>';
        }
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ============================================================
// ОТПРАВКА СООБЩЕНИЯ АДМИНОМ
// ============================================================
export async function sendAdminCommonMessage() {
    if (adminCommonSendInProgress) return;

    const inp = document.getElementById('adminCommonMessageInput');
    const text = inp ? inp.value.trim() : '';

    if (!text) {
        showToast('Введите сообщение', 'error');
        return;
    }
    if (text.length > 500) {
        showToast('Слишком длинное', 'error');
        return;
    }
    if (containsProfanity(text)) {
        showToast('❌ Сообщение содержит запрещённые слова и не может быть отправлено', 'error');
        return;
    }

    adminCommonSendInProgress = true;

    const sendBtn = document.getElementById('sendAdminCommonMessageBtn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    }

    try {
        const result = await apiCall('sendCommonMessage', 'POST', {
            author_id: 'admin',
            author_name: 'Администратор',
            author_group: 'ADMIN',
            text: text
        });

        if (result) {
            if (inp) inp.value = '';
            const counter = document.getElementById('adminCharCounter');
            if (counter) counter.textContent = '0/500';

            state.lastMessageId = 0;
            await renderAdminCommonChat();
            await renderCommonChat();
        } else {
            showToast('Ошибка при отправке', 'error');
        }
    } catch (e) {
        console.error('sendAdminCommonMessage error:', e);
        showToast('Ошибка при отправке', 'error');
    } finally {
        setTimeout(function() {
            adminCommonSendInProgress = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить';
            }
        }, 300);
    }
}

// ============================================================
// ОЧИСТКА ОБЩЕГО ЧАТА
// ============================================================
export async function clearCommonChat() {
    if (!confirm('⚠️ Вы уверены, что хотите полностью очистить общий чат? Это действие нельзя отменить.')) return;

    try {
        const result = await apiCall('clearCommonChat', 'POST', {
            user_id: state.currentUser ? state.currentUser.id : 0,
            user_login: state.currentUser ? state.currentUser.login : ''
        });

        if (result) {
            showToast('🗑️ Общий чат очищен', 'success');
            state.lastMessageId = 0;
            await renderAdminCommonChat();
            await renderCommonChat();
        } else {
            showToast('❌ Ошибка при очистке', 'error');
        }
    } catch (e) {
        console.error('clearCommonChat error:', e);
        showToast('❌ Ошибка при очистке', 'error');
    }
}

// ============================================================
// POLLING НОВЫХ СООБЩЕНИЙ
// ============================================================
export async function pollNewMessages() {
    if (state.isPolling) return;
    state.isPolling = true;

    try {
        const response = await fetch(state.API_URL + '?endpoint=getNewMessages&last_id=' + state.lastMessageId + '&t=' + Date.now());
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            let maxId = state.lastMessageId;
            for (let i = 0; i < data.data.length; i++) {
                if (data.data[i].id > maxId) maxId = data.data[i].id;
            }
            state.lastMessageId = maxId;
            await renderCommonChat();
            if (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder() && typeof window.renderAdminCommonChat === 'function') {
                await window.renderAdminCommonChat();
            }
        }
    } catch (e) {
        console.log('Polling error:', e);
    }

    state.isPolling = false;
    if (state.pollingInterval) {
        state.pollingInterval = setTimeout(pollNewMessages, 15000);
    }
}

export function startPolling() {
    if (commonPollingActive) return;
    commonPollingActive = true;
    state.pollingInterval = true;
    pollNewMessages();
}

export function stopPolling() {
    if (state.pollingInterval) {
        clearTimeout(state.pollingInterval);
    }
    state.pollingInterval = null;
    state.isPolling = false;
    commonPollingActive = false;
}

// ============================================================
// POLLING ОБНОВЛЕНИЙ ТИТУЛОВ
// ============================================================
export async function pollTitleChanges() {
    if (state.isTitlePolling) return;
    state.isTitlePolling = true;

    try {
        const response = await fetch(state.API_URL + '?endpoint=getTitleUpdates&last_id=' + state.lastTitleUpdateId + '&t=' + Date.now());
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            let maxId = state.lastTitleUpdateId;
            for (let i = 0; i < data.data.length; i++) {
                if (data.data[i].id > maxId) maxId = data.data[i].id;
            }
            state.lastTitleUpdateId = maxId;

            for (let ui = 0; ui < data.data.length; ui++) {
                const update = data.data[ui];
                delete state.userTitleCache[update.student_id];
                delete state.userTitleColorCache[update.student_id];
            }
            await renderCommonChat();
            if (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder() && typeof window.renderAdminCommonChat === 'function') {
                await window.renderAdminCommonChat();
            }
        }
    } catch (e) {
        console.log('Title polling error:', e);
    }

    state.isTitlePolling = false;
    if (state.titlePollingInterval) {
        state.titlePollingInterval = setTimeout(pollTitleChanges, 20000);
    }
}

export function startTitlePolling() {
    if (titlePollingActive) return;
    titlePollingActive = true;
    state.titlePollingInterval = true;
    pollTitleChanges();
}

export function stopTitlePolling() {
    if (state.titlePollingInterval) {
        clearTimeout(state.titlePollingInterval);
    }
    state.titlePollingInterval = null;
    state.isTitlePolling = false;
    titlePollingActive = false;
}

// ============================================================
// СЧЁТЧИКИ СИМВОЛОВ
// ============================================================
export function initCharCounters() {
    const ci = document.getElementById('commonMessageInput');
    const cc = document.getElementById('charCounter');
    if (ci && cc) {
        const updateCounter = function() {
            const l = ci.value.length;
            cc.textContent = l + '/500';
            cc.style.color = l >= 480 ? (l > 500 ? '#ef4444' : '#f59e0b') : 'var(--text-muted)';
        };
        ci.addEventListener('input', updateCounter);
        updateCounter();
    }

    const ai = document.getElementById('adminCommonMessageInput');
    const ac = document.getElementById('adminCharCounter');
    if (ai && ac) {
        const updateAdminCounter = function() {
            const l = ai.value.length;
            ac.textContent = l + '/500';
            ac.style.color = l >= 480 ? (l > 500 ? '#ef4444' : '#f59e0b') : 'var(--text-muted)';
        };
        ai.addEventListener('input', updateAdminCounter);
        updateAdminCounter();
    }
}

// ============================================================
// ENTER В ЧАТАХ
// ============================================================
export function initChatEnterHandlers() {
    if (commonChatEnterInitialized) return;
    commonChatEnterInitialized = true;

    const ci = document.getElementById('commonMessageInput');
    if (ci) {
        const newCi = ci.cloneNode(true);
        ci.parentNode.replaceChild(newCi, ci);

        newCi.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendCommonMessage();
            }
        });

        newCi.addEventListener('input', function() {
            const cc = document.getElementById('charCounter');
            if (cc) {
                const l = this.value.length;
                cc.textContent = l + '/500';
                cc.style.color = l >= 480 ? (l > 500 ? '#ef4444' : '#f59e0b') : 'var(--text-muted)';
            }
        });
    }

    const ai = document.getElementById('adminCommonMessageInput');
    if (ai) {
        const newAi = ai.cloneNode(true);
        ai.parentNode.replaceChild(newAi, ai);

        newAi.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAdminCommonMessage();
            }
        });

        newAi.addEventListener('input', function() {
            const ac = document.getElementById('adminCharCounter');
            if (ac) {
                const l = this.value.length;
                ac.textContent = l + '/500';
                ac.style.color = l >= 480 ? (l > 500 ? '#ef4444' : '#f59e0b') : 'var(--text-muted)';
            }
        });
    }

    // Кнопки "Отправить"
    const sendCommonBtn = document.getElementById('sendCommonMessageBtn');
    if (sendCommonBtn) {
        const newBtn = sendCommonBtn.cloneNode(true);
        sendCommonBtn.parentNode.replaceChild(newBtn, sendCommonBtn);
        newBtn.addEventListener('click', sendCommonMessage);
    }

    const sendAdminCommonBtn = document.getElementById('sendAdminCommonMessageBtn');
    if (sendAdminCommonBtn) {
        const newBtn = sendAdminCommonBtn.cloneNode(true);
        sendAdminCommonBtn.parentNode.replaceChild(newBtn, sendAdminCommonBtn);
        newBtn.addEventListener('click', sendAdminCommonMessage);
    }
}

// ============================================================
// ⚡ ИНИЦИАЛИЗАЦИЯ КНОПКИ "ОЧИСТИТЬ ЧАТ" (НОВОЕ)
// ============================================================
export function initCommonChatButtons() {
    if (commonChatButtonsInitialized) return;
    commonChatButtonsInitialized = true;

    // Кнопка "Очистить чат" в админке
    const adminClearBtn = document.getElementById('adminClearCommonChatBtn');
    if (adminClearBtn) {
        const newBtn = adminClearBtn.cloneNode(true);
        adminClearBtn.parentNode.replaceChild(newBtn, adminClearBtn);
        newBtn.addEventListener('click', clearCommonChat);
        console.log('✅ Кнопка "Очистить чат" инициализирована');
    } else {
        console.warn('⚠️ Кнопка adminClearCommonChatBtn не найдена в DOM');
    }
}

export function initUnreadCheck() {
    if (state.unreadCheckInterval) clearInterval(state.unreadCheckInterval);
    state.unreadCheckInterval = setInterval(async function() {
        if (state.currentUser) {
            // Заглушка — сервер возвращает 0
        }
    }, 5000);
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.renderCommonChat = renderCommonChat;
window.renderAdminCommonChat = renderAdminCommonChat;
window.sendCommonMessage = sendCommonMessage;
window.sendAdminCommonMessage = sendAdminCommonMessage;
window.deleteCommonMessage = deleteCommonMessage;
window.clearCommonChat = clearCommonChat;
window.renderCommonChatMessageText = renderCommonChatMessageText;
window.startPolling = startPolling;
window.stopPolling = stopPolling;
window.startTitlePolling = startTitlePolling;
window.stopTitlePolling = stopTitlePolling;
window.initCharCounters = initCharCounters;
window.initChatEnterHandlers = initChatEnterHandlers;
window.initCommonChatButtons = initCommonChatButtons;
window.initUnreadCheck = initUnreadCheck;