// assets/js/modules/support.js — поддержка (тикеты): студент + админ

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml, formatTimeOnly, formatDateOnly, containsProfanity } from '../core/utils.js';
import { showToast, showModal } from '../core/ui.js';

// ============================================================
// ФЛАГИ ЗАЩИТЫ ОТ ДУБЛИРОВАНИЯ
// ============================================================
let studentSendInProgress = false;
let adminReplyInProgress = false;
let ticketPollingActive = false;
let supportButtonsInitialized = false;
let adminFiltersInitialized = false;

// ============================================================
// ХЕЛПЕР
// ============================================================
function getCurrentStudentId() {
    if (state.founderToggleMode && state.currentStudent && state.currentStudent.id) return state.currentStudent.id;
    if (state.currentStudent && state.currentStudent.id) return state.currentStudent.id;
    if (state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'founder')) return -state.currentUser.id;
    return null;
}

// ============================================================
// СТУДЕНТ: СПИСОК ОБРАЩЕНИЙ
// ============================================================
export async function loadStudentChats() {
    if (!state.currentStudent) return;

    try {
        const t = await apiCall('getSupportTickets', 'GET', { student_id: state.currentStudent.id });
        state.studentTickets = t || [];

        for (let ti = 0; ti < state.studentTickets.length; ti++) {
            const tk = state.studentTickets[ti];
            const r = await apiCall('getTicketReplies', 'GET', { ticket_id: tk.ticket_id });

            if (r && r.length > 0) {
                const lr = r[r.length - 1];
                tk.last_message = lr.text;
                tk.last_message_time = lr.created_at;
                tk.last_message_is_admin = (lr.is_admin_reply == 1);
            } else {
                tk.last_message = tk.text;
                tk.last_message_time = tk.created_at;
                tk.last_message_is_admin = false;
            }
        }

        state.studentTickets.sort(function(a, b) {
            const dateA = new Date(a.last_message_time || a.created_at);
            const dateB = new Date(b.last_message_time || b.created_at);
            return dateB - dateA;
        });

        renderStudentChatsList();
        if (state.currentTicketId) await loadStudentMessages(state.currentTicketId);
    } catch (e) { /* ignore */ }
}

export function renderStudentChatsList() {
    const c = document.getElementById('studentChatsList');
    if (!c) return;

    if (!state.studentTickets || state.studentTickets.length === 0) {
        c.innerHTML = '<div class="empty-conversation"><i class="fas fa-inbox"></i><p>Нет обращений</p></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < state.studentTickets.length; i++) {
        const tk = state.studentTickets[i];
        let lt = '';
        if (tk.last_message_time) {
            const d = new Date(tk.last_message_time);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const md = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            lt = md.getTime() === today.getTime()
                ? formatTimeOnly(tk.last_message_time)
                : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        }

        let lmt = tk.last_message || tk.text || '';
        if (lmt.length > 50) lmt = lmt.substring(0, 50) + '...';

        html += '<div class="chat-item ' + (state.currentTicketId === tk.ticket_id ? 'active' : '') + '" onclick="selectStudentChat(\'' + tk.ticket_id + '\')">' +
            '<div class="chat-avatar ' + (tk.is_anonymous ? 'anonymous' : '') + '"><i class="fas ' + (tk.is_anonymous ? 'fa-user-secret' : 'fa-user') + '"></i></div>' +
            '<div class="chat-info">' +
                '<div class="chat-name">' + (tk.is_anonymous ? 'Анонимно' : 'Обращение #' + tk.ticket_id.slice(-6)) + ' ' + (tk.answer ? '<span class="badge-answered">✓ Отвечен</span>' : '<span class="badge-pending">⏳ Ожидает</span>') + '</div>' +
                '<div class="chat-last-message">' + (tk.last_message_is_admin ? '<i class="fas fa-reply" style="color:#10b981;font-size:10px;margin-right:4px;"></i>' : '') + escapeHtml(lmt) + '</div>' +
            '</div>' +
            '<div class="chat-time">' + lt + '</div>' +
        '</div>';
    }
    c.innerHTML = html;
}

