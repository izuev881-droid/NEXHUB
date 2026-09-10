// assets/js/modules/messenger.js — мессенджер (личные и групповые чаты)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml, formatTimeOnly, formatDateOnly, containsProfanity, formatFileSizeDisplay, getFileIconByName } from '../core/utils.js';
import { showToast } from '../core/ui.js';

// ============================================================
// ФЛАГИ ЗАЩИТЫ ОТ ДУБЛИРОВАНИЯ
// ============================================================
let messengerInitialized = false;
let sendInProgress = false;
let uploadInProgress = false;
let selectChatInProgress = false;

// ============================================================
// ХЕЛПЕРЫ
// ============================================================
export function getCurrentChatUserInfo() {
    if (state.founderToggleMode && state.currentStudent && state.currentStudent.id && state.currentStudent.id < 0) {
        return { id: state.currentStudent.id, name: state.currentStudent.name || 'Основатель', type: 'student', displayName: state.currentStudent.name || 'Основатель' };
    }
    if (state.founderToggleMode && state.founderStudentData && state.founderStudentData.id) {
        return { id: state.founderStudentData.id, name: state.founderStudentData.name || 'Основатель', type: 'student', displayName: state.founderStudentData.name || 'Основатель' };
    }
    if (state.currentStudent && state.currentStudent.id) {
        return { id: state.currentStudent.id, name: state.currentStudent.name, type: 'student', displayName: state.currentStudent.name };
    }
    if (state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'founder')) {
        return { id: state.currentUser.id, name: state.currentUser.login, type: 'admin', displayName: state.currentUser.login + (state.currentUser.role === 'founder' ? ' (Основатель)' : ' (Админ)') };
    }
    return null;
}

export function getCurrentChatParticipantId() {
    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) return null;
    if (userInfo.type === 'admin') return -userInfo.id;
    return userInfo.id;
}

export function canUseMessenger() {
    if (state.currentStudent) return true;
    if (state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'founder')) return true;
    return false;
}

// ============================================================
// РЕНДЕР ТЕКСТА СООБЩЕНИЯ
// ============================================================
export function renderMessageText(text, fileUrl, fileName, fileSize, fileType, isForwarded, originalAuthor) {
    if (fileUrl === undefined) fileUrl = null;
    if (fileName === undefined) fileName = null;
    if (fileSize === undefined) fileSize = null;
    if (fileType === undefined) fileType = null;
    if (isForwarded === undefined) isForwarded = 0;
    if (originalAuthor === undefined) originalAuthor = null;
    if (!text) return '';

    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    const decodedText = textarea.value;

    let forwardedHtml = '';
    if (isForwarded && originalAuthor) {
        forwardedHtml = '<div class="forwarded-badge"><i class="fas fa-share"></i> Переслано от ' + escapeHtml(originalAuthor) + '</div>';
    }

    const fileMatch = decodedText.match(/\[FILE:(.+?)\|(.+?)\|(\d+)\]/);
    if (fileMatch) {
        const filePath = fileMatch[1];
        const originalName = fileMatch[2];
        const fileSizeBytes = parseInt(fileMatch[3]);
        const fullUrl = filePath.startsWith('http') ? filePath : '/' + filePath;
        const sizeDisplay = formatFileSizeDisplay(fileSizeBytes);
        const icon = getFileIconByName(originalName);
        return forwardedHtml + '<div class="message-file-container" onclick="downloadFile(\'' + fullUrl + '\', \'' + escapeHtml(originalName) + '\')">' +
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
        return forwardedHtml + '<div class="message-image-container"><img src="' + fullImageUrl + '?v=' + Date.now() + '" class="message-image" loading="lazy" onclick="openImageViewer(\'' + fullImageUrl + '\')" onerror="this.parentElement.innerHTML=\'<div class=\'message-image-error\'><i class=\'fas fa-image-slash\'></i> Изображение не загружено</div>\'"></div>';
    }

    let escaped = escapeHtml(decodedText).replace(/\n/g, '<br>');
    escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>');
    return forwardedHtml + escaped;
}

// ============================================================
// ЗАГРУЗКА СПИСКА ЧАТОВ
// ============================================================
export async function loadStudentChatsMessenger() {
    const messengerChatsList = document.getElementById('messengerChatsList');
    let chats = [];
    const userInfo = getCurrentChatUserInfo();

    if (!userInfo) {
        if (messengerChatsList) messengerChatsList.innerHTML = '<div class="empty-conversation"><i class="fas fa-comments"></i><p>Для использования мессенджера войдите как студент или администратор</p></div>';
        return;
    }

    if (userInfo.type === 'admin') {
        const response = await fetch(state.API_URL + '?endpoint=getAdminChats&admin_id=' + userInfo.id + '&t=' + Date.now());
        const data = await response.json();
        chats = data.success && data.data ? data.data : [];
    } else {
        chats = await apiCall('getStudentChats', 'GET', { student_id: userInfo.id });
    }

    if (!chats || !Array.isArray(chats) || chats.length === 0) {
        if (messengerChatsList) messengerChatsList.innerHTML = '<div class="empty-conversation"><i class="fas fa-comments"></i><p>У вас пока нет чатов</p><p style="font-size: 12px;">Найдите студентов или администраторов во вкладке "Люди" чтобы начать диалог</p></div>';
        return;
    }

    if (messengerChatsList) {
        let chatsHtml = '';
        for (let i = 0; i < chats.length; i++) {
            const chat = chats[i];
            if (!chat) continue;

            let avatarIcon = chat.type === 'group' ? '<i class="fas fa-users"></i>' : '<i class="fas fa-user-graduate"></i>';
            let avatarClass = chat.type === 'group' ? 'group' : '';
            const name = chat.type === 'group' ? (chat.name || 'Группа') : (chat.display_name || 'Чат');
            let lastMessage = chat.last_message || 'Нет сообщений';
            if (lastMessage.length > 40) lastMessage = lastMessage.substring(0, 40) + '...';

            const groupBadge = chat.type === 'group' ? '<span class="chat-group-badge"><i class="fas fa-users"></i> Группа</span>' : '';

            if (chat.is_admin_chat || (chat.display_name && (chat.display_name.indexOf('(Администратор)') !== -1 || chat.display_name.indexOf('(Основатель)') !== -1))) {
                avatarIcon = '<i class="fas fa-crown"></i>';
                avatarClass = 'admin-chat-avatar';
            }

            const unreadCount = chat.unread_count || 0;
            const unreadBadge = unreadCount > 0 ? '<span class="unread-count">' + unreadCount + '</span>' : '';
            const activeClass = (state.messengerCurrentChat && state.messengerCurrentChat.id === chat.id) ? 'active' : '';

            chatsHtml += '<div class="chat-item-messenger ' + activeClass + '" data-chat-id="' + chat.id + '" data-chat-type="' + chat.type + '" data-chat-name="' + escapeHtml(name) + '">' +
                '<div class="chat-avatar-messenger ' + avatarClass + '">' + avatarIcon + '</div>' +
                '<div class="chat-info-messenger">' +
                    '<div class="chat-name-messenger">' + escapeHtml(name) + ' ' + groupBadge + '</div>' +
                    '<div class="chat-last-message-messenger">' + escapeHtml(lastMessage) + '</div>' +
                '</div>' +
                '<div class="chat-time-messenger">' + (chat.last_message_time_formatted || '') + '</div>' +
                unreadBadge +
            '</div>';
        }

        const newContainer = document.createElement('div');
        newContainer.id = 'messengerChatsList';
        newContainer.className = 'messenger-chats-list';
        newContainer.innerHTML = chatsHtml;

        if (messengerChatsList.parentNode) {
            messengerChatsList.parentNode.replaceChild(newContainer, messengerChatsList);
        }

        newContainer.addEventListener('click', function(e) {
            const chatItem = e.target.closest('.chat-item-messenger');
            if (!chatItem) return;

            e.preventDefault();
            e.stopPropagation();

            if (state.isSelectingChat) return;

            const chatId = parseInt(chatItem.dataset.chatId);
            const chatType = chatItem.dataset.chatType;
            const chatName = chatItem.dataset.chatName;

            if (!isNaN(chatId) && chatType) {
                document.querySelectorAll('.chat-item-messenger').forEach(function(el) {
                    el.classList.remove('active');
                });
                chatItem.classList.add('active');
                selectChat(chatId, chatType, chatName);
            }
        });
    }
}