export async function selectStudentChat(tid) {
    state.currentTicketId = tid;

    const studentConversationHeader = document.getElementById('studentConversationHeader');
    const studentMessageInputArea = document.getElementById('studentMessageInputArea');
    const studentChatName = document.getElementById('studentChatName');
    const studentChatStatus = document.getElementById('studentChatStatus');

    if (studentConversationHeader) studentConversationHeader.style.display = 'flex';
    if (studentMessageInputArea) studentMessageInputArea.style.display = 'flex';
    if (studentChatName) studentChatName.textContent = 'Поддержка';
    if (studentChatStatus) studentChatStatus.textContent = 'Онлайн';

    await loadStudentMessages(tid);
    renderStudentChatsList();
}

export async function loadStudentMessages(tid) {
    const ma = document.getElementById('studentMessagesArea');
    if (!ma) return;

    const t = await apiCall('getSupportTickets', 'GET', { student_id: state.currentStudent.id });
    let tk = null;
    if (t) {
        for (let i = 0; i < t.length; i++) {
            if (t[i].ticket_id === tid) { tk = t[i]; break; }
        }
    }

    const r = await apiCall('getTicketReplies', 'GET', { ticket_id: tid });
    const am = [];

    if (tk) am.push({ id: tk.ticket_id, text: tk.text, is_admin: false, created_at: tk.created_at });
    if (r) {
        for (let ri = 0; ri < r.length; ri++) {
            const rp = r[ri];
            am.push({ id: rp.reply_id, text: rp.text, is_admin: (rp.is_admin_reply == 1), created_at: rp.created_at });
        }
    }

    am.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });

    if (am.length === 0) {
        ma.innerHTML = '<div class="empty-conversation"><i class="fas fa-comments"></i><p>Нет сообщений</p></div>';
        return;
    }

    const g = {};
    for (let mi = 0; mi < am.length; mi++) {
        const m = am[mi];
        const d = m.created_at ? formatDateOnly(m.created_at) : 'Сегодня';
        if (!g[d]) g[d] = [];
        g[d].push(m);
    }

    let h = '';
    const dates = Object.keys(g);
    for (let di = 0; di < dates.length; di++) {
        const date = dates[di];
        const msgs = g[date];
        h += '<div class="message-date-separator"><span>' + date + '</span></div>';
        for (let mi2 = 0; mi2 < msgs.length; mi2++) {
            const m = msgs[mi2];
            const time = m.created_at ? formatTimeOnly(m.created_at) : '';
            h += m.is_admin
                ? '<div class="message-bubble student"><div class="message-avatar-small"><i class="fas fa-crown"></i></div><div class="message-content"><div class="message-text">' + escapeHtml(m.text) + '</div><div class="message-time">' + time + '</div></div></div>'
                : '<div class="message-bubble admin"><div class="message-avatar-small"><i class="fas fa-user-graduate"></i></div><div class="message-content"><div class="message-text">' + escapeHtml(m.text) + '</div><div class="message-time">' + time + '</div></div></div>';
        }
    }
    ma.innerHTML = h;
    ma.scrollTop = ma.scrollHeight;
}

// ============================================================
// ОТПРАВКА СООБЩЕНИЯ СТУДЕНТОМ (с защитой)
// ============================================================
export async function sendStudentMessage() {
    // ⚡ Защита от двойной отправки
    if (studentSendInProgress) return;

    const inp = document.getElementById('studentMessageInput');
    const text = inp ? inp.value.trim() : '';
    if (!text) { showToast('Введите сообщение', 'error'); return; }
    if (!state.currentTicketId) { showToast('Выберите чат', 'error'); return; }
    if (text.length > 500) { showToast('Слишком длинное', 'error'); return; }
    if (containsProfanity(text)) { showToast('❌ Сообщение содержит запрещённые слова и не может быть отправлено', 'error'); return; }

    studentSendInProgress = true;

    const sendBtn = document.getElementById('sendStudentMessageBtn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        const result = await apiCall('addSupportReply', 'POST', {
            ticket_id: state.currentTicketId,
            text: text,
            is_admin: 0,
            admin_name: state.currentStudent ? state.currentStudent.name : 'Студент',
            user_id: state.currentUser ? state.currentUser.id : 0,
            user_login: state.currentUser ? state.currentUser.login : ''
        });

        if (result) {
            if (inp) inp.value = '';
            showToast('✅ Отправлено', 'success');
            await loadStudentMessages(state.currentTicketId);
            await loadStudentChats();
        } else {
            showToast('❌ Ошибка при отправке', 'error');
        }
    } catch (e) {
        console.error('sendStudentMessage error:', e);
        showToast('❌ Ошибка при отправке', 'error');
    } finally {
        setTimeout(function() {
            studentSendInProgress = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        }, 300);
    }
}

export async function createNewTicket() {
    const text = document.getElementById('newTicketText') ? document.getElementById('newTicketText').value.trim() : '';
    const isAnon = document.getElementById('newTicketAnonymous') ? document.getElementById('newTicketAnonymous').checked : false;

    if (!text) { showToast('Введите текст', 'error'); return; }
    if (text.length > 500) { showToast('Слишком длинное', 'error'); return; }
    if (containsProfanity(text)) { showToast('❌ Сообщение содержит запрещённые слова и не может быть отправлено', 'error'); return; }

    const createBtn = document.getElementById('createTicketBtn');
    if (createBtn) {
        createBtn.disabled = true;
        createBtn.textContent = 'Отправка...';
    }

    try {
        const r = await apiCall('sendSupportMessage', 'POST', {
            student_id: state.currentStudent.id,
            text: text,
            is_anonymous: isAnon ? 1 : 0
        });

        if (r) {
            showToast('✅ Обращение отправлено', 'success');
            if (typeof window.closeModal === 'function') window.closeModal('newTicketModal');

            const newTicketText = document.getElementById('newTicketText');
            const newTicketAnonymous = document.getElementById('newTicketAnonymous');
            if (newTicketText) newTicketText.value = '';
            if (newTicketAnonymous) newTicketAnonymous.checked = false;

            await loadStudentChats();
        }
    } finally {
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.textContent = 'Отправить';
        }
    }
}

// ============================================================
// АДМИН: СПИСОК ТИКЕТОВ
// ============================================================
export async function loadAdminTickets() {
    if (!state.currentUser || (state.currentUser.role !== 'admin' && state.currentUser.role !== 'founder')) return;

    try {
        const t = await apiCall('getAllSupportTickets');
        state.adminTickets = t || [];

        for (let ti = 0; ti < state.adminTickets.length; ti++) {
            const tk = state.adminTickets[ti];
            const r = await apiCall('getTicketReplies', 'GET', { ticket_id: tk.ticket_id });

            if (r && r.length > 0) {
                const lr = r[r.length - 1];
                tk.last_message = lr.text;
                tk.last_message_time = lr.created_at;
                tk.last_message_is_admin = (lr.is_admin_reply == 1);
            } else {
                tk.last_message = tk.text;
                tk.last_message_time = tk.created_at;
                tk.last_message_is_admin = false;
            }
        }

        state.adminTickets.sort(function(a, b) {
            const dateA = new Date(a.last_message_time || a.created_at);
            const dateB = new Date(b.last_message_time || b.created_at);
            return dateB - dateA;
        });

        renderAdminChatsList();
        updateAdminUnreadCount();
    } catch (e) { /* ignore */ }
}

export function renderAdminChatsList() {
    const c = document.getElementById('adminChatsList');
    if (!c) return;

    let f = state.adminTickets || [];
    if (state.adminFilter === 'pending') f = f.filter(function(t) { return !t.answer; });
    else if (state.adminFilter === 'answered') f = f.filter(function(t) { return t.answer; });

    if (f.length === 0) {
        c.innerHTML = '<div class="empty-conversation"><i class="fas fa-inbox"></i><p>Нет обращений</p></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < f.length; i++) {
        const tk = f[i];
        let lt = '';
        if (tk.last_message_time) {
            const d = new Date(tk.last_message_time);
            const today = new Date();
            lt = d.toDateString() === today.toDateString()
                ? formatTimeOnly(tk.last_message_time)
                : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        }

        let lmt = tk.last_message || tk.text || '';
        if (lmt.length > 50) lmt = lmt.substring(0, 50) + '...';

        html += '<div class="admin-chat-item ' + (state.adminCurrentTicketId === tk.ticket_id ? 'active' : '') + ' ' + (!tk.answer ? 'pending' : 'answered') + '" onclick="selectAdminChat(\'' + tk.ticket_id + '\')">' +
            '<div class="admin-chat-header">' +
                '<div class="admin-chat-name ' + (tk.is_anonymous ? 'anonymous' : '') + '"><i class="fas ' + (tk.is_anonymous ? 'fa-user-secret' : 'fa-user-graduate') + '"></i> ' + (tk.is_anonymous ? 'Анонимно' : escapeHtml(tk.student_name || 'Студент')) + ' ' + (tk.group_name ? '<span class="admin-chat-group">' + escapeHtml(tk.group_name) + '</span>' : '') + '</div>' +
                '<div class="admin-chat-date">' + lt + '</div>' +
            '</div>' +
            '<div class="admin-chat-preview">' + escapeHtml(lmt) + '</div>' +
            '<div class="admin-chat-footer">' +
                '<span class="admin-chat-status ' + (!tk.answer ? 'pending' : 'answered') + '">' + (!tk.answer ? '⏳ Ожидает ответа' : '✅ Отвечен') + '</span>' +
            '</div>' +
        '</div>';
    }
    c.innerHTML = html;
}