// ============================================================
// ВЫБОР ЧАТА
// ============================================================
export async function selectChat(chatId, chatType, chatName) {
    if (selectChatInProgress) return;
    if (state.messengerCurrentChat && state.messengerCurrentChat.id === chatId) return;

    if (!chatId || isNaN(chatId) || chatId <= 0) {
        showToast('Ошибка: неверный ID чата', 'error');
        return;
    }

    selectChatInProgress = true;
    state.isSelectingChat = true;

    try {
        stopMessengerPolling();

        state.messengerCurrentChat = {
            id: chatId,
            type: chatType || 'private',
            name: chatName || 'Чат'
        };
        state.messengerLastMessageId = 0;

        document.querySelectorAll('.chat-item-messenger').forEach(function(el) {
            if (parseInt(el.dataset.chatId) === chatId) el.classList.add('active');
            else el.classList.remove('active');
        });

        const messengerEmptyState = document.getElementById('messengerEmptyState');
        const messengerChatArea = document.getElementById('messengerChatArea');
        const messengerMessagesArea = document.getElementById('messengerMessagesArea');

        if (messengerEmptyState) {
            messengerEmptyState.style.display = 'none';
            messengerEmptyState.style.visibility = 'hidden';
        }
        if (messengerChatArea) {
            messengerChatArea.style.display = 'flex';
            messengerChatArea.style.visibility = 'visible';
            messengerChatArea.style.opacity = '1';
        }
        if (messengerMessagesArea) {
            messengerMessagesArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Загрузка сообщений...</div>';
            messengerMessagesArea.style.display = 'block';
        }

        await loadChatHeader(chatId, chatType);
        await loadChatMessages(chatId);
        startMessengerPolling(chatId);

        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.messenger-sidebar');
            const overlay = document.querySelector('.messenger-overlay');
            if (sidebar) {
                sidebar.classList.add('hidden-sidebar');
                sidebar.style.transform = 'translateX(-100%)';
            }
            if (overlay) overlay.classList.add('active');
        }
    } catch (e) {
        console.error('selectChat error:', e);
        showToast('Ошибка при открытии чата', 'error');
    } finally {
        setTimeout(function() {
            selectChatInProgress = false;
            state.isSelectingChat = false;
        }, 500);
    }
}

// ============================================================
// ЗАГРУЗКА ШАПКИ ЧАТА
// ============================================================
export async function loadChatHeader(chatId, chatType) {
    const messengerHeader = document.getElementById('messengerHeader');
    if (!messengerHeader) return;

    const userInfo = getCurrentChatUserInfo();
    const participantId = getCurrentChatParticipantId();

    const backBtn = document.getElementById('messengerBackBtn');
    if (backBtn) backBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';

    if (chatType === 'group') {
        const groupInfo = await apiCall('getGroupInfo', 'GET', { conversation_id: chatId, student_id: participantId });
        if (groupInfo) {
            state.messengerCurrentChat.name = groupInfo.name;
            state.messengerCurrentChat.isCreator = groupInfo.is_creator;
            state.messengerCurrentChat.memberCount = groupInfo.member_count;

            let actionButtons = '';
            if (groupInfo.is_creator || (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder())) {
                actionButtons += '<button class="messenger-action-btn" id="addAdminToGroupBtn"><i class="fas fa-user-shield"></i><span class="btn-label">Добавить админа</span></button>';
            }
            actionButtons += '<button class="messenger-action-btn" id="groupInfoBtn"><i class="fas fa-info-circle"></i><span class="btn-label">Инфо</span></button>';
            actionButtons += '<button class="messenger-action-btn danger" id="deleteConversationBtn"><i class="fas fa-trash"></i><span class="btn-label">Удалить</span></button>';

            const headerInfo = messengerHeader.querySelector('.messenger-header-info');
            const headerActions = messengerHeader.querySelector('.messenger-actions');

            if (headerInfo) {
                headerInfo.innerHTML = '<div class="messenger-header-avatar"><i class="fas fa-users"></i></div>' +
                    '<div class="messenger-header-details">' +
                        '<div class="messenger-header-name">' + escapeHtml(groupInfo.name) + '</div>' +
                        '<div class="messenger-header-status">' + groupInfo.member_count + ' участников</div>' +
                    '</div>';
            }
            if (headerActions) headerActions.innerHTML = actionButtons;

            const groupInfoBtn = document.getElementById('groupInfoBtn');
            if (groupInfoBtn) groupInfoBtn.addEventListener('click', function() { showGroupInfo(chatId); });
            const deleteConversationBtn = document.getElementById('deleteConversationBtn');
            if (deleteConversationBtn) deleteConversationBtn.addEventListener('click', function() { deleteConversation(chatId); });
            const addAdminToGroupBtn = document.getElementById('addAdminToGroupBtn');
            if (addAdminToGroupBtn) addAdminToGroupBtn.addEventListener('click', function() { showAddAdminToGroupModal(chatId); });
        }
    } else {
        const participants = await apiCall('getChatParticipants', 'GET', { conversation_id: chatId, student_id: participantId });
        let otherName = 'Пользователь';
        let otherGroup = '';
        let isAdminChat = false;

        if (participants && participants.length) {
            let other = null;
            for (let p = 0; p < participants.length; p++) {
                if (participants[p].id !== participantId) {
                    other = participants[p];
                    break;
                }
            }
            if (other) {
                otherName = other.name;
                otherGroup = other.group_name || 'Студент';
                if (other.user_type === 'admin' || (other.id && other.id < 0)) isAdminChat = true;
            }
        }

        const headerInfo = messengerHeader.querySelector('.messenger-header-info');
        const headerActions = messengerHeader.querySelector('.messenger-actions');

        if (headerInfo) {
            headerInfo.innerHTML = '<div class="messenger-header-avatar ' + (isAdminChat ? 'admin-chat-avatar' : '') + '">' +
                '<i class="fas ' + (isAdminChat ? 'fa-crown' : 'fa-user-graduate') + '"></i>' +
            '</div>' +
            '<div class="messenger-header-details">' +
                '<div class="messenger-header-name">' + escapeHtml(otherName) + '</div>' +
                '<div class="messenger-header-status">' + escapeHtml(otherGroup) + '</div>' +
            '</div>';
        }
        if (headerActions) {
            headerActions.innerHTML = '<button class="messenger-action-btn danger" id="deleteConversationBtn"><i class="fas fa-trash"></i><span class="btn-label">Удалить</span></button>';
        }
        const deleteBtn = document.getElementById('deleteConversationBtn');
        if (deleteBtn) deleteBtn.addEventListener('click', function() { deleteConversation(chatId); });
    }
}

// ============================================================
// ЗАГРУЗКА СООБЩЕНИЙ
// ============================================================
export async function loadChatMessages(chatId) {
    const messengerMessagesArea = document.getElementById('messengerMessagesArea');
    if (!messengerMessagesArea) return;

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) {
        messengerMessagesArea.innerHTML = '<div class="empty-conversation"><i class="fas fa-exclamation-triangle"></i><p>Не удалось определить пользователя</p></div>';
        return;
    }

    try {
        const url = state.API_URL + '?endpoint=getChatMessages&conversation_id=' + chatId + '&student_id=' + userInfo.id + '&user_type=' + userInfo.type + '&limit=100&t=' + Date.now();
        const response = await fetch(url);
        const text = await response.text();

        if (text.trim().startsWith('<')) {
            messengerMessagesArea.innerHTML = '<div class="empty-conversation"><i class="fas fa-exclamation-triangle"></i><p>Ошибка сервера</p></div>';
            return;
        }

        let data;
        try { data = JSON.parse(text); } catch (e) {
            messengerMessagesArea.innerHTML = '<div class="empty-conversation"><i class="fas fa-exclamation-triangle"></i><p>Ошибка формата данных</p></div>';
            return;
        }

        if (!data.success) {
            messengerMessagesArea.innerHTML = '<div class="empty-conversation"><i class="fas fa-exclamation-triangle"></i><p>Ошибка: ' + (data.error || 'Неизвестная ошибка') + '</p></div>';
            return;
        }

        const messages = data.data;
        if (!messages || messages.length === 0) {
            messengerMessagesArea.innerHTML = '<div class="empty-conversation"><i class="fas fa-comment-dots"></i><p>Напишите первое сообщение!</p></div>';
            state.messengerLastMessageId = 0;
            return;
        }

        let maxMsgId = 0;
        for (let mi = 0; mi < messages.length; mi++) {
            if (messages[mi].id > maxMsgId) maxMsgId = messages[mi].id;
        }
        state.messengerLastMessageId = maxMsgId;

        let html = '';
        let lastDate = '';

        for (let mIdx = 0; mIdx < messages.length; mIdx++) {
            const msg = messages[mIdx];
            let date = '';
            if (msg.created_at) date = new Date(msg.created_at).toLocaleDateString('ru-RU');

            if (date && date !== lastDate) {
                html += '<div class="message-system"><span>' + date + '</span></div>';
                lastDate = date;
            }

            const isOwn = (userInfo.type === 'admin' && msg.student_id === -userInfo.id) || (userInfo.type === 'student' && msg.student_id === userInfo.id);
            const isSystem = msg.student_id === 0 || msg.student_name === 'System';
            let time = '';
            if (msg.created_at) time = new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

            const editedBadge = msg.is_edited ? '<span class="edited-badge">(ред.)</span>' : '';

            if (isSystem) {
                const textarea = document.createElement('textarea');
                textarea.innerHTML = msg.text;
                html += '<div class="message-system"><span>' + escapeHtml(textarea.value) + '</span></div>';
            } else {
                let actionsHtml = '';
                if (isOwn || (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder())) {
                    const canEdit = isOwn && !msg.is_forwarded;
                    actionsHtml = '<div class="message-actions">' +
                        (canEdit ? '<button class="message-action-btn edit" onclick="event.stopPropagation(); editChatMessage(' + msg.id + ', \'' + escapeHtml(msg.text).replace(/'/g, "\\'") + '\')" title="Редактировать"><i class="fas fa-pen"></i></button>' : '') +
                        '<button class="message-action-btn forward" onclick="event.stopPropagation(); showForwardModal(' + msg.id + ', \'' + escapeHtml(msg.text).replace(/'/g, "\\'") + '\', \'' + escapeHtml(msg.student_name) + '\', ' + state.messengerCurrentChat.id + ')" title="Переслать"><i class="fas fa-share"></i></button>' +
                        ((isOwn || (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder())) && !msg.is_forwarded ? '<button class="message-action-btn delete" onclick="event.stopPropagation(); deleteChatMessage(' + msg.id + ')" title="Удалить"><i class="fas fa-trash"></i></button>' : '') +
                    '</div>';
                } else {
                    actionsHtml = '<div class="message-actions">' +
                        '<button class="message-action-btn forward" onclick="event.stopPropagation(); showForwardModal(' + msg.id + ', \'' + escapeHtml(msg.text).replace(/'/g, "\\'") + '\', \'' + escapeHtml(msg.student_name) + '\', ' + state.messengerCurrentChat.id + ')" title="Переслать"><i class="fas fa-share"></i></button>' +
                    '</div>';
                }

                let titleBadge = '';
                if (msg.title && msg.title.title_name) {
                    titleBadge = '<span class="chat-title-badge ' + (msg.title.title_rarity || 'common') + '" style="color:' + (msg.title.title_color || '#fff') + ';">' + (msg.title.title_icon || '🏷️') + ' ' + escapeHtml(msg.title.title_name) + '</span>';
                }

                let authorName = msg.student_name;
                if (msg.student_id < 0 && authorName.indexOf('(Админ)') === -1 && authorName.indexOf('(Основатель)') === -1) {
                    authorName = authorName + (msg.student_id === -1 ? ' (Основатель)' : ' (Админ)');
                }

                const messageHtml = renderMessageText(msg.text, msg.file_url, msg.file_name, msg.file_size, msg.file_type, msg.is_forwarded, msg.original_author);

                html += '<div class="message-item ' + (isOwn ? 'own' : 'other') + '" data-message-id="' + msg.id + '">' +
                    '<div class="message-bubble-messenger">' +
                        (!isOwn ? '<div class="message-author"><span class="message-author-name">' + escapeHtml(authorName) + '</span> ' + titleBadge + '</div>' : '') +
                        '<div class="message-text">' + messageHtml + ' ' + editedBadge + '</div>' +
                        '<div class="message-time">' + time + ' ' + actionsHtml + '</div>' +
                    '</div>' +
                '</div>';
            }
        }
        messengerMessagesArea.innerHTML = html;
        setTimeout(function() {
            if (messengerMessagesArea) messengerMessagesArea.scrollTop = messengerMessagesArea.scrollHeight;
        }, 100);
    } catch (e) {
        console.error('loadChatMessages error:', e);
        messengerMessagesArea.innerHTML = '<div class="empty-conversation"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки сообщений</p></div>';
    }
}

// ============================================================
// ОТПРАВКА СООБЩЕНИЯ (с защитой от дублирования)
// ============================================================
export async function sendChatMessage() {
    // ⚡ Защита от двойной отправки
    if (sendInProgress) return;

    const messengerInput = document.getElementById('messengerInput');
    const text = messengerInput ? messengerInput.value.trim() : '';
    if (!text || !state.messengerCurrentChat) return;

    if (text.length > 2000) {
        showToast('Сообщение слишком длинное', 'error');
        return;
    }
    if (containsProfanity(text)) {
        showToast('❌ Сообщение содержит запрещённые слова', 'error');
        return;
    }

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) {
        showToast('Не удалось определить отправителя', 'error');
        return;
    }

    // Блокируем повторные вызовы
    sendInProgress = true;

    const btn = document.getElementById('messengerSendBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        const result = await apiCall('sendChatMessage', 'POST', {
            conversation_id: state.messengerCurrentChat.id,
            student_id: userInfo.id,
            student_name: userInfo.displayName,
            sender_type: userInfo.type,
            text: text
        });

        if (result) {
            if (messengerInput) {
                messengerInput.value = '';
                messengerInput.style.height = 'auto';
            }
            state.messengerLastMessageId = 0;
            await loadChatMessages(state.messengerCurrentChat.id);
            await loadStudentChatsMessenger();
        } else {
            showToast('Ошибка при отправке сообщения', 'error');
        }
    } catch (e) {
        console.error('sendChatMessage error:', e);
        showToast('Ошибка при отправке сообщения', 'error');
    } finally {
        // Разблокируем с небольшой задержкой
        setTimeout(function() {
            sendInProgress = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        }, 300);
    }
}

// ============================================================
// РЕДАКТИРОВАНИЕ СООБЩЕНИЯ
// ============================================================
export async function editChatMessage(messageId, oldText) {
    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) {
        showToast('Не удалось определить пользователя', 'error');
        return;
    }

    try {
        const infoResponse = await fetch(state.API_URL + '?endpoint=getChatMessageInfo&message_id=' + messageId + '&t=' + Date.now());
        const infoData = await infoResponse.json();
        if (infoData.success && infoData.data && infoData.data.is_forwarded) {
            showToast('❌ Пересланные сообщения нельзя редактировать', 'error');
            return;
        }

        const newText = prompt('Редактировать сообщение:', oldText);
        if (!newText || newText === oldText) return;
        if (newText.length > 2000) { showToast('Сообщение слишком длинное', 'error'); return; }
        if (containsProfanity(newText)) { showToast('❌ Сообщение содержит запрещённые слова', 'error'); return; }

        const result = await apiCall('editChatMessage', 'POST', {
            message_id: messageId,
            student_id: userInfo.id,
            text: newText,
            user_login: userInfo.displayName
        });

        if (result) {
            showToast('✅ Сообщение изменено', 'success');
            await loadChatMessages(state.messengerCurrentChat.id);
            await loadStudentChatsMessenger();
            state.messengerLastMessageId = 0;
        } else {
            showToast('❌ Не удалось изменить сообщение', 'error');
        }
    } catch (e) {
        console.error('Edit message error:', e);
        showToast('❌ Ошибка при проверке сообщения', 'error');
    }
}

// ============================================================
// УДАЛЕНИЕ СООБЩЕНИЯ
// ============================================================
export async function deleteChatMessage(messageId) {
    try {
        const infoResponse = await fetch(state.API_URL + '?endpoint=getChatMessageInfo&message_id=' + messageId + '&t=' + Date.now());
        const infoData = await infoResponse.json();
        if (infoData.success && infoData.data && infoData.data.is_forwarded) {
            const isAdminFlag = (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder()) ? 1 : 0;
            if (!isAdminFlag) { showToast('❌ Пересланные сообщения нельзя удалять', 'error'); return; }
        }
    } catch (e) { /* ignore */ }

    if (!confirm('Удалить это сообщение?')) return;

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) return;

    const isAdminFlag = (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder()) ? 1 : 0;

    const result = await apiCall('deleteChatMessage', 'POST', {
        message_id: messageId,
        student_id: userInfo.id,
        is_admin: isAdminFlag
    });

    if (result) {
        showToast('🗑️ Сообщение удалено', 'success');
        await loadChatMessages(state.messengerCurrentChat.id);
        await loadStudentChatsMessenger();
        state.messengerLastMessageId = 0;
    } else {
        showToast('❌ Не удалось удалить сообщение', 'error');
    }
}

// ============================================================
// УДАЛЕНИЕ ЧАТА
// ============================================================
export async function deleteConversation(conversationId) {
    if (!confirm('⚠️ ВНИМАНИЕ! Это действие удалит всю переписку. Вы уверены?')) return;

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) { showToast('Не удалось определить пользователя', 'error'); return; }

    let participantId = userInfo.id;
    if (userInfo.type === 'admin') participantId = -userInfo.id;

    const isAdminFlag = (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder()) ? 1 : 0;

    const result = await apiCall('deleteConversation', 'POST', {
        conversation_id: conversationId,
        student_id: participantId,
        is_admin: isAdminFlag
    });

    if (result) {
        if (result.left) showToast('🚪 Вы покинули чат', 'info');
        else showToast('✅ Чат удален', 'success');

        state.messengerCurrentChat = null;
        const messengerChatArea = document.getElementById('messengerChatArea');
        const messengerEmptyState = document.getElementById('messengerEmptyState');
        if (messengerChatArea) messengerChatArea.style.display = 'none';
        if (messengerEmptyState) messengerEmptyState.style.display = 'flex';
        stopMessengerPolling();

        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.messenger-sidebar');
            const overlay = document.querySelector('.messenger-overlay');
            if (sidebar) sidebar.classList.remove('hidden-sidebar');
            if (overlay) overlay.classList.remove('active');
        }
        await loadStudentChatsMessenger();
    } else {
        showToast('❌ Не удалось удалить чат', 'error');
    }
}