export async function selectAdminChat(tid) {
    state.adminCurrentTicketId = tid;

    let tk = null;
    for (let i = 0; i < state.adminTickets.length; i++) {
        if (state.adminTickets[i].ticket_id === tid) { tk = state.adminTickets[i]; break; }
    }
    if (!tk) return;

    const adminConversationHeader = document.getElementById('adminConversationHeader');
    const adminMessageInputArea = document.getElementById('adminMessageInputArea');
    const adminChatName = document.getElementById('adminChatName');
    const adminChatGroup = document.getElementById('adminChatGroup');

    if (adminConversationHeader) adminConversationHeader.style.display = 'flex';
    if (adminMessageInputArea) adminMessageInputArea.style.display = 'flex';
    if (adminChatName) adminChatName.textContent = tk.is_anonymous ? 'Анонимный студент' : (tk.student_name || 'Студент');
    if (adminChatGroup) adminChatGroup.textContent = tk.group_name || 'Группа не указана';

    await loadAdminMessages(tid);
    renderAdminChatsList();
}

export async function loadAdminMessages(tid) {
    const ma = document.getElementById('adminMessagesArea');
    if (!ma) return;

    let tk = null;
    for (let i = 0; i < state.adminTickets.length; i++) {
        if (state.adminTickets[i].ticket_id === tid) { tk = state.adminTickets[i]; break; }
    }

    const r = await apiCall('getTicketReplies', 'GET', { ticket_id: tid });
    const am = [];

    if (tk) am.push({ id: tk.ticket_id, text: tk.text, is_admin: false, created_at: tk.created_at });
    if (r) {
        for (let ri = 0; ri < r.length; ri++) {
            const rp = r[ri];
            am.push({ id: rp.reply_id, text: rp.text, is_admin: (rp.is_admin_reply == 1), created_at: rp.created_at });
        }
    }

    am.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });

    if (am.length === 0) {
        ma.innerHTML = '<div class="empty-conversation"><i class="fas fa-comments"></i><p>Нет сообщений</p></div>';
        return;
    }

    const g = {};
    for (let mi = 0; mi < am.length; mi++) {
        const m = am[mi];
        const d = m.created_at ? formatDateOnly(m.created_at) : 'Сегодня';
        if (!g[d]) g[d] = [];
        g[d].push(m);
    }

    let h = '';
    const dates = Object.keys(g);
    for (let di = 0; di < dates.length; di++) {
        const date = dates[di];
        const msgs = g[date];
        h += '<div class="message-date-separator"><span>' + date + '</span></div>';
        for (let mi2 = 0; mi2 < msgs.length; mi2++) {
            const m = msgs[mi2];
            const time = m.created_at ? formatTimeOnly(m.created_at) : '';
            h += m.is_admin
                ? '<div class="message-bubble admin"><div class="message-avatar-small"><i class="fas fa-crown"></i></div><div class="message-content"><div class="message-text">' + escapeHtml(m.text) + '</div><div class="message-time">' + time + '</div></div></div>'
                : '<div class="message-bubble student"><div class="message-avatar-small"><i class="fas fa-user-graduate"></i></div><div class="message-content"><div class="message-text">' + escapeHtml(m.text) + '</div><div class="message-time">' + time + '</div></div></div>';
        }
    }
    ma.innerHTML = h;
    ma.scrollTop = ma.scrollHeight;
}