// ============================================================
// ПОИСК ЛЮДЕЙ
// ============================================================
export async function searchPeopleWithAdmins(searchTerm) {
    if (searchTerm === undefined) searchTerm = '';
    const peopleSearchList = document.getElementById('peopleSearchList');
    if (!peopleSearchList) return;

    const currentUserInfo = getCurrentChatUserInfo();
    if (!currentUserInfo) {
        peopleSearchList.innerHTML = '<div class="empty-conversation"><i class="fas fa-exclamation-triangle"></i><p>Не удалось определить пользователя</p></div>';
        return;
    }

    try {
        const users = await getAllUsersForChat(searchTerm || '');
        if (!users || users.length === 0) {
            peopleSearchList.innerHTML = '<div class="empty-conversation"><i class="fas fa-user-friends"></i><p>Никого не найдено</p></div>';
            return;
        }

        let usersHtml = '';
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const isAdmin = user.user_type === 'admin';
            const avatarIcon = isAdmin ? '<i class="fas fa-crown"></i>' : '<i class="fas fa-user-graduate"></i>';
            const avatarClass = isAdmin ? 'admin-avatar' : '';

            const isSelf = (currentUserInfo.type === 'admin' && currentUserInfo.id === Math.abs(user.id)) ||
                          (currentUserInfo.type === 'student' && currentUserInfo.id === user.id);
            if (isSelf) continue;

            usersHtml += '<div class="person-item" data-user-id="' + user.id + '" data-user-name="' + escapeHtml(user.name) + '" data-user-type="' + user.user_type + '" style="cursor: pointer;">' +
                '<div class="person-avatar ' + avatarClass + '">' + avatarIcon + '</div>' +
                '<div class="person-info">' +
                    '<div class="person-name">' + escapeHtml(user.name) + '</div>' +
                    '<div class="person-group">' + escapeHtml(user.group_name || (isAdmin ? 'Администратор' : 'Студент')) + '</div>' +
                '</div>' +
            '</div>';
        }
        peopleSearchList.innerHTML = usersHtml;

        const personItems = document.querySelectorAll('.person-item');
        for (let j = 0; j < personItems.length; j++) {
            personItems[j].addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (state.isSelectingChat) return;

                const userId = parseInt(this.dataset.userId);
                const userName = this.dataset.userName;
                const userType = this.dataset.userType;

                if (!isNaN(userId)) {
                    showToast('💬 Создание чата с ' + userName + '...', 'info');
                    startChatWithUser(userId, userName, userType);
                }
            });
        }
    } catch (e) {
        console.error('searchPeople error:', e);
        peopleSearchList.innerHTML = '<div class="empty-conversation"><i class="fas fa-exclamation-triangle"></i><p>Ошибка поиска</p></div>';
    }
}

export async function getAllUsersForChat(searchTerm) {
    if (searchTerm === undefined) searchTerm = '';
    const currentUserInfo = getCurrentChatUserInfo();
    if (!currentUserInfo) return [];

    const response = await fetch(state.API_URL + '?endpoint=getAllUsersForChat&student_id=' + currentUserInfo.id + '&search=' + encodeURIComponent(searchTerm) + '&include_admins=true&t=' + Date.now());
    const data = await response.json();
    if (data.success && data.data) return data.data;
    return [];
}

export async function getOrCreateChat(targetUserId, targetUserType) {
    const currentUserInfo = getCurrentChatUserInfo();
    if (!currentUserInfo) {
        showToast('Не удалось определить пользователя', 'error');
        return null;
    }
    return await apiCall('getOrCreateChat', 'POST', {
        user_id: currentUserInfo.id,
        target_user_id: targetUserId,
        current_user_type: currentUserInfo.type,
        target_user_type: targetUserType
    });
}

export async function startChatWithUser(userId, userName, userType) {
    if (state.isSelectingChat) return;
    state.isSelectingChat = true;

    try {
        const result = await getOrCreateChat(userId, userType);
        if (result && result.id) {
            showToast('✅ Чат с ' + userName + ' создан!', 'success');
            await loadStudentChatsMessenger();
            selectChat(result.id, result.type || 'private', userName);
            switchMessengerTab('chats');
        } else {
            showToast('❌ Не удалось создать чат с ' + userName, 'error');
        }
    } catch (e) {
        console.error('startChatWithUser error:', e);
        showToast('❌ Ошибка при создании чата', 'error');
    } finally {
        setTimeout(function() { state.isSelectingChat = false; }, 500);
    }
}

// ============================================================
// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ============================================================
export function switchMessengerTab(tab) {
    state.messengerCurrentTab = tab;
    const tabs = document.querySelectorAll('.messenger-tab');
    for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].dataset.tab === tab) tabs[i].classList.add('active');
        else tabs[i].classList.remove('active');
    }

    const messengerChatsList = document.getElementById('messengerChatsList');
    const peopleSearchList = document.getElementById('peopleSearchList');

    if (tab === 'chats') {
        if (messengerChatsList) messengerChatsList.style.display = 'block';
        if (peopleSearchList) peopleSearchList.style.display = 'none';
        if (!state.messengerCurrentChat) loadStudentChatsMessenger();
    } else {
        if (messengerChatsList) messengerChatsList.style.display = 'none';
        if (peopleSearchList) peopleSearchList.style.display = 'block';
        searchPeopleWithAdmins('');
    }
}

// ============================================================
// POLLING
// ============================================================
export function startMessengerPolling(chatId) {
    if (state.messengerPollingInterval) {
        clearTimeout(state.messengerPollingInterval);
        state.messengerPollingInterval = null;
    }
    const currentPollingId = chatId;
    let isActive = true;

    async function poll() {
        if (!isActive) return;
        if (!state.messengerCurrentChat || state.messengerCurrentChat.id !== currentPollingId) {
            isActive = false;
            return;
        }
        try {
            const userInfo = getCurrentChatUserInfo();
            if (!userInfo) return;
            const response = await fetch(state.API_URL + '?endpoint=getNewChatMessages&conversation_id=' + currentPollingId + '&student_id=' + userInfo.id + '&user_type=' + userInfo.type + '&last_id=' + state.messengerLastMessageId + '&t=' + Date.now());
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
                let maxId = state.messengerLastMessageId;
                for (let mi = 0; mi < data.data.length; mi++) {
                    if (data.data[mi].id > maxId) maxId = data.data[mi].id;
                }
                state.messengerLastMessageId = maxId;
                await loadChatMessages(currentPollingId);
                await loadStudentChatsMessenger();
            }
        } catch (e) {
            console.log('Messenger polling error:', e);
        }
        if (isActive && state.messengerCurrentChat && state.messengerCurrentChat.id === currentPollingId) {
            state.messengerPollingInterval = setTimeout(poll, 10000);
        }
    }
    state.messengerPollingInterval = true;
    isActive = true;
    poll();
}

export function stopMessengerPolling() {
    if (state.messengerPollingInterval) {
        clearTimeout(state.messengerPollingInterval);
        state.messengerPollingInterval = null;
    }
}

// ============================================================
// POLLING ОБНОВЛЕНИЙ
// ============================================================
export async function pollMessengerUpdates() {
    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) {
        if (state.messengerUpdatesPollingInterval) {
            state.messengerUpdatesPollingInterval = setTimeout(pollMessengerUpdates, 10000);
        }
        return;
    }

    try {
        const response = await fetch(state.API_URL + '?endpoint=getMessengerUpdates&user_id=' + userInfo.id + '&user_type=' + userInfo.type + '&last_update_id=' + state.messengerLastUpdateId + '&t=' + Date.now());
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            let maxId = state.messengerLastUpdateId;
            for (let i = 0; i < data.data.length; i++) {
                if (data.data[i].id > maxId) maxId = data.data[i].id;
            }
            state.messengerLastUpdateId = maxId;

            let needRefresh = false;
            let needCloseChat = false;
            let chatIdToClose = null;

            for (let j = 0; j < data.data.length; j++) {
                const update = data.data[j];

                if (update.update_type === 'deleted' || update.update_type === 'left') {
                    if (state.messengerCurrentChat && state.messengerCurrentChat.id == update.conversation_id) {
                        needCloseChat = true;
                        chatIdToClose = update.conversation_id;
                        showToast('💬 Чат был удален или вы покинули его', 'warning');
                    }
                    needRefresh = true;
                }

                if (update.update_type === 'participant_left' || update.update_type === 'participant_removed' ||
                    update.update_type === 'participants_added' || update.update_type === 'renamed') {
                    needRefresh = true;
                }

                if (update.update_type === 'added_to_group') {
                    showToast('👋 Вы были добавлены в новую группу!', 'success');
                    needRefresh = true;
                }

                if (update.update_type === 'removed_from_group') {
                    showToast('⚠️ Вы были исключены из группы', 'warning');
                    if (state.messengerCurrentChat && state.messengerCurrentChat.id == update.conversation_id) {
                        needCloseChat = true;
                        chatIdToClose = update.conversation_id;
                    }
                    needRefresh = true;
                }

                if (update.update_type === 'message_deleted' && state.messengerCurrentChat && state.messengerCurrentChat.id == update.conversation_id) {
                    state.messengerLastMessageId = 0;
                    await loadChatMessages(update.conversation_id);
                }
            }

            if (needCloseChat && chatIdToClose) {
                state.messengerCurrentChat = null;
                const messengerChatArea = document.getElementById('messengerChatArea');
                const messengerEmptyState = document.getElementById('messengerEmptyState');
                if (messengerChatArea) messengerChatArea.style.display = 'none';
                if (messengerEmptyState) messengerEmptyState.style.display = 'flex';
                stopMessengerPolling();
            }

            if (needRefresh) await loadStudentChatsMessenger();
        }
    } catch (e) {
        console.log('Messenger updates polling error:', e);
    }

    if (state.messengerUpdatesPollingInterval) {
        state.messengerUpdatesPollingInterval = setTimeout(pollMessengerUpdates, 10000);
    }
}

export function startMessengerUpdatesPolling() {
    if (state.messengerUpdatesPollingInterval) return;
    state.messengerUpdatesPollingInterval = true;
    state.messengerLastUpdateId = 0;
    pollMessengerUpdates();
}

export function stopMessengerUpdatesPolling() {
    if (state.messengerUpdatesPollingInterval) {
        clearTimeout(state.messengerUpdatesPollingInterval);
        state.messengerUpdatesPollingInterval = null;
    }
}

// ============================================================
// ИНФОРМАЦИЯ О ГРУППЕ (модалка)
// ============================================================
export async function showGroupInfo(chatId) {
    const participantId = getCurrentChatParticipantId();
    const groupInfo = await apiCall('getGroupInfo', 'GET', { conversation_id: chatId, student_id: participantId });
    if (!groupInfo) return;

    const isCreator = groupInfo.is_creator;
    const isAdmin = typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder();
    const canRename = isCreator || isAdmin;

    const body = document.getElementById('groupInfoBody');
    if (!body) return;

    let participantsHtml = '';
    for (let i = 0; i < groupInfo.participants.length; i++) {
        const p = groupInfo.participants[i];
        participantsHtml += '<div class="member-list-item">' +
            '<div class="person-avatar" style="width:36px;height:36px;font-size:14px;"><i class="fas fa-user-graduate"></i></div>' +
            '<div style="flex:1;">' +
                '<div>' + escapeHtml(p.name) + (p.id === groupInfo.created_by ? ' <span class="member-creator-badge">Создатель</span>' : '') + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + escapeHtml(p.group_name || 'Без группы') + '</div>' +
            '</div>' +
            ((isCreator && p.id !== groupInfo.created_by && p.id !== participantId) ? '<button class="action-btn delete" style="padding: 6px 12px;" onclick="removeParticipantFromGroup(' + chatId + ', ' + p.id + ', \'' + escapeHtml(p.name) + '\')"><i class="fas fa-user-minus"></i> Исключить</button>' : '') +
        '</div>';
    }

    body.innerHTML = '<div style="text-align:center;margin-bottom:20px;">' +
        '<div style="width:80px;height:80px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:36px;"><i class="fas fa-users"></i></div>' +
        '<h3 style="margin-bottom:8px;" id="groupNameDisplay">' + escapeHtml(groupInfo.name) + '</h3>' +
        (canRename ? '<button class="btn-small" id="renameGroupBtn" style="margin-top:8px;"><i class="fas fa-pen"></i> Переименовать</button>' : '') +
        '<p style="color:var(--text-muted); margin-top:12px;">' + groupInfo.member_count + ' участников</p>' +
    '</div>' +
    '<div style="border-top:1px solid var(--border-color);padding-top:16px;">' +
        '<h4 style="margin-bottom:12px;">Участники</h4>' +
        '<div style="max-height:300px;overflow-y:auto;">' + participantsHtml + '</div>' +
    '</div>';

    const renameBtn = document.getElementById('renameGroupBtn');
    if (renameBtn) {
        renameBtn.onclick = function() {
            const currentNameElem = document.getElementById('groupNameDisplay');
            const currentName = currentNameElem ? currentNameElem.textContent : '';
            const newName = prompt('Введите новое название группы:', currentName);
            if (newName && newName !== currentName) {
                renameGroup(chatId, newName).then(function(success) {
                    if (success) {
                        if (typeof window.closeModal === 'function') window.closeModal('groupInfoModal');
                        setTimeout(function() { showGroupInfo(chatId); }, 500);
                    }
                });
            }
        };
    }
    const leaveBtn = document.getElementById('leaveGroupBtn');
    if (leaveBtn) {
        leaveBtn.style.display = isCreator ? 'none' : 'inline-flex';
        leaveBtn.onclick = function() {
            if (typeof window.closeModal === 'function') window.closeModal('groupInfoModal');
            leaveGroup(chatId);
        };
    }
    const addBtn = document.getElementById('addMembersBtn');
    if (addBtn && (isCreator || isAdmin)) {
        addBtn.style.display = 'inline-flex';
        addBtn.onclick = function() {
            if (typeof window.closeModal === 'function') window.closeModal('groupInfoModal');
            showAddMembersModal(chatId);
        };
    } else if (addBtn) {
        addBtn.style.display = 'none';
    }
    if (typeof window.showModal === 'function') window.showModal('groupInfoModal');
}

// ============================================================
// ПЕРЕИМЕНОВАНИЕ ГРУППЫ
// ============================================================
export async function renameGroup(conversationId, newName) {
    if (!newName || newName.trim() === '') {
        showToast('Введите новое название группы', 'error');
        return false;
    }

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) return false;

    let participantId = userInfo.id;
    if (userInfo.type === 'admin') participantId = -userInfo.id;

    const result = await apiCall('renameGroup', 'POST', {
        conversation_id: conversationId,
        student_id: participantId,
        new_name: newName.trim()
    });

    if (result) {
        showToast('✅ Группа переименована', 'success');
        if (state.messengerCurrentChat && state.messengerCurrentChat.id === conversationId) {
            state.messengerCurrentChat.name = newName;
            await loadChatHeader(conversationId, 'group');
        }
        await loadStudentChatsMessenger();
        return true;
    }
    return false;
}

// ============================================================
// ИСКЛЮЧЕНИЕ УЧАСТНИКА
// ============================================================
export async function removeParticipantFromGroup(conversationId, targetStudentId, targetName) {
    if (!confirm('Исключить ' + targetName + ' из группы?')) return;

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) return;

    let participantId = userInfo.id;
    if (userInfo.type === 'admin') participantId = -userInfo.id;

    const result = await apiCall('removeGroupParticipant', 'POST', {
        conversation_id: conversationId,
        student_id: participantId,
        target_student_id: targetStudentId
    });

    if (result) {
        showToast('✅ ' + targetName + ' исключен из группы', 'success');
        await loadChatMessages(conversationId);
        await loadStudentChatsMessenger();
        if (typeof window.closeModal === 'function') window.closeModal('groupInfoModal');
    }
}

// ============================================================
// ПОКИНУТЬ ГРУППУ
// ============================================================
export async function leaveGroup(chatId) {
    if (!confirm('Вы уверены, что хотите покинуть группу?')) return;

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) return;

    let participantId = userInfo.id;
    if (userInfo.type === 'admin') participantId = -userInfo.id;

    const result = await apiCall('leaveGroup', 'POST', {
        conversation_id: chatId,
        student_id: participantId
    });

    if (result) {
        if (result.deleted) showToast('Группа удалена, так как вы были создателем', 'warning');
        else showToast('Вы покинули группу', 'info');

        state.messengerCurrentChat = null;
        const messengerChatArea = document.getElementById('messengerChatArea');
        const messengerEmptyState = document.getElementById('messengerEmptyState');
        if (messengerChatArea) messengerChatArea.style.display = 'none';
        if (messengerEmptyState) messengerEmptyState.style.display = 'flex';
        stopMessengerPolling();

        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.messenger-sidebar');
            const overlay = document.querySelector('.messenger-overlay');
            if (sidebar) sidebar.classList.remove('hidden-sidebar');
            if (overlay) overlay.classList.remove('active');
        }
        await loadStudentChatsMessenger();
    }
}