// ============================================================
// ОТПРАВКА ОТВЕТА АДМИНОМ (с защитой)
// ============================================================
export async function sendAdminReply() {
    // ⚡ Защита от двойной отправки
    if (adminReplyInProgress) return;

    const inp = document.getElementById('adminReplyInput');
    const text = inp ? inp.value.trim() : '';
    if (!text) { showToast('Введите ответ', 'error'); return; }
    if (!state.adminCurrentTicketId) { showToast('Выберите чат', 'error'); return; }
    if (containsProfanity(text)) { showToast('❌ Ответ содержит запрещённые слова и не может быть отправлен', 'error'); return; }

    adminReplyInProgress = true;

    const sendBtn = document.getElementById('sendAdminReplyBtn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        const r = await apiCall('addSupportReply', 'POST', {
            ticket_id: state.adminCurrentTicketId,
            text: text,
            is_admin: 1,
            admin_name: state.currentUser ? state.currentUser.login : 'Администратор',
            user_id: state.currentUser ? state.currentUser.id : 0,
            user_login: state.currentUser ? state.currentUser.login : ''
        });

        if (r) {
            if (inp) inp.value = '';

            let tk = null;
            for (let i = 0; i < state.adminTickets.length; i++) {
                if (state.adminTickets[i].ticket_id === state.adminCurrentTicketId) { tk = state.adminTickets[i]; break; }
            }
            if (tk && !tk.answer) {
                await apiCall('answerSupport', 'POST', {
                    ticket_id: state.adminCurrentTicketId,
                    answer: text
                });
            }

            showToast('✅ Ответ отправлен', 'success');
            await loadAdminMessages(state.adminCurrentTicketId);
            await loadAdminTickets();
        } else {
            showToast('❌ Ошибка при отправке', 'error');
        }
    } catch (e) {
        console.error('sendAdminReply error:', e);
        showToast('❌ Ошибка при отправке', 'error');
    } finally {
        setTimeout(function() {
            adminReplyInProgress = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        }, 300);
    }
}