// ============================================================
// ДОБАВЛЕНИЕ УЧАСТНИКОВ (модалка)
// ============================================================
export async function showAddMembersModal(chatId) {
    const participantId = getCurrentChatParticipantId();
    const modal = document.getElementById('addMembersModal');
    if (!modal) return;

    const searchInput = modal.querySelector('#addMembersSearch');
    const listContainer = document.getElementById('addMembersList');
    if (!listContainer) return;

    async function loadAvailableUsers(searchTerm) {
        if (searchTerm === undefined) searchTerm = '';
        listContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';
        try {
            const url = state.API_URL + '?endpoint=searchStudentsToAdd&conversation_id=' + chatId + '&current_user_id=' + participantId + '&search=' + encodeURIComponent(searchTerm) + '&t=' + Date.now();
            const response = await fetch(url);
            const data = await response.json();

            if (data.success && data.data && data.data.length > 0) {
                let usersHtml = '';
                for (let u = 0; u < data.data.length; u++) {
                    const user = data.data[u];
                    const isAdmin = user.user_type === 'admin';
                    const avatarIcon = isAdmin ? '<i class="fas fa-crown"></i>' : '<i class="fas fa-user-graduate"></i>';
                    const avatarClass = isAdmin ? 'admin-avatar' : '';
                    usersHtml += '<div class="participant-select-item" data-user-id="' + user.id + '" data-user-type="' + user.user_type + '">' +
                        '<div class="person-avatar ' + avatarClass + '" style="width:40px;height:40px;">' + avatarIcon + '</div>' +
                        '<div class="person-info">' +
                            '<div class="person-name">' + escapeHtml(user.name) + '</div>' +
                            '<div class="person-group">' + escapeHtml(user.group_name || (isAdmin ? 'Администратор' : 'Студент')) + '</div>' +
                        '</div>' +
                        '<input type="checkbox" class="participant-select-checkbox" value="' + user.id + '" data-user-type="' + user.user_type + '">' +
                    '</div>';
                }
                listContainer.innerHTML = usersHtml;
            } else {
                listContainer.innerHTML = '<div class="empty-conversation"><i class="fas fa-user-friends"></i><p>Нет доступных участников для добавления</p></div>';
            }
        } catch (e) {
            console.error('Load users error:', e);
            listContainer.innerHTML = '<div class="empty-conversation"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки</p></div>';
        }
    }

    if (searchInput) {
        let searchTimeout;
        searchInput.value = '';
        searchInput.oninput = function(e) {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() { loadAvailableUsers(e.target.value); }, 300);
        };
    }

    await loadAvailableUsers('');

    const confirmBtn = document.getElementById('confirmAddMembersBtn');
    if (confirmBtn) {
        confirmBtn.dataset.chatId = chatId;
        confirmBtn.onclick = async function() {
            const checkboxes = document.querySelectorAll('#addMembersList .participant-select-checkbox:checked');
            const participants = [];
            for (let cb = 0; cb < checkboxes.length; cb++) {
                participants.push(parseInt(checkboxes[cb].value));
            }
            if (participants.length === 0) { showToast('Выберите участников', 'error'); return; }

            const result = await apiCall('addGroupParticipants', 'POST', {
                conversation_id: chatId,
                student_id: participantId,
                participants: participants
            });
            if (result) {
                showToast('✅ Участники добавлены', 'success');
                if (typeof window.closeModal === 'function') window.closeModal('addMembersModal');
                await loadChatMessages(chatId);
                await loadStudentChatsMessenger();
            }
        };
    }
    if (typeof window.showModal === 'function') window.showModal('addMembersModal');
}

// ============================================================
// СОЗДАНИЕ ГРУППЫ
// ============================================================
export async function showCreateGroupModal() {
    const participantId = getCurrentChatParticipantId();
    if (!participantId) {
        showToast('Для создания группы нужен студенческий аккаунт или ID администратора', 'error');
        return;
    }

    const students = await apiCall('getAllStudentsForChat', 'GET', { student_id: participantId });
    const container = document.getElementById('groupParticipantsList');
    if (!container) return;

    let studentsHtml = '';
    if (students && students.length) {
        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            studentsHtml += '<div class="participant-select-item" data-student-id="' + student.id + '" data-student-name="' + escapeHtml(student.name) + '">' +
                '<div class="person-avatar" style="width:40px;height:40px;font-size:16px;"><i class="fas fa-user-graduate"></i></div>' +
                '<div class="person-info">' +
                    '<div class="person-name">' + escapeHtml(student.name) + '</div>' +
                    '<div class="person-group">' + escapeHtml(student.group_name || 'Без группы') + '</div>' +
                '</div>' +
                '<input type="checkbox" class="participant-select-checkbox" value="' + student.id + '">' +
            '</div>';
        }
    } else {
        studentsHtml = '<div class="empty-conversation"><i class="fas fa-users"></i><p>Нет доступных студентов</p></div>';
    }
    container.innerHTML = studentsHtml;
    if (typeof window.showModal === 'function') window.showModal('createGroupModal');
}

export async function createGroupChat() {
    const nameElem = document.getElementById('groupNameInput');
    const name = nameElem ? nameElem.value.trim() : '';
    if (!name) { showToast('Введите название группы', 'error'); return; }

    const checkboxes = document.querySelectorAll('#groupParticipantsList .participant-select-checkbox:checked');
    const participants = [];
    for (let i = 0; i < checkboxes.length; i++) participants.push(parseInt(checkboxes[i].value));

    if (participants.length < 2) { showToast('Выберите минимум 2 участников', 'error'); return; }

    const creatorId = getCurrentChatParticipantId();
    const result = await apiCall('createGroupChat', 'POST', {
        name: name,
        created_by: creatorId,
        participants: participants
    });

    if (result && result.id) {
        showToast('✅ Группа создана!', 'success');
        if (typeof window.closeModal === 'function') window.closeModal('createGroupModal');
        if (nameElem) nameElem.value = '';
        const allCheckboxes = document.querySelectorAll('#groupParticipantsList .participant-select-checkbox');
        for (let c = 0; c < allCheckboxes.length; c++) allCheckboxes[c].checked = false;

        await loadStudentChatsMessenger();
        selectChat(result.id, 'group', name);
        switchMessengerTab('chats');
    } else {
        showToast('Не удалось создать группу', 'error');
    }
}

// ============================================================
// АДМИН: ДОБАВЛЕНИЕ АДМИНА В ГРУППУ
// ============================================================
export async function showAddAdminToGroupModal(conversationId) {
    const admins = await apiCall('getAllAdmins', 'GET', {});
    const currentUserId = state.currentUser ? state.currentUser.id : (state.currentStudent ? state.currentStudent.id : 0);

    let availableAdmins = [];
    for (let i = 0; i < admins.length; i++) {
        if (admins[i].id !== currentUserId) availableAdmins.push(admins[i]);
    }

    if (availableAdmins.length === 0) {
        showToast('Нет доступных администраторов для добавления', 'warning');
        return;
    }

    let adminsHtml = '';
    for (let j = 0; j < availableAdmins.length; j++) {
        const admin = availableAdmins[j];
        adminsHtml += '<div class="participant-select-item" data-admin-id="' + admin.id + '">' +
            '<div class="person-avatar" style="background: linear-gradient(135deg, #dc2626, #991b1b);"><i class="fas fa-crown"></i></div>' +
            '<div class="person-info">' +
                '<div class="person-name">' + escapeHtml(admin.display_name) + '</div>' +
                '<div class="person-group">' + (admin.role === 'founder' ? 'Основатель' : 'Администратор') + '</div>' +
            '</div>' +
            '<input type="checkbox" class="participant-select-checkbox" value="' + admin.id + '">' +
        '</div>';
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'addAdminToGroupModal';
    modal.innerHTML = '<div class="modal-content" style="max-width: 500px;">' +
        '<div class="modal-header"><h3><i class="fas fa-user-plus"></i> Добавить администратора в группу</h3><button class="modal-close">&times;</button></div>' +
        '<div class="modal-body"><p style="margin-bottom: 12px; color: var(--text-muted);">Выберите администратора для добавления:</p><div id="adminListForGroup" style="max-height: 300px; overflow-y: auto;">' + adminsHtml + '</div></div>' +
        '<div class="modal-footer"><button class="btn-cancel">Отмена</button><button class="btn-primary" id="confirmAddAdminToGroupBtn">Добавить выбранных</button></div>' +
    '</div>';
    document.body.appendChild(modal);

    const confirmBtn = document.getElementById('confirmAddAdminToGroupBtn');
    if (confirmBtn) {
        confirmBtn.dataset.chatId = conversationId;
        confirmBtn.onclick = async function() {
            const checkboxes = document.querySelectorAll('#adminListForGroup .participant-select-checkbox:checked');
            const selectedAdmins = [];
            for (let k = 0; k < checkboxes.length; k++) selectedAdmins.push(parseInt(checkboxes[k].value));
            if (selectedAdmins.length === 0) { showToast('Выберите администраторов', 'error'); return; }

            for (let l = 0; l < selectedAdmins.length; l++) {
                const adminId = selectedAdmins[l];
                let admin = null;
                for (let a = 0; a < availableAdmins.length; a++) {
                    if (availableAdmins[a].id === adminId) { admin = availableAdmins[a]; break; }
                }
                await apiCall('addAdminToGroup', 'POST', {
                    conversation_id: conversationId,
                    current_user_id: currentUserId,
                    admin_id: adminId,
                    is_admin: (typeof window.isAdminOrFounder === 'function' && window.isAdminOrFounder()) ? 1 : 0
                });
            }
            showToast('✅ Администраторы добавлены в группу', 'success');
            modal.remove();
            await loadChatMessages(conversationId);
            await loadStudentChatsMessenger();
        };
    }

    const closeButtons = modal.querySelectorAll('.modal-close, .btn-cancel');
    for (let b = 0; b < closeButtons.length; b++) {
        closeButtons[b].addEventListener('click', function() { modal.remove(); });
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ МЕССЕНДЖЕРА (с защитой от дубля)
// ============================================================
export function initMessenger() {
    // ⚡ Защита: если уже инициализировано — выходим
    if (messengerInitialized) return;
    messengerInitialized = true;

    const createGroupChatBtn = document.getElementById('createGroupChatBtn');
    if (createGroupChatBtn) createGroupChatBtn.addEventListener('click', showCreateGroupModal);

    const confirmCreateGroupBtn = document.getElementById('confirmCreateGroupBtn');
    if (confirmCreateGroupBtn) confirmCreateGroupBtn.addEventListener('click', createGroupChat);

    const confirmAddMembersBtn = document.getElementById('confirmAddMembersBtn');
    if (confirmAddMembersBtn) confirmAddMembersBtn.addEventListener('click', function() {
        const chatId = parseInt(confirmAddMembersBtn.dataset.chatId || '0');
        if (chatId) showAddMembersModal(chatId);
    });

    const tabs = document.querySelectorAll('.messenger-tab');
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function() { switchMessengerTab(this.dataset.tab); });
    }

    const messengerSearchInput = document.getElementById('messengerSearchInput');
    if (messengerSearchInput) {
        messengerSearchInput.addEventListener('input', function(e) {
            if (state.messengerSearchTimeout) clearTimeout(state.messengerSearchTimeout);
            state.messengerSearchTimeout = setTimeout(function() {
                if (state.messengerCurrentTab === 'people') searchPeopleWithAdmins(e.target.value);
            }, 300);
        });
    }

    // ⚡ Кнопка отправки — с очисткой старых обработчиков
    const messengerSendBtn = document.getElementById('messengerSendBtn');
    if (messengerSendBtn) {
        const newSendBtn = messengerSendBtn.cloneNode(true);
        messengerSendBtn.parentNode.replaceChild(newSendBtn, messengerSendBtn);
        newSendBtn.addEventListener('click', sendChatMessage);
    }

    // ⚡ Enter в textarea — с очисткой старых обработчиков
    const messengerInput = document.getElementById('messengerInput');
    if (messengerInput) {
        const newInput = messengerInput.cloneNode(true);
        messengerInput.parentNode.replaceChild(newInput, messengerInput);

        newInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
        newInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        });
    }

    const backBtn = document.getElementById('messengerBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (state.isSelectingChat) return;

            const sidebar = document.querySelector('.messenger-sidebar');
            const overlay = document.querySelector('.messenger-overlay');
            if (sidebar) sidebar.classList.remove('hidden-sidebar');
            if (overlay) overlay.classList.remove('active');

            state.messengerCurrentChat = null;
            const messengerChatArea = document.getElementById('messengerChatArea');
            const messengerEmptyState = document.getElementById('messengerEmptyState');
            if (messengerChatArea) messengerChatArea.style.display = 'none';
            if (messengerEmptyState) messengerEmptyState.style.display = 'flex';
            stopMessengerPolling();

            setTimeout(function() { loadStudentChatsMessenger(); }, 100);
        });
    }

    const overlay = document.getElementById('messengerOverlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (state.isSelectingChat) return;
            const sidebar = document.querySelector('.messenger-sidebar');
            if (sidebar) sidebar.classList.remove('hidden-sidebar');
            overlay.classList.remove('active');
        });
    }

    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            const sidebar = document.querySelector('.messenger-sidebar');
            const overlay = document.querySelector('.messenger-overlay');
            if (sidebar) sidebar.classList.remove('hidden-sidebar');
            if (overlay) overlay.classList.remove('active');
        }
    });

    const messengerChatArea = document.getElementById('messengerChatArea');
    const messengerEmptyState = document.getElementById('messengerEmptyState');
    if (messengerChatArea) {
        messengerChatArea.style.display = 'none';
        messengerChatArea.style.visibility = 'hidden';
    }
    if (messengerEmptyState) {
        messengerEmptyState.style.display = 'flex';
        messengerEmptyState.style.visibility = 'visible';
    }
}

// ============================================================
// ЗАГРУЗКА ФАЙЛОВ
// ============================================================
export async function uploadChatImage(file, conversationId) {
    if (uploadInProgress) return;

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) { showToast('Не удалось определить отправителя', 'error'); return; }
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        showToast('❌ Разрешены только JPEG, PNG, GIF, WEBP', 'error');
        return;
    }
    if (file.size > 20 * 1024 * 1024) { showToast('❌ Файл слишком большой (макс 20MB)', 'error'); return; }

    uploadInProgress = true;
    const fd = new FormData();
    fd.append('chat_image', file);
    fd.append('conversation_id', conversationId);
    fd.append('student_id', userInfo.id);
    fd.append('student_name', userInfo.displayName);

    const sendBtn = document.getElementById('messengerSendBtn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    try {
        const response = await fetch(state.API_URL + '?endpoint=uploadChatImage', { method: 'POST', body: fd });
        const result = await response.json();
        if (result.success) {
            state.messengerLastMessageId = 0;
            await loadChatMessages(conversationId);
            await loadStudentChatsMessenger();
        } else {
            showToast('❌ ' + (result.error || 'Ошибка загрузки'), 'error');
        }
    } catch (e) {
        console.error('Upload error:', e);
        showToast('❌ Ошибка загрузки изображения', 'error');
    } finally {
        uploadInProgress = false;
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
    }
}

export async function uploadChatFile(file, conversationId) {
    if (uploadInProgress) return;

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) { showToast('Не удалось определить отправителя', 'error'); return; }
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { showToast('❌ Файл слишком большой (макс 20MB)', 'error'); return; }

    uploadInProgress = true;
    const fd = new FormData();
    fd.append('chat_file', file);
    fd.append('conversation_id', conversationId);
    fd.append('student_id', userInfo.id);
    fd.append('student_name', userInfo.displayName);

    const sendBtn = document.getElementById('messengerSendBtn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    try {
        const response = await fetch(state.API_URL + '?endpoint=uploadChatFile', { method: 'POST', body: fd });
        const result = await response.json();
        if (result.success) {
            state.messengerLastMessageId = 0;
            await loadChatMessages(conversationId);
            await loadStudentChatsMessenger();
            showToast('✅ Файл отправлен', 'success');
        } else {
            showToast('❌ ' + (result.error || 'Ошибка загрузки'), 'error');
        }
    } catch (e) {
        console.error('Upload error:', e);
        showToast('❌ Ошибка загрузки файла', 'error');
    } finally {
        uploadInProgress = false;
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
    }
}

export function addImageUploadButton() {
    const messengerInputArea = document.querySelector('.messenger-input-area');
    if (!messengerInputArea || document.getElementById('messengerImageBtn')) return;

    const imageBtn = document.createElement('button');
    imageBtn.id = 'messengerImageBtn';
    imageBtn.className = 'messenger-image-btn';
    imageBtn.innerHTML = '<i class="fas fa-image"></i>';
    imageBtn.title = 'Отправить изображение (Ctrl+V для вставки)';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'messengerImageInput';
    fileInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
    fileInput.style.display = 'none';

    imageBtn.onclick = function() { fileInput.click(); };
    fileInput.onchange = async function(e) {
        if (e.target.files && e.target.files[0] && state.messengerCurrentChat && state.messengerCurrentChat.id) {
            await uploadChatImage(e.target.files[0], state.messengerCurrentChat.id);
            fileInput.value = '';
        } else if (!state.messengerCurrentChat) {
            showToast('Сначала выберите чат', 'warning');
        }
    };

    const sendBtn = document.getElementById('messengerSendBtn');
    if (sendBtn && sendBtn.parentNode) {
        sendBtn.parentNode.insertBefore(imageBtn, sendBtn);
        sendBtn.parentNode.insertBefore(fileInput, sendBtn);
    }
}