export async function deleteAdminChat() {
    if (!state.adminCurrentTicketId) { showToast('Выберите чат', 'error'); return; }
    if (!confirm('Удалить чат?')) return;

    await apiCall('deleteSupportTicket', 'POST', {
        ticket_id: state.adminCurrentTicketId,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    showToast('✅ Чат удален', 'success');
    state.adminCurrentTicketId = null;

    const adminConversationHeader = document.getElementById('adminConversationHeader');
    const adminMessageInputArea = document.getElementById('adminMessageInputArea');
    const adminMessagesArea = document.getElementById('adminMessagesArea');

    if (adminConversationHeader) adminConversationHeader.style.display = 'none';
    if (adminMessageInputArea) adminMessageInputArea.style.display = 'none';
    if (adminMessagesArea) adminMessagesArea.innerHTML = '<div class="empty-conversation"><i class="fas fa-comments"></i><p>Выберите чат слева</p></div>';

    await loadAdminTickets();
}

export async function updateAdminUnreadCount() {
    let pc = 0;
    for (let i = 0; i < state.adminTickets.length; i++) {
        if (!state.adminTickets[i].answer) pc++;
    }

    const badge = document.getElementById('unreadTicketsBadge');
    if (badge) {
        if (pc > 0) {
            badge.style.display = 'flex';
            const span = badge.querySelector('span');
            if (span) span.textContent = pc;
        } else {
            badge.style.display = 'none';
        }
    }
}

// ============================================================
// ФИЛЬТРЫ (с защитой от дубля)
// ============================================================
export function initAdminFilters() {
    // ⚡ Защита: если уже инициализировано — выходим
    if (adminFiltersInitialized) return;
    adminFiltersInitialized = true;

    const chips = document.querySelectorAll('.filter-chip');
    for (let i = 0; i < chips.length; i++) {
        // Клонируем, чтобы убрать старые обработчики
        const chip = chips[i];
        const newChip = chip.cloneNode(true);
        chip.parentNode.replaceChild(newChip, chip);

        newChip.addEventListener('click', function() {
            const btns = document.querySelectorAll('.filter-chip');
            for (let b = 0; b < btns.length; b++) btns[b].classList.remove('active');
            this.classList.add('active');
            state.adminFilter = this.dataset.filter;
            renderAdminChatsList();
        });
    }
}

// ============================================================
// POLLING ОБНОВЛЕНИЙ ТИКЕТОВ (с защитой)
// ============================================================
export async function pollTicketUpdates() {
    const studentId = getCurrentStudentId();
    if (!studentId) {
        if (state.ticketUpdatesPollingInterval) {
            state.ticketUpdatesPollingInterval = setTimeout(pollTicketUpdates, 15000);
        }
        return;
    }

    const isAdminFlag = (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder()) ? 1 : 0;
    const studentIdParam = isAdminFlag ? 0 : studentId;

    try {
        const response = await fetch(state.API_URL + '?endpoint=getTicketUpdates&student_id=' + studentIdParam + '&last_update_id=' + state.ticketLastUpdateId + '&is_admin=' + isAdminFlag + '&t=' + Date.now());
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            let maxId = state.ticketLastUpdateId;
            for (let i = 0; i < data.data.length; i++) {
                if (data.data[i].id > maxId) maxId = data.data[i].id;
            }
            state.ticketLastUpdateId = maxId;

            let hasNewTicket = false;
            let hasNewReply = false;
            let needRefresh = false;

            for (let j = 0; j < data.data.length; j++) {
                const update = data.data[j];

                if (update.update_type === 'new_ticket') {
                    hasNewTicket = true;
                    needRefresh = true;
                }
                if (update.update_type === 'student_reply') {
                    needRefresh = true;
                    if (isAdminFlag) showToast('💬 Новое сообщение от студента в обращении', 'info');
                }
                if (update.update_type === 'admin_reply') {
                    needRefresh = true;
                    if (!isAdminFlag) {
                        hasNewReply = true;
                        showToast('💬 Новый ответ от поддержки!', 'info');
                    }
                }
                if (update.update_type === 'deleted') {
                    showToast('🗑️ Обращение было удалено', 'warning');
                    needRefresh = true;

                    if (state.adminCurrentTicketId === update.ticket_id) {
                        state.adminCurrentTicketId = null;
                        const adminConversationHeader = document.getElementById('adminConversationHeader');
                        const adminMessageInputArea = document.getElementById('adminMessageInputArea');
                        const adminMessagesArea = document.getElementById('adminMessagesArea');
                        if (adminConversationHeader) adminConversationHeader.style.display = 'none';
                        if (adminMessageInputArea) adminMessageInputArea.style.display = 'none';
                        if (adminMessagesArea) adminMessagesArea.innerHTML = '<div class="empty-conversation"><i class="fas fa-comments"></i><p>Выберите чат слева</p></div>';
                    }
                    if (state.currentTicketId === update.ticket_id) {
                        state.currentTicketId = null;
                        const studentConversationHeader = document.getElementById('studentConversationHeader');
                        const studentMessageInputArea = document.getElementById('studentMessageInputArea');
                        const studentMessagesArea = document.getElementById('studentMessagesArea');
                        if (studentConversationHeader) studentConversationHeader.style.display = 'none';
                        if (studentMessageInputArea) studentMessageInputArea.style.display = 'none';
                        if (studentMessagesArea) studentMessagesArea.innerHTML = '<div class="empty-conversation"><i class="fas fa-comments"></i><p>Выберите чат или создайте новое обращение</p></div>';
                    }
                }
            }

            if (needRefresh || hasNewTicket) {
                if (isAdminFlag) {
                    await loadAdminTickets();
                    if (hasNewTicket) showToast('📩 Новое обращение в поддержку!', 'info');
                    if (state.adminCurrentTicketId) await loadAdminMessages(state.adminCurrentTicketId);
                } else {
                    await loadStudentChats();
                    if (hasNewReply) showToast('💬 Новый ответ от поддержки!', 'info');
                    if (state.currentTicketId) await loadStudentMessages(state.currentTicketId);
                }
            }
        }
    } catch (e) {
        console.log('Ticket updates polling error:', e);
    }

    if (state.ticketUpdatesPollingInterval) {
        state.ticketUpdatesPollingInterval = setTimeout(pollTicketUpdates, 15000);
    }
}

export function startTicketUpdatesPolling() {
    // ⚡ Защита от повторного запуска
    if (ticketPollingActive) return;
    ticketPollingActive = true;
    state.ticketUpdatesPollingInterval = true;
    state.ticketLastUpdateId = 0;
    pollTicketUpdates();
}

export function stopTicketUpdatesPolling() {
    if (state.ticketUpdatesPollingInterval) {
        clearTimeout(state.ticketUpdatesPollingInterval);
    }
    state.ticketUpdatesPollingInterval = null;
    ticketPollingActive = false;
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ КНОПОК (с защитой от дубля)
// ============================================================
export function initSupportButtons() {
    // ⚡ Защита: если уже инициализировано — выходим
    if (supportButtonsInitialized) return;
    supportButtonsInitialized = true;

    // Кнопка "Новое обращение"
    const newTicketBtn = document.getElementById('newTicketBtn');
    if (newTicketBtn) {
        const newBtn = newTicketBtn.cloneNode(true);
        newTicketBtn.parentNode.replaceChild(newBtn, newTicketBtn);
        newBtn.addEventListener('click', function() { showModal('newTicketModal'); });
    }

    // Кнопка "Отправить" в новом обращении
    const createTicketBtn = document.getElementById('createTicketBtn');
    if (createTicketBtn) {
        const newBtn = createTicketBtn.cloneNode(true);
        createTicketBtn.parentNode.replaceChild(newBtn, createTicketBtn);
        newBtn.addEventListener('click', createNewTicket);
    }

    // Кнопка "Отправить" в студенческом чате
    const sendStudentMessageBtn = document.getElementById('sendStudentMessageBtn');
    if (sendStudentMessageBtn) {
        const newBtn = sendStudentMessageBtn.cloneNode(true);
        sendStudentMessageBtn.parentNode.replaceChild(newBtn, sendStudentMessageBtn);
        newBtn.addEventListener('click', sendStudentMessage);
    }

    // Кнопка "Отправить" в админском чате
    const sendAdminReplyBtn = document.getElementById('sendAdminReplyBtn');
    if (sendAdminReplyBtn) {
        const newBtn = sendAdminReplyBtn.cloneNode(true);
        sendAdminReplyBtn.parentNode.replaceChild(newBtn, sendAdminReplyBtn);
        newBtn.addEventListener('click', sendAdminReply);
    }

    // Кнопка "Удалить чат" в админке
    const adminDeleteChatBtn = document.getElementById('adminDeleteChatBtn');
    if (adminDeleteChatBtn) {
        const newBtn = adminDeleteChatBtn.cloneNode(true);
        adminDeleteChatBtn.parentNode.replaceChild(newBtn, adminDeleteChatBtn);
        newBtn.addEventListener('click', deleteAdminChat);
    }

    // ⚡ Enter в textarea студента
    const studentInput = document.getElementById('studentMessageInput');
    if (studentInput) {
        const newInput = studentInput.cloneNode(true);
        studentInput.parentNode.replaceChild(newInput, studentInput);
        newInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendStudentMessage();
            }
        });
    }

    // ⚡ Enter в textarea админа
    const adminInput = document.getElementById('adminReplyInput');
    if (adminInput) {
        const newInput = adminInput.cloneNode(true);
        adminInput.parentNode.replaceChild(newInput, adminInput);
        newInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAdminReply();
            }
        });
    }
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.loadStudentChats = loadStudentChats;
window.selectStudentChat = selectStudentChat;
window.loadStudentMessages = loadStudentMessages;
window.sendStudentMessage = sendStudentMessage;
window.createNewTicket = createNewTicket;
window.loadAdminTickets = loadAdminTickets;
window.selectAdminChat = selectAdminChat;
window.loadAdminMessages = loadAdminMessages;
window.sendAdminReply = sendAdminReply;
window.deleteAdminChat = deleteAdminChat;
window.initAdminFilters = initAdminFilters;
window.initSupportButtons = initSupportButtons;
window.startTicketUpdatesPolling = startTicketUpdatesPolling;
window.stopTicketUpdatesPolling = stopTicketUpdatesPolling;