export function addFileUploadButton() {
    const messengerInputArea = document.querySelector('.messenger-input-area');
    if (!messengerInputArea || document.getElementById('messengerFileBtn')) return;

    const fileBtn = document.createElement('button');
    fileBtn.id = 'messengerFileBtn';
    fileBtn.className = 'messenger-file-btn';
    fileBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
    fileBtn.title = 'Прикрепить файл (макс 20MB)';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'messengerFileInput';
    fileInput.style.display = 'none';

    fileBtn.onclick = function() { fileInput.click(); };
    fileInput.onchange = async function(e) {
        if (e.target.files && e.target.files[0] && state.messengerCurrentChat && state.messengerCurrentChat.id) {
            await uploadChatFile(e.target.files[0], state.messengerCurrentChat.id);
            fileInput.value = '';
        } else if (!state.messengerCurrentChat) {
            showToast('Сначала выберите чат', 'warning');
        }
    };

    const imageBtn = document.getElementById('messengerImageBtn');
    if (imageBtn && imageBtn.parentNode) {
        imageBtn.parentNode.insertBefore(fileBtn, imageBtn);
        imageBtn.parentNode.insertBefore(fileInput, imageBtn);
    } else {
        const sendBtn = document.getElementById('messengerSendBtn');
        if (sendBtn && sendBtn.parentNode) {
            sendBtn.parentNode.insertBefore(fileBtn, sendBtn);
            sendBtn.parentNode.insertBefore(fileInput, sendBtn);
        }
    }
}

export function initImagePaste() {
    const messengerInput = document.getElementById('messengerInput');
    if (!messengerInput) return;
    messengerInput.addEventListener('paste', async function(e) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (state.messengerCurrentChat && state.messengerCurrentChat.id) {
                    await uploadChatImage(file, state.messengerCurrentChat.id);
                } else {
                    showToast('Сначала выберите чат', 'warning');
                }
                return;
            }
        }
    });
}

export function initFilePaste() {
    const messengerInput = document.getElementById('messengerInput');
    if (!messengerInput) return;
    messengerInput.addEventListener('paste', async function(e) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file' && !items[i].type.startsWith('image/')) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (state.messengerCurrentChat && state.messengerCurrentChat.id) {
                    await uploadChatFile(file, state.messengerCurrentChat.id);
                } else {
                    showToast('Сначала выберите чат', 'warning');
                }
                return;
            }
        }
    });
}

// ============================================================
// ПЕРЕСЫЛКА СООБЩЕНИЙ
// ============================================================
export async function showForwardModal(messageId, messageText, messageAuthor, originalChatId, messageFileUrl, messageFileName, messageFileSize, messageFileType) {
    state.forwardTargetMessage = {
        id: messageId,
        text: messageText,
        author: messageAuthor,
        chatId: originalChatId,
        fileUrl: messageFileUrl || null,
        fileName: messageFileName || null,
        fileSize: messageFileSize || null,
        fileType: messageFileType || null
    };

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) { showToast('Не удалось определить пользователя', 'error'); return; }

    let chats = [];
    if (userInfo.type === 'admin') {
        const response = await fetch(state.API_URL + '?endpoint=getAdminChats&admin_id=' + userInfo.id + '&t=' + Date.now());
        const data = await response.json();
        chats = data.success && data.data ? data.data : [];
    } else {
        chats = await apiCall('getStudentChats', 'GET', { student_id: userInfo.id });
    }

    chats = chats.filter(function(chat) { return chat.id !== originalChatId; });

    if (!chats || chats.length === 0) {
        showToast('Нет доступных чатов для пересылки', 'error');
        return;
    }

    let chatsHtml = '';
    for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        const displayName = chat.type === 'group' ? (chat.name || 'Группа') : chat.display_name;
        let icon = chat.type === 'group' ? '<i class="fas fa-users"></i>' : '<i class="fas fa-user"></i>';
        let avatarClass = chat.type === 'group' ? 'group' : '';
        if (chat.is_admin_chat || (chat.display_name && (chat.display_name.indexOf('(Администратор)') !== -1 || chat.display_name.indexOf('(Основатель)') !== -1))) {
            icon = '<i class="fas fa-crown"></i>';
            avatarClass = 'admin-chat-avatar';
        }
        chatsHtml += '<div class="forward-chat-item" data-chat-id="' + chat.id + '" data-chat-type="' + chat.type + '">' +
            '<div class="forward-chat-avatar ' + avatarClass + '">' + icon + '</div>' +
            '<div class="forward-chat-info">' +
                '<div class="forward-chat-name">' + escapeHtml(displayName) + '</div>' +
                '<div class="forward-chat-meta">' + (chat.type === 'group' ? 'Групповой чат' : 'Личный чат') + '</div>' +
            '</div>' +
        '</div>';
    }

    let previewText = messageText;
    if (previewText.length > 100) previewText = previewText.substring(0, 100) + '...';

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'forwardModal';
    modal.innerHTML = '<div class="modal-content" style="max-width: 500px;">' +
        '<div class="modal-header"><h3><i class="fas fa-share"></i> Переслать сообщение</h3><button class="modal-close">&times;</button></div>' +
        '<div class="modal-body">' +
            '<p style="margin-bottom: 12px; color: var(--text-muted);">Выберите чат для пересылки:</p>' +
            '<div id="forwardChatsList" style="max-height: 300px; overflow-y: auto;">' + chatsHtml + '</div>' +
            '<div id="forwardPreview" style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 12px;">' +
                '<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">📎 Сообщение:</div>' +
                '<div style="font-size: 13px; margin-top: 4px; word-wrap: break-word; max-height: 80px; overflow: hidden;">' + escapeHtml(previewText) + '</div>' +
            '</div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn-cancel">Отмена</button></div>' +
    '</div>';
    document.body.appendChild(modal);

    const forwardItems = modal.querySelectorAll('.forward-chat-item');
    for (let j = 0; j < forwardItems.length; j++) {
        forwardItems[j].addEventListener('click', async function() {
            const targetChatId = parseInt(this.dataset.chatId);
            await executeForward(targetChatId);
            modal.remove();
        });
    }

    const closeButtons = modal.querySelectorAll('.modal-close, .btn-cancel');
    for (let k = 0; k < closeButtons.length; k++) {
        closeButtons[k].addEventListener('click', function() { modal.remove(); });
    }
}

export async function executeForward(targetChatId) {
    if (!state.forwardTargetMessage) return;

    const userInfo = getCurrentChatUserInfo();
    if (!userInfo) { showToast('Не удалось определить пользователя', 'error'); return; }

    let studentId = userInfo.id;
    if (userInfo.type === 'admin') studentId = -userInfo.id;
    const studentName = userInfo.displayName;

    const result = await apiCall('forwardChatMessage', 'POST', {
        original_message_id: state.forwardTargetMessage.id,
        target_conversation_id: targetChatId,
        student_id: studentId,
        student_name: studentName
    });

    if (result) {
        showToast('✅ Сообщение переслано', 'success');
        if (state.messengerCurrentChat && state.messengerCurrentChat.id === targetChatId) {
            state.messengerLastMessageId = 0;
            await loadChatMessages(targetChatId);
        }
        await loadStudentChatsMessenger();
    } else {
        showToast('❌ Не удалось переслать сообщение', 'error');
    }
    state.forwardTargetMessage = null;
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.getCurrentChatUserInfo = getCurrentChatUserInfo;
window.getCurrentChatParticipantId = getCurrentChatParticipantId;
window.canUseMessenger = canUseMessenger;
window.loadStudentChatsMessenger = loadStudentChatsMessenger;
window.selectChat = selectChat;
window.sendChatMessage = sendChatMessage;
window.editChatMessage = editChatMessage;
window.deleteChatMessage = deleteChatMessage;
window.deleteConversation = deleteConversation;
window.renameGroup = renameGroup;
window.removeParticipantFromGroup = removeParticipantFromGroup;
window.leaveGroup = leaveGroup;
window.switchMessengerTab = switchMessengerTab;
window.startChatWithUser = startChatWithUser;
window.searchPeopleWithAdmins = searchPeopleWithAdmins;
window.initMessenger = initMessenger;
window.showForwardModal = showForwardModal;
window.addImageUploadButton = addImageUploadButton;
window.addFileUploadButton = addFileUploadButton;
window.initImagePaste = initImagePaste;
window.initFilePaste = initFilePaste;
window.startMessengerPolling = startMessengerPolling;
window.stopMessengerPolling = stopMessengerPolling;
window.startMessengerUpdatesPolling = startMessengerUpdatesPolling;
window.stopMessengerUpdatesPolling = stopMessengerUpdatesPolling;
window.showCreateGroupModal = showCreateGroupModal;
window.createGroupChat = createGroupChat;
window.showAddMembersModal = showAddMembersModal;
window.showGroupInfo = showGroupInfo;
window.showAddAdminToGroupModal = showAddAdminToGroupModal;