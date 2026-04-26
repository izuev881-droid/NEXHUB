(function(){
    "use strict";

    // ========== ДАННЫЕ ==========
    let groups = JSON.parse(localStorage.getItem('ithub_groups')) || [];

    let students = JSON.parse(localStorage.getItem('ithub_students')) || {};

    let users = JSON.parse(localStorage.getItem('ithub_users')) || {
        'admin': { password: 'admin', role: 'admin' }
    };
    
    let promoCodes = JSON.parse(localStorage.getItem('ithub_promo_codes')) || [];

    let events = JSON.parse(localStorage.getItem('ithub_events')) || [];

    let weekSchedule = JSON.parse(localStorage.getItem('ithub_schedule')) || {};

    const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

    let shopItems = JSON.parse(localStorage.getItem('ithub_shop')) || [];

    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    let currentDay = 0;
    let selectedRole = 'student';
    let studentsSearchTerm = '';
    let studentsGroupFilter = 'Все группы';
    let selectedScheduleGroup = 'Все группы';
    let selectedScheduleDay = 0;

    // ========== ДАННЫЕ ДЛЯ ЧАТА ==========
    let chatMessages = JSON.parse(localStorage.getItem('ithub_chat')) || [];
    let commonChatMessages = JSON.parse(localStorage.getItem('ithub_common_chat')) || [];
    let currentAdminFilter = 'pending';

    // DOM элементы
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');
    const loginForm = document.getElementById('loginForm');
    const loginInput = document.getElementById('loginInput');
    const passwordInput = document.getElementById('passwordInput');
    const authTabs = document.querySelectorAll('.auth-tab');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const userAvatar = document.getElementById('userAvatar');
    const sidebarBalance = document.getElementById('sidebarBalance');
    const logoutBtn = document.getElementById('logoutBtn');
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    const adminOnly = document.querySelectorAll('.admin-only');
    const studentOnly = document.querySelectorAll('.student-only');
    const attendanceStat = document.getElementById('attendanceStat');
    const todayEarnedStat = document.getElementById('todayEarnedStat');
    const scheduleList = document.getElementById('scheduleList');
    const shopList = document.getElementById('shopList');
    const historyList = document.getElementById('historyList');
    const leaderboardContainer = document.getElementById('leaderboardContainer');
    const leaderboardAdminContainer = document.getElementById('leaderboardAdminContainer');
    const dayBtns = document.querySelectorAll('.day-btn');
    const usedPromoCodesContainer = document.getElementById('usedPromoCodes');
    const eventsList = document.getElementById('eventsList');
    const adminEventsList = document.getElementById('adminEventsList');

    // ========== УТИЛИТЫ ==========
    function saveAll() {
        localStorage.setItem('ithub_groups', JSON.stringify(groups));
        localStorage.setItem('ithub_students', JSON.stringify(students));
        localStorage.setItem('ithub_users', JSON.stringify(users));
        localStorage.setItem('ithub_promo_codes', JSON.stringify(promoCodes));
        localStorage.setItem('ithub_schedule', JSON.stringify(weekSchedule));
        localStorage.setItem('ithub_shop', JSON.stringify(shopItems));
        localStorage.setItem('ithub_events', JSON.stringify(events));
        saveChat();
        saveCommonChat();
    }

    function saveChat() {
        localStorage.setItem('ithub_chat', JSON.stringify(chatMessages));
    }

    function saveCommonChat() {
        localStorage.setItem('ithub_common_chat', JSON.stringify(commonChatMessages));
    }

    function initScheduleForGroup(groupName) {
        if (!weekSchedule) weekSchedule = {};
        for (let day = 0; day < 6; day++) {
            if (!weekSchedule[day]) weekSchedule[day] = {};
            if (!weekSchedule[day][groupName]) {
                weekSchedule[day][groupName] = [];
            }
        }
    }

    function getCurrentStudent() {
        return currentUser?.role === 'student' ? students[currentUser.studentId] : null;
    }

    function showToast(text, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'exclamation-circle'}"></i> <span style="white-space: pre-line;">${text}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    function showAdminToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `admin-toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'times-circle'}"></i> ${message}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function formatChatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'Только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч. назад`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function updateAllDisplays() {
        const s = getCurrentStudent();
        if (currentUser?.role === 'admin') {
            if (sidebarBalance) sidebarBalance.textContent = '—';
            return;
        }
        const balance = s?.balance || 0;
        if (sidebarBalance) sidebarBalance.textContent = balance;
        if (!s) return;
        
        const attended = s.attendedPairs || {};
        let total = 0;
        for (let day = 0; day < 6; day++) {
            total += getPairsForDay(day, s.group).length;
        }
        const count = Object.keys(attended).length;
        if (attendanceStat) attendanceStat.textContent = `${count}/${total}`;
        
        let earned = 0;
        for (let day = 0; day < 6; day++) {
            getPairsForDay(day, s.group).forEach(p => { if (attended[p.id]) earned += p.reward; });
        }
        if (todayEarnedStat) todayEarnedStat.textContent = `${earned} 💎`;
    }

    function getPairsForDay(dayIndex, groupName) {
        const dayData = weekSchedule[dayIndex] || {};
        return dayData[groupName] || dayData['Все группы'] || [];
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }

    // ========== ВХОД ==========
    function login(login, password) {
        if (!login || !password) { 
            showToast('Введите логин и пароль', 'error'); 
            return false; 
        }
        if (login === 'admin' && password === 'admin') {
            currentUser = { login: 'admin', role: 'admin' };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            return true;
        }
        let userData = users[login];
        if (!userData) {
            showToast('Пользователь не найден. Обратитесь к администратору', 'error');
            return false;
        }
        if (userData.password !== password) {
            showToast('Неверный пароль', 'error');
            return false;
        }
        if (userData.role !== selectedRole) {
            showToast(`Эта учетная запись не является ${selectedRole === 'admin' ? 'администратором' : 'студентом'}`, 'error');
            return false;
        }
        currentUser = { login: login, role: userData.role, studentId: userData.studentId };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        return true;
    }

    function logout() {
        currentUser = null;
        localStorage.removeItem('currentUser');
        authScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
        loginInput.value = '';
        passwordInput.value = '';
        document.body.classList.remove('admin-mode');
    }

    // ========== НАВИГАЦИЯ ==========
    function switchPage(pageId) {
        pages.forEach(p => p.classList.remove('active'));
        navLinks.forEach(l => l.classList.remove('active'));
        document.getElementById(pageId + 'Page')?.classList.add('active');
        document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
        
        if (pageId === 'leaderboard') renderLeaderboard();
        if (pageId === 'history') renderHistory();
        if (pageId === 'rating-admin') renderLeaderboardAdmin();
        if (pageId === 'promo') renderUsedPromoCodes();
        if (pageId === 'events') renderEventsList();
        if (pageId === 'events-editor') renderAdminEventsList();
        if (pageId === 'chat') renderStudentTickets();
        if (pageId === 'chat-admin') renderAdminTickets();
        if (pageId === 'common-chat') renderCommonChat();
        if (pageId === 'common-chat-admin') renderAdminCommonChat();
        if (pageId === 'schedule-editor') {
            renderGroupCards();
            document.getElementById('scheduleEditorCard').style.display = 'none';
        }
        if (['students', 'groups', 'attendance', 'shop-editor', 'promo-editor'].includes(pageId)) {
            renderAdminPanel();
        }
    }

    // ========== ФУНКЦИИ ПОДДЕРЖКИ ==========
    
    function renderStudentTickets() {
        const container = document.getElementById('messagesArea');
        if (!container) return;
        
        const s = getCurrentStudent();
        if (!s) return;
        
        const userMessages = chatMessages.filter(msg => msg.authorId === s.id);
        userMessages.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const totalCount = userMessages.length;
        const pendingCount = userMessages.filter(m => !m.answer).length;
        const answeredCount = userMessages.filter(m => m.answer).length;
        
        const totalSpan = document.getElementById('totalTickets');
        const pendingSpan = document.getElementById('pendingTickets');
        const answeredSpan = document.getElementById('answeredTickets');
        if (totalSpan) totalSpan.textContent = totalCount;
        if (pendingSpan) pendingSpan.textContent = pendingCount;
        if (answeredSpan) answeredSpan.textContent = answeredCount;
        
        if (userMessages.length === 0) {
            container.innerHTML = `
                <div class="empty-tickets">
                    <i class="fas fa-comments"></i>
                    <p>Нет обращений</p>
                    <span>Создайте обращение, и мы ответим вам в ближайшее время</span>
                </div>
            `;
            return;
        }
        
        container.innerHTML = userMessages.map(msg => `
            <div class="ticket-card ${msg.answer ? 'answered' : 'pending'}">
                <div class="ticket-header">
                    <div class="ticket-author ${msg.isAnonymous ? 'anonymous' : ''}">
                        <i class="fas ${msg.isAnonymous ? 'fa-user-secret' : 'fa-user'}"></i>
                        <span>${msg.isAnonymous ? 'Анонимно' : escapeHtml(msg.authorName)}</span>
                    </div>
                    <div class="ticket-date">${formatChatDate(msg.date)}</div>
                </div>
                <div class="ticket-text">${escapeHtml(msg.text)}</div>
                <div class="ticket-status ${msg.answer ? 'status-answered' : 'status-pending'}">
                    <i class="fas ${msg.answer ? 'fa-check-circle' : 'fa-clock'}"></i>
                    <span>${msg.answer ? 'Есть ответ' : 'Ожидает ответа'}</span>
                </div>
                ${msg.answer ? `
                    <div class="ticket-answer">
                        <div class="ticket-answer-header">
                            <i class="fas fa-reply"></i> Ответ службы поддержки:
                        </div>
                        <div class="ticket-answer-text">${escapeHtml(msg.answer)}</div>
                        <div class="ticket-date" style="margin-top: 8px;">${formatChatDate(msg.answerDate)}</div>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
    
    function renderAdminTickets() {
        const container = document.getElementById('adminMessagesList');
        if (!container) return;
        
        let filtered = [...chatMessages];
        
        if (currentAdminFilter === 'pending') {
            filtered = filtered.filter(m => !m.answer);
        } else if (currentAdminFilter === 'answered') {
            filtered = filtered.filter(m => m.answer);
        }
        
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const pendingCount = chatMessages.filter(m => !m.answer).length;
        const answeredCount = chatMessages.filter(m => m.answer).length;
        
        const pendingCountSpan = document.getElementById('adminPendingCount');
        const answeredCountSpan = document.getElementById('adminAnsweredCount');
        const pendingBadge = document.getElementById('pendingCountBadge');
        const answeredBadge = document.getElementById('answeredCountBadge');
        
        if (pendingCountSpan) pendingCountSpan.textContent = pendingCount;
        if (answeredCountSpan) answeredCountSpan.textContent = answeredCount;
        if (pendingBadge) pendingBadge.textContent = pendingCount;
        if (answeredBadge) answeredBadge.textContent = answeredCount;
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>Нет обращений</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filtered.map(msg => `
            <div class="admin-ticket-card ${msg.answer ? 'answered' : 'pending'}">
                <div class="admin-ticket-header">
                    <div class="admin-ticket-author ${msg.isAnonymous ? 'anonymous' : ''}">
                        <i class="fas ${msg.isAnonymous ? 'fa-user-secret' : 'fa-user'}"></i>
                        <span>${msg.isAnonymous ? 'Анонимно' : escapeHtml(msg.authorName)}</span>
                        ${!msg.isAnonymous ? `<span style="font-size:12px;color:var(--text-muted)">(${escapeHtml(msg.authorLogin)} • ${escapeHtml(msg.authorGroup)})</span>` : ''}
                    </div>
                    <div class="admin-ticket-date">${formatChatDate(msg.date)}</div>
                </div>
                <div class="admin-ticket-text">${escapeHtml(msg.text)}</div>
                <div class="admin-ticket-answer-area">
                    ${msg.answer ? `
                        <div class="existing-answer-block">
                            <p><i class="fas fa-reply"></i> Ответ:</p>
                            <div class="existing-answer-text">${escapeHtml(msg.answer)}</div>
                            <div class="admin-ticket-date" style="margin-top:6px;">${formatChatDate(msg.answerDate)}</div>
                        </div>
                    ` : ''}
                    <div class="answer-input-group">
                        <textarea id="answer-${msg.id}" rows="2" placeholder="Введите ответ...">${msg.answer || ''}</textarea>
                        <button class="answer-submit-btn" onclick="sendAnswer('${msg.id}')">
                            <i class="fas fa-paper-plane"></i> ${msg.answer ? 'Изменить ответ' : 'Ответить'}
                        </button>
                        <button class="ticket-delete-btn" onclick="deleteTicket('${msg.id}')">
                            <i class="fas fa-trash"></i> Удалить
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    window.deleteTicket = (messageId) => {
        if (confirm('Удалить это обращение?')) {
            const messageIndex = chatMessages.findIndex(m => m.id === messageId);
            if (messageIndex !== -1) {
                chatMessages.splice(messageIndex, 1);
                saveChat();
                renderAdminTickets();
                renderStudentTickets();
                showAdminToast('Обращение удалено', 'error');
            }
        }
    };
    
    window.sendAnswer = function(messageId) {
        const textarea = document.getElementById(`answer-${messageId}`);
        const answer = textarea?.value.trim();
        
        if (!answer) {
            showToast('Введите ответ', 'error');
            return;
        }
        
        const messageIndex = chatMessages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            chatMessages[messageIndex].answer = answer;
            chatMessages[messageIndex].answerDate = new Date().toISOString();
            saveChat();
            renderAdminTickets();
            renderStudentTickets();
            showAdminToast(`Ответ отправлен ${chatMessages[messageIndex].isAnonymous ? 'анонимному студенту' : chatMessages[messageIndex].authorName}`, 'success');
        }
    };
    
    function sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input?.value.trim();
        const isAnonymous = document.getElementById('anonymousToggle')?.checked || false;
        const s = getCurrentStudent();
        
        if (!text) {
            showToast('Введите текст сообщения', 'error');
            return;
        }
        
        if (!s) {
            showToast('Ошибка: студент не найден', 'error');
            return;
        }
        
        const newMessage = {
            id: 'msg_' + Date.now(),
            text: text,
            authorId: s.id,
            authorName: s.name,
            authorLogin: currentUser?.login || 'unknown',
            authorGroup: s.group,
            isAnonymous: isAnonymous,
            date: new Date().toISOString(),
            answer: null,
            answerDate: null
        };
        
        chatMessages.unshift(newMessage);
        saveChat();
        
        input.value = '';
        if (document.getElementById('anonymousToggle')) document.getElementById('anonymousToggle').checked = false;
        
        renderStudentTickets();
        if (currentUser?.role === 'admin') renderAdminTickets();
        
        showToast('Сообщение отправлено в поддержку!', 'success');
    }
    
    // ========== ОБЩИЙ ЧАТ (СНИЗУ ВВЕРХ, НОВЫЕ СООБЩЕНИЯ ВНИЗУ) ==========
    
    function scrollToBottom(container) {
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
    
    function renderCommonChat() {
        const container = document.getElementById('commonMessagesArea');
        if (!container) return;
        
        const isAdmin = currentUser?.role === 'admin';
        // Сортируем по возрастанию даты (старые вверху, новые внизу)
        const sortedMessages = [...commonChatMessages].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (sortedMessages.length === 0) {
            container.innerHTML = `
                <div class="empty-chat">
                    <i class="fas fa-comments"></i>
                    <p>Нет сообщений</p>
                    <span>Будьте первым, кто напишет в общий чат!</span>
                </div>
            `;
            return;
        }
        
        container.innerHTML = sortedMessages.map(msg => {
            const isDeleted = msg.deleted === true;
            return `
                <div class="common-message ${isDeleted ? 'deleted' : ''}" data-message-id="${msg.id}">
                    <div class="common-message-avatar">
                        <i class="fas ${msg.isAnonymous ? 'fa-user-secret' : 'fa-user-graduate'}"></i>
                    </div>
                    <div class="common-message-content">
                        <div class="common-message-header">
                            <span class="common-message-author">${isDeleted ? 'Удалено' : (msg.isAnonymous ? 'Анонимно' : escapeHtml(msg.authorName))}</span>
                            ${!isDeleted && !msg.isAnonymous && msg.authorName !== 'Удалено' ? `<span class="common-message-group">${escapeHtml(msg.authorGroup)}</span>` : ''}
                            <span class="common-message-time">${formatChatDate(msg.date)}</span>
                        </div>
                        <div class="common-message-text">${isDeleted ? '<em>Сообщение удалено модератором</em>' : escapeHtml(msg.text)}</div>
                        ${!isDeleted && !isAdmin && msg.authorName !== 'Удалено' ? `
                            <div class="common-message-actions">
                                <button class="message-action-btn" onclick="setReplyToCommon('${msg.id}', '${escapeHtml(msg.authorName)}')">
                                    <i class="fas fa-reply"></i> Ответить
                                </button>
                            </div>
                        ` : ''}
                        ${!isDeleted && isAdmin && msg.authorName !== 'Удалено' ? `
                            <div class="common-message-actions">
                                <button class="message-action-btn" onclick="pinCommonMessage('${msg.id}')" title="${msg.pinned ? 'Открепить' : 'Закрепить'}">
                                    <i class="fas fa-thumbtack"></i> ${msg.pinned ? 'Открепить' : 'Закрепить'}
                                </button>
                                <button class="message-action-btn danger" onclick="deleteCommonMessage('${msg.id}')">
                                    <i class="fas fa-trash"></i> Удалить
                                </button>
                            </div>
                        ` : ''}
                        ${msg.pinned && !isDeleted ? `<div class="pin-badge"><i class="fas fa-thumbtack"></i> Закреплено администратором</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        // Прокрутка вниз после рендера
        setTimeout(() => scrollToBottom(container), 100);
    }
    
    window.setReplyToCommon = (messageId, authorName) => {
        const input = document.getElementById('commonMessageInput');
        input.value = `@${authorName}: `;
        input.focus();
        showToast(`Ответ для ${authorName}`, 'success');
    };
    
    window.pinCommonMessage = (messageId) => {
        const messageIndex = commonChatMessages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            commonChatMessages[messageIndex].pinned = !commonChatMessages[messageIndex].pinned;
            saveCommonChat();
            renderCommonChat();
            renderAdminCommonChat();
            showAdminToast(commonChatMessages[messageIndex].pinned ? 'Сообщение закреплено' : 'Сообщение откреплено', 'success');
        }
    };
    
    window.deleteCommonMessage = (messageId) => {
        const messageIndex = commonChatMessages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            commonChatMessages[messageIndex].deleted = true;
            commonChatMessages[messageIndex].text = '';
            commonChatMessages[messageIndex].authorName = 'Удалено';
            commonChatMessages[messageIndex].pinned = false;
            saveCommonChat();
            renderCommonChat();
            renderAdminCommonChat();
            showAdminToast('Сообщение удалено', 'error');
        }
    };
    
    window.clearCommonChat = () => {
        if (confirm('Очистить весь общий чат? Это действие необратимо!')) {
            commonChatMessages = [];
            saveCommonChat();
            renderCommonChat();
            renderAdminCommonChat();
            showAdminToast('Общий чат очищен', 'success');
        }
    };
    
    function sendCommonMessage() {
        const input = document.getElementById('commonMessageInput');
        let text = input?.value.trim();
        const s = getCurrentStudent();
        
        if (!text) {
            showToast('Введите текст сообщения', 'error');
            return;
        }
        
        if (!s) {
            showToast('Ошибка: студент не найден', 'error');
            return;
        }
        
        const newMessage = {
            id: 'common_' + Date.now(),
            text: text,
            authorId: s.id,
            authorName: s.name,
            authorGroup: s.group,
            isAnonymous: false,
            date: new Date().toISOString(),
            deleted: false,
            pinned: false
        };
        
        commonChatMessages.push(newMessage);
        saveCommonChat();
        
        input.value = '';
        renderCommonChat();
        renderAdminCommonChat();
        
        showToast('Сообщение отправлено в общий чат!', 'success');
    }
    
    // ========== ОБЩИЙ ЧАТ ДЛЯ АДМИНИСТРАТОРА (СНИЗУ ВВЕРХ) ==========
    
    function renderAdminCommonChat() {
        const container = document.getElementById('adminCommonMessagesArea');
        if (!container) return;
        
        const isAdmin = currentUser?.role === 'admin';
        // Сортируем по возрастанию даты (старые вверху, новые внизу)
        const sortedMessages = [...commonChatMessages].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (sortedMessages.length === 0) {
            container.innerHTML = `
                <div class="empty-chat">
                    <i class="fas fa-comments"></i>
                    <p>Нет сообщений</p>
                    <span>Сообщения студентов будут появляться здесь</span>
                </div>
            `;
            return;
        }
        
        container.innerHTML = sortedMessages.map(msg => {
            const isDeleted = msg.deleted === true;
            return `
                <div class="admin-common-message ${isDeleted ? 'deleted' : ''}" data-message-id="${msg.id}">
                    <div class="admin-common-message-avatar">
                        <i class="fas ${msg.isAnonymous ? 'fa-user-secret' : 'fa-user-graduate'}"></i>
                    </div>
                    <div class="admin-common-message-content">
                        <div class="admin-common-message-header">
                            <span class="admin-common-message-author">${isDeleted ? 'Удалено' : (msg.isAnonymous ? 'Анонимно' : escapeHtml(msg.authorName))}</span>
                            ${!isDeleted && !msg.isAnonymous && msg.authorName !== 'Удалено' ? `<span class="admin-common-message-group">${escapeHtml(msg.authorGroup)}</span>` : ''}
                            <span class="admin-common-message-time">${formatChatDate(msg.date)}</span>
                        </div>
                        <div class="admin-common-message-text">${isDeleted ? '<em>Сообщение удалено модератором</em>' : escapeHtml(msg.text)}</div>
                        ${msg.pinned && !isDeleted ? `<div class="pin-badge"><i class="fas fa-thumbtack"></i> Закреплено администратором</div>` : ''}
                    </div>
                    ${!isDeleted && isAdmin && msg.authorName !== 'Удалено' ? `
                        <div class="admin-common-message-actions">
                            <button class="admin-common-message-action" onclick="pinCommonMessage('${msg.id}')" title="${msg.pinned ? 'Открепить' : 'Закрепить'}">
                                <i class="fas fa-thumbtack"></i>
                            </button>
                            <button class="admin-common-message-action danger" onclick="deleteCommonMessage('${msg.id}')" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        // Прокрутка вниз после рендера
        setTimeout(() => scrollToBottom(container), 100);
    }
    
    function sendAdminCommonMessage() {
        const input = document.getElementById('adminCommonMessageInput');
        const text = input?.value.trim();
        const isAdmin = currentUser?.role === 'admin';
        
        if (!text) {
            showToast('Введите текст сообщения', 'error');
            return;
        }
        
        if (!isAdmin) {
            showToast('Только администратор может отправлять сообщения отсюда', 'error');
            return;
        }
        
        const newMessage = {
            id: 'common_' + Date.now(),
            text: text,
            authorId: 'admin',
            authorName: 'Администратор',
            authorGroup: 'Администрация',
            isAnonymous: false,
            date: new Date().toISOString(),
            deleted: false,
            pinned: false
        };
        
        commonChatMessages.push(newMessage);
        saveCommonChat();
        
        input.value = '';
        renderAdminCommonChat();
        renderCommonChat();
        
        showToast('Сообщение отправлено в общий чат!', 'success');
    }
    
    // ========== СТУДЕНЧЕСКИЕ РЕНДЕРЫ ==========
    function renderSchedule() {
        if (!scheduleList) return;
        const s = getCurrentStudent();
        if (!s) return;
        const pairs = getPairsForDay(currentDay, s.group);
        const attended = s.attendedPairs || {};
        if (pairs.length === 0) {
            scheduleList.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>Нет пар</p></div>';
            return;
        }
        scheduleList.innerHTML = pairs.map(p => `
            <div class="pair-card-new ${attended[p.id] ? 'attended' : ''}">
                <div class="pair-header-new">
                    <span class="pair-time"><i class="far fa-clock"></i> ${escapeHtml(p.time)}</span>
                    <span class="pair-reward">+${p.reward} 💎</span>
                </div>
                <div class="pair-name">${escapeHtml(p.name)}</div>
                <div class="pair-teacher"><i class="fas fa-chalkboard-teacher"></i> ${escapeHtml(p.teacher)}</div>
                ${p.room ? `<div class="pair-room"><i class="fas fa-door-open"></i> ${escapeHtml(p.room)}</div>` : ''}
                ${attended[p.id] ? '<div class="attended-badge-new"><i class="fas fa-check-circle"></i> Отмечено</div>' : '<div class="attended-badge-new" style="background:rgba(171,0,234,0.1);border-color:#ab00ea;color:var(--text-muted)"><i class="fas fa-clock"></i> Ожидает отметки</div>'}
            </div>
        `).join('');
    }
    
    function renderEventsList() {
        if (!eventsList) return;
        if (events.length === 0) {
            eventsList.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Нет предстоящих событий</p></div>';
            return;
        }
        eventsList.innerHTML = [...events].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(event => `
            <div class="event-card">
                <div class="event-date"><i class="fas fa-calendar-day"></i> ${formatDate(event.date)} в ${event.time}</div>
                <div class="event-title">${escapeHtml(event.title)}</div>
                <div class="event-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(event.location)}</div>
                <div class="event-description">${escapeHtml(event.description)}</div>
            </div>
        `).join('');
    }
    
    function renderShop() {
        if (!shopList) return;
        const s = getCurrentStudent();
        if (!s) return;
        const available = shopItems.filter(i => i.stock > 0);
        if (available.length === 0) {
            shopList.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>Товары закончились</p></div>';
            return;
        }
        shopList.innerHTML = available.map(item => `
            <div class="shop-item-new">
                <div class="shop-emoji">${item.emoji}</div>
                <div class="shop-title">${escapeHtml(item.name)}</div>
                <div class="shop-price"><i class="fas fa-gem"></i> ${item.price}</div>
                <div class="shop-stock">Осталось: ${item.stock}</div>
                <button class="buy-btn-new ${s.balance < item.price ? 'disabled' : ''}" data-id="${item.id}">${s.balance >= item.price ? 'Купить' : 'Недостаточно'}</button>
            </div>
        `).join('');
        
        document.querySelectorAll('.buy-btn-new:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = shopItems.find(i => i.id === btn.dataset.id);
                if (!item || item.stock <= 0) { showToast('Товар закончился', 'error'); renderShop(); return; }
                if (s.balance < item.price) { showToast('Недостаточно алмазов', 'error'); return; }
                s.balance -= item.price;
                s.itemsOwned = (s.itemsOwned || 0) + 1;
                item.stock--;
                s.history.unshift({ time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }), action: 'Покупка', details: `${item.name} (-${item.price}💎)` });
                saveAll();
                updateAllDisplays();
                renderShop();
                renderHistory();
                showToast(`Куплено: ${item.name}`, 'success');
            });
        });
    }
    
    function renderHistory() {
        if (!historyList) return;
        const s = getCurrentStudent();
        if (!s) return;
        const hist = s.history || [];
        historyList.innerHTML = hist.length ? hist.map(h => `
            <div class="history-item-new">
                <span class="history-time">${h.time}</span>
                <span class="history-action">${h.action}:</span>
                <span>${escapeHtml(h.details)}</span>
            </div>
        `).join('') : '<div class="empty-state"><i class="fas fa-scroll"></i><p>История пуста</p></div>';
    }
    
    function renderLeaderboard() {
        const lb = Object.values(students).map(s => ({ ...s, experience: s.totalEarned || 0 })).sort((a,b) => b.experience - a.experience);
        const curId = currentUser?.studentId;
        
        if (leaderboardContainer) {
            const top3 = lb.slice(0,3);
            const rest = lb.slice(3);
            let html = `<div class="podium-container">
                <div class="podium-item podium-2"><div class="podium-avatar">🥈</div><div class="podium-name">${escapeHtml(top3[1]?.name || '—')}</div><div class="podium-group">${escapeHtml(top3[1]?.group || '')}</div><div class="podium-score">🎓 ${top3[1]?.experience || 0}</div></div>
                <div class="podium-item podium-1"><div class="podium-avatar">🥇<div class="crown-icon">👑</div></div><div class="podium-name">${escapeHtml(top3[0]?.name || '—')}</div><div class="podium-group">${escapeHtml(top3[0]?.group || '')}</div><div class="podium-score">🎓 ${top3[0]?.experience || 0}</div></div>
                <div class="podium-item podium-3"><div class="podium-avatar">🥉</div><div class="podium-name">${escapeHtml(top3[2]?.name || '—')}</div><div class="podium-group">${escapeHtml(top3[2]?.group || '')}</div><div class="podium-score">🎓 ${top3[2]?.experience || 0}</div></div>
            </div>`;
            if (rest.length) {
                html += `<div class="leaderboard-list">`;
                rest.forEach((s,i) => {
                    html += `<div class="leaderboard-item ${s.id === curId ? 'current-user' : ''}">
                        <div class="leaderboard-rank">#${i+4}</div>
                        <div class="leaderboard-info"><div class="leaderboard-name">${escapeHtml(s.name)} ${s.id === curId ? '<span style="color:#ab00ea">(Вы)</span>' : ''}</div><div class="leaderboard-group">${escapeHtml(s.group)}</div></div>
                        <div class="leaderboard-score">🎓 ${s.experience}</div>
                    </div>`;
                });
                html += `</div>`;
            }
            leaderboardContainer.innerHTML = html;
        }
    }
    
    function renderLeaderboardAdmin() {
        const lb = Object.values(students).map(s => ({ ...s, experience: s.totalEarned || 0 })).sort((a,b) => b.experience - a.experience);
        const top3 = lb.slice(0,3);
        const rest = lb.slice(3);
        let html = `<div class="podium-container">
            <div class="podium-item podium-2"><div class="podium-avatar">🥈</div><div class="podium-name">${escapeHtml(top3[1]?.name || '—')}</div><div class="podium-group">${escapeHtml(top3[1]?.group || '')}</div><div class="podium-score">🎓 ${top3[1]?.experience || 0}</div></div>
            <div class="podium-item podium-1"><div class="podium-avatar">🥇<div class="crown-icon">👑</div></div><div class="podium-name">${escapeHtml(top3[0]?.name || '—')}</div><div class="podium-group">${escapeHtml(top3[0]?.group || '')}</div><div class="podium-score">🎓 ${top3[0]?.experience || 0}</div></div>
            <div class="podium-item podium-3"><div class="podium-avatar">🥉</div><div class="podium-name">${escapeHtml(top3[2]?.name || '—')}</div><div class="podium-group">${escapeHtml(top3[2]?.group || '')}</div><div class="podium-score">🎓 ${top3[2]?.experience || 0}</div></div>
        </div>`;
        if (rest.length) {
            html += `<div class="leaderboard-list">`;
            rest.forEach(s => {
                html += `<div class="leaderboard-item">
                    <div class="leaderboard-rank">#${lb.findIndex(x=>x.id===s.id)+1}</div>
                    <div class="leaderboard-info"><div class="leaderboard-name">${escapeHtml(s.name)}</div><div class="leaderboard-group">${escapeHtml(s.group)}</div></div>
                    <div class="leaderboard-score">🎓 ${s.experience}</div>
                </div>`;
            });
            html += `</div>`;
        }
        if (leaderboardAdminContainer) leaderboardAdminContainer.innerHTML = html;
    }
    
    function activatePromoCode() {
        const input = document.getElementById('bonusCodeInput');
        const code = input?.value.trim().toUpperCase();
        if (!code) { showToast('Введите промокод', 'error'); return; }
        const s = getCurrentStudent();
        if (!s) return;
        const promo = promoCodes.find(p => p.code === code && p.active && p.usedCount < p.maxUses);
        if (!promo) { showToast('Промокод не найден или недействителен', 'error'); return; }
        if (s.usedPromoCodes?.includes(code)) { showToast('Вы уже использовали этот промокод', 'error'); return; }
        if (!s.usedPromoCodes) s.usedPromoCodes = [];
        s.usedPromoCodes.push(code);
        
        let rewardText = '';
        if (promo.rewardCrystals > 0 && promo.rewardExp > 0) {
            s.balance += promo.rewardCrystals;
            s.totalEarned = (s.totalEarned || 0) + promo.rewardExp;
            rewardText = `${promo.rewardCrystals} 💎 и +${promo.rewardExp} опыта`;
        } else if (promo.rewardCrystals > 0) {
            s.balance += promo.rewardCrystals;
            rewardText = `${promo.rewardCrystals} 💎`;
        } else if (promo.rewardExp > 0) {
            s.totalEarned = (s.totalEarned || 0) + promo.rewardExp;
            rewardText = `${promo.rewardExp} опыта`;
        }
        
        promo.usedCount++;
        s.history.unshift({ time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }), action: 'Промокод', details: `${code} (+${rewardText})` });
        saveAll();
        updateAllDisplays();
        renderHistory();
        renderUsedPromoCodes();
        input.value = '';
        showToast(`+${rewardText}!`, 'success');
    }
    
    function renderUsedPromoCodes() {
        if (!usedPromoCodesContainer) return;
        const s = getCurrentStudent();
        if (!s) return;
        const used = s.usedPromoCodes || [];
        if (used.length === 0) {
            usedPromoCodesContainer.innerHTML = '<div class="empty-state"><i class="fas fa-ticket-alt"></i><p>Нет активированных промокодов</p></div>';
            return;
        }
        usedPromoCodesContainer.innerHTML = used.map(code => {
            const promo = promoCodes.find(p => p.code === code);
            let rewardText = '';
            if (promo) {
                if (promo.rewardCrystals > 0 && promo.rewardExp > 0) rewardText = `+${promo.rewardCrystals} 💎 +${promo.rewardExp} опыта`;
                else if (promo.rewardCrystals > 0) rewardText = `+${promo.rewardCrystals} 💎`;
                else if (promo.rewardExp > 0) rewardText = `+${promo.rewardExp} опыта`;
            }
            return `<div class="used-promo-item"><span class="used-promo-code">${code}</span><span class="used-promo-reward">${rewardText}</span></div>`;
        }).join('');
    }
    
    // ========== АДМИН-ПАНЕЛЬ ==========
    function renderAdminPanel() {
        populateAdminSelects();
        renderStudentsList();
        renderGroupsList();
        renderAdminShopList();
        renderAdminPromoList();
        renderLeaderboardAdmin();
        setupAttendanceEditor();
    }
    
    function populateAdminSelects() {
        const selects = ['newStudentGroup', 'attendanceGroupSelect', 'studentsGroupFilter'];
        selects.forEach(id => {
            const sel = document.getElementById(id);
            if (sel) {
                let options = '<option value="Все группы">Все группы</option>';
                groups.forEach(g => {
                    options += `<option value="${g.name}">${g.name}</option>`;
                });
                sel.innerHTML = options;
            }
        });
        const daySel = document.getElementById('attendanceDaySelect');
        if (daySel) daySel.innerHTML = dayNames.map((n,i) => `<option value="${i}">${n}</option>`).join('');
    }
    
    function renderAdminEventsList() {
        if (!adminEventsList) return;
        if (events.length === 0) {
            adminEventsList.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Нет событий</p></div>';
            return;
        }
        adminEventsList.innerHTML = events.map(event => `
            <div class="event-admin-item" data-event-id="${event.id}">
                <div class="event-admin-header">
                    <span class="event-admin-title">${escapeHtml(event.title)}</span>
                    <span class="event-admin-date"><i class="fas fa-calendar"></i> ${event.date} ${event.time}</span>
                </div>
                <div class="event-admin-fields">
                    <input type="text" class="edit-event-title" value="${escapeHtml(event.title)}" placeholder="Название">
                    <input type="date" class="edit-event-date" value="${event.date}">
                    <input type="time" class="edit-event-time" value="${event.time}">
                    <input type="text" class="edit-event-location" value="${escapeHtml(event.location)}" placeholder="Место">
                    <textarea class="edit-event-description" placeholder="Описание">${escapeHtml(event.description)}</textarea>
                </div>
                <div class="event-admin-actions">
                    <button class="admin-edit-btn" onclick="saveEvent('${event.id}')"><i class="fas fa-save"></i></button>
                    <button class="admin-delete-btn" onclick="deleteEvent('${event.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }
    
    window.saveEvent = (eventId) => {
        const div = document.querySelector(`.event-admin-item[data-event-id="${eventId}"]`);
        if (!div) return;
        const title = div.querySelector('.edit-event-title').value.trim();
        const date = div.querySelector('.edit-event-date').value;
        const time = div.querySelector('.edit-event-time').value;
        const location = div.querySelector('.edit-event-location').value.trim();
        const description = div.querySelector('.edit-event-description').value.trim();
        if (!title || !date || !time) { showToast('Заполните название, дату и время', 'error'); return; }
        const idx = events.findIndex(e => e.id === eventId);
        if (idx !== -1) {
            events[idx] = { ...events[idx], title, date, time, location, description };
            saveAll();
            renderAdminEventsList();
            renderEventsList();
            showToast('Событие обновлено');
        }
    };
    
    window.deleteEvent = (eventId) => {
        if (confirm('Удалить событие?')) {
            const eventTitle = events.find(e => e.id === eventId)?.title;
            events = events.filter(e => e.id !== eventId);
            saveAll();
            renderAdminEventsList();
            renderEventsList();
            showAdminToast(`Событие "${eventTitle}" удалено`, 'error');
        }
    };
    
    function addEvent() {
        const title = document.getElementById('newEventTitle')?.value.trim();
        const date = document.getElementById('newEventDate')?.value;
        const time = document.getElementById('newEventTime')?.value;
        const location = document.getElementById('newEventLocation')?.value.trim();
        const description = document.getElementById('newEventDescription')?.value.trim();
        if (!title || !date || !time) { showToast('Заполните название, дату и время', 'error'); return; }
        events.push({ id: 'event_' + Date.now(), title, date, time, location: location || 'Не указано', description: description || '' });
        saveAll();
        renderAdminEventsList();
        renderEventsList();
        document.getElementById('newEventTitle').value = '';
        document.getElementById('newEventDate').value = '';
        document.getElementById('newEventTime').value = '';
        document.getElementById('newEventLocation').value = '';
        document.getElementById('newEventDescription').value = '';
        closeModal('addEventModal');
        showAdminToast(`Событие "${title}" добавлено`, 'success');
    }
    
    // ========== УПРАВЛЕНИЕ ГРУППАМИ ==========
    function renderGroupCards() {
        const container = document.getElementById('groupCardsContainer');
        if (!container) return;
        const allGroups = ['Все группы', ...groups.map(g => g.name)];
        if (allGroups.length === 1) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-layer-group"></i><p>Нет групп. Создайте группу в разделе "Группы"</p></div>';
            return;
        }
        container.innerHTML = allGroups.map(groupName => {
            const count = groupName === 'Все группы' ? Object.keys(students).length : Object.values(students).filter(s => s.group === groupName).length;
            return `<div class="group-card ${selectedScheduleGroup === groupName ? 'active' : ''}" onclick="selectScheduleGroup('${groupName}')">
                <div class="group-card-icon"><i class="fas ${groupName === 'Все группы' ? 'fa-users' : 'fa-layer-group'}"></i></div>
                <div class="group-card-name">${escapeHtml(groupName)}</div>
                <div class="group-card-count">${count} студ.</div>
            </div>`;
        }).join('');
    }
    
    window.selectScheduleGroup = (groupName) => {
        selectedScheduleGroup = groupName;
        selectedScheduleDay = 0;
        renderGroupCards();
        document.getElementById('scheduleEditorCard').style.display = 'block';
        document.getElementById('selectedGroupName').textContent = groupName;
        document.querySelectorAll('.day-tab').forEach((tab,i) => tab.classList.toggle('active', i===0));
        renderPairsList();
    };
    
    function renderPairsList() {
        const container = document.getElementById('adminPairsList');
        if (!container) return;
        if (!weekSchedule[selectedScheduleDay]) weekSchedule[selectedScheduleDay] = {};
        if (!weekSchedule[selectedScheduleDay][selectedScheduleGroup]) weekSchedule[selectedScheduleDay][selectedScheduleGroup] = [];
        const pairs = weekSchedule[selectedScheduleDay][selectedScheduleGroup];
        if (pairs.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>Нет пар</p></div>';
            return;
        }
        container.innerHTML = pairs.map((p, i) => `
            <div class="pair-edit-item">
                <input type="text" class="pair-time-input" value="${p.time}" placeholder="Время" style="width:120px">
                <input type="text" class="pair-name-input" value="${p.name}" placeholder="Название" style="flex:2">
                <input type="text" class="pair-teacher-input" value="${p.teacher}" placeholder="Преподаватель" style="flex:1.5">
                <input type="text" class="pair-room-input" value="${p.room||''}" placeholder="Аудитория" style="width:100px">
                <input type="number" class="pair-reward-input" value="${p.reward}" placeholder="Алмазы" style="width:80px">
                <button class="admin-edit-btn" onclick="savePairEdit(${selectedScheduleDay}, ${i}, '${selectedScheduleGroup}')"><i class="fas fa-save"></i></button>
                <button class="admin-delete-btn" onclick="deletePair(${selectedScheduleDay}, ${i}, '${selectedScheduleGroup}')"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
    }
    
    window.savePairEdit = (day, index, group) => {
        const items = document.querySelectorAll('.pair-edit-item');
        const item = items[index];
        if (!item) return;
        if (!weekSchedule[day]) weekSchedule[day] = {};
        if (!weekSchedule[day][group]) weekSchedule[day][group] = [];
        weekSchedule[day][group][index] = {
            ...weekSchedule[day][group][index],
            time: item.querySelector('.pair-time-input').value,
            name: item.querySelector('.pair-name-input').value,
            teacher: item.querySelector('.pair-teacher-input').value,
            room: item.querySelector('.pair-room-input').value,
            reward: parseInt(item.querySelector('.pair-reward-input').value) || 50
        };
        saveAll();
        renderPairsList();
        renderSchedule();
        showToast('Пара обновлена');
    };
    
    window.deletePair = (day, index, group) => {
        if (confirm('Удалить пару?')) {
            const pairName = weekSchedule[day]?.[group]?.[index]?.name;
            if (weekSchedule[day]?.[group]) weekSchedule[day][group].splice(index,1);
            saveAll();
            renderPairsList();
            renderSchedule();
            showAdminToast(`Пара "${pairName}" удалена`, 'error');
        }
    };
    
    function addPair() {
        const time = document.getElementById('editPairTime')?.value.trim();
        const name = document.getElementById('editPairName')?.value.trim();
        if (!time || !name) { showToast('Введите время и название', 'error'); return; }
        if (!weekSchedule[selectedScheduleDay]) weekSchedule[selectedScheduleDay] = {};
        if (!weekSchedule[selectedScheduleDay][selectedScheduleGroup]) weekSchedule[selectedScheduleDay][selectedScheduleGroup] = [];
        weekSchedule[selectedScheduleDay][selectedScheduleGroup].push({
            id: 'pair_' + Date.now(),
            time: time,
            name: name,
            teacher: document.getElementById('editPairTeacher')?.value.trim() || 'Преподаватель',
            room: document.getElementById('editPairRoom')?.value.trim() || '',
            reward: parseInt(document.getElementById('editPairReward')?.value) || 50
        });
        saveAll();
        document.getElementById('editPairName').value = '';
        document.getElementById('editPairTeacher').value = '';
        document.getElementById('editPairRoom').value = '';
        document.getElementById('editPairReward').value = '';
        renderPairsList();
        renderSchedule();
        showAdminToast(`Пара "${name}" добавлена`, 'success');
    }
    
    // ========== СПИСОК СТУДЕНТОВ ==========
    function renderStudentsList() {
        const container = document.getElementById('studentsList');
        if (!container) return;
        let filtered = Object.values(students);
        if (studentsGroupFilter !== 'Все группы') filtered = filtered.filter(s => s.group === studentsGroupFilter);
        if (studentsSearchTerm) filtered = filtered.filter(s => s.name.toLowerCase().includes(studentsSearchTerm) || s.group.toLowerCase().includes(studentsSearchTerm));
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Студенты не найдены</p></div>';
            return;
        }
        container.innerHTML = filtered.map(s => {
            const userLogin = Object.keys(users).find(k => users[k].studentId === s.id) || '-';
            const userPassword = users[userLogin]?.password || '-';
            return `
            <div class="student-card" data-student-id="${s.id}">
                <div class="student-header">
                    <div><div class="student-name">${escapeHtml(s.name)}</div><div class="student-group">${escapeHtml(s.group)} | Логин: ${escapeHtml(userLogin)} | Пароль: <span style="color:var(--warning)">${userPassword !== '-' ? userPassword : '-'}</span></div></div>
                    <select class="group-change-select" data-id="${s.id}" onchange="changeStudentGroup('${s.id}', this.value)">
                        ${groups.map(g => `<option value="${g.name}" ${s.group === g.name ? 'selected' : ''}>${g.name}</option>`).join('')}
                    </select>
                </div>
                <div class="student-stats-row">
                    <div class="stat-badge-new crystals"><i class="fas fa-gem"></i><span id="balance-${s.id}">${s.balance}</span><span> кристаллов</span></div>
                    <div class="stat-badge-new exp"><i class="fas fa-star"></i><span>${s.totalEarned || 0}</span><span> опыта</span></div>
                </div>
                <div class="student-actions-row">
                    <div class="control-group"><input type="number" id="balanceInput-${s.id}" placeholder="Сумма"><button class="action-btn add" onclick="addToBalance('${s.id}')"><i class="fas fa-plus"></i></button><button class="action-btn set" onclick="setBalance('${s.id}')"><i class="fas fa-equals"></i></button></div>
                    <div class="control-group"><input type="number" id="expInputStudent-${s.id}" placeholder="Опыт"><button class="action-btn add" onclick="addExperienceFromStudent('${s.id}')"><i class="fas fa-plus"></i></button><button class="action-btn set" onclick="setExperienceFromStudent('${s.id}')"><i class="fas fa-equals"></i></button></div>
                    <button class="action-btn delete" onclick="deleteStudent('${s.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    }
    
    window.addExperienceFromStudent = (studentId) => {
        const input = document.getElementById(`expInputStudent-${studentId}`);
        const amount = parseInt(input?.value) || 0;
        const student = students[studentId];
        if (student && amount > 0) {
            student.totalEarned = (student.totalEarned || 0) + amount;
            student.history.unshift({ time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }), action: 'Начисление опыта', details: `+${amount} опыта` });
            saveAll();
            renderStudentsList();
            renderLeaderboardAdmin();
            renderLeaderboard();
            if (currentUser?.studentId === studentId) updateAllDisplays();
            showAdminToast(`+${amount} опыта добавлено студенту ${student.name}`, 'success');
            input.value = '';
        }
    };
    
    window.setExperienceFromStudent = (studentId) => {
        const input = document.getElementById(`expInputStudent-${studentId}`);
        const newExp = parseInt(input?.value) || 0;
        const student = students[studentId];
        if (student && newExp >= 0) {
            const oldExp = student.totalEarned || 0;
            student.totalEarned = newExp;
            student.history.unshift({ time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }), action: 'Установка опыта', details: `Опыт установлен на ${newExp} (было: ${oldExp})` });
            saveAll();
            renderStudentsList();
            renderLeaderboardAdmin();
            renderLeaderboard();
            if (currentUser?.studentId === studentId) updateAllDisplays();
            showAdminToast(`Опыт студента ${student.name} установлен на ${newExp}`, 'success');
            input.value = '';
        }
    };
    
    window.addToBalance = (studentId) => {
        const input = document.getElementById(`balanceInput-${studentId}`);
        const amount = parseInt(input?.value) || 0;
        const student = students[studentId];
        if (student && amount > 0) {
            student.balance += amount;
            student.history.unshift({ time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }), action: 'Начисление кристаллов', details: `+${amount} 💎` });
            saveAll();
            updateBalanceDisplay(studentId);
            showAdminToast(`+${amount} 💎 добавлено студенту ${student.name}`, 'success');
            input.value = '';
        }
    };
    
    window.setBalance = (studentId) => {
        const input = document.getElementById(`balanceInput-${studentId}`);
        const amount = parseInt(input?.value) || 0;
        const student = students[studentId];
        if (student && amount >= 0) {
            const oldBalance = student.balance;
            student.balance = amount;
            student.history.unshift({ time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }), action: 'Установка кристаллов', details: `Баланс установлен на ${amount} 💎 (было: ${oldBalance})` });
            saveAll();
            updateBalanceDisplay(studentId);
            showAdminToast(`Баланс студента ${student.name} установлен на ${amount} 💎`, 'success');
            input.value = '';
        }
    };
    
    function updateBalanceDisplay(studentId) {
        const span = document.getElementById(`balance-${studentId}`);
        if (span) span.textContent = students[studentId]?.balance || 0;
        if (currentUser?.studentId === studentId) updateAllDisplays();
    }
    
    window.changeStudentGroup = (studentId, newGroup) => {
        if (students[studentId]) {
            const oldGroup = students[studentId].group;
            students[studentId].group = newGroup;
            students[studentId].attendedPairs = {};
            students[studentId].history.unshift({ time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }), action: 'Смена группы', details: `Переведён из ${oldGroup} в ${newGroup} (посещаемость обнулена)` });
            saveAll();
            renderStudentsList();
            if (currentUser?.studentId === studentId) { renderSchedule(); updateAllDisplays(); }
            showAdminToast(`Студент ${students[studentId].name} переведён в группу ${newGroup}, посещаемость обнулена`, 'warning');
        }
    };
    
    window.deleteStudent = (id) => {
        if (confirm('Удалить студента?')) {
            const studentName = students[id]?.name;
            delete students[id];
            Object.keys(users).forEach(k => { if (users[k].studentId === id) delete users[k]; });
            saveAll();
            renderStudentsList();
            showAdminToast(`Студент "${studentName}" удалён`, 'error');
        }
    };
    
    function renderGroupsList() {
        const container = document.getElementById('groupsList');
        if (!container) return;
        if (groups.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-layer-group"></i><p>Нет групп</p></div>';
            return;
        }
        container.innerHTML = groups.map(g => `
            <div class="group-card-new">
                <span>${escapeHtml(g.name)}</span>
                <button class="action-btn delete" onclick="deleteGroup('${g.id}')"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
    }
    
    window.deleteGroup = (id) => {
        if (groups.length <= 1) { showToast('Должна быть хотя бы одна группа', 'error'); return; }
        const deletedGroup = groups.find(g => g.id === id);
        groups = groups.filter(g => g.id !== id);
        if (deletedGroup && groups.length) {
            const newGroup = groups[0].name;
            Object.values(students).forEach(s => { if (s.group === deletedGroup.name) s.group = newGroup; });
        }
        saveAll();
        populateAdminSelects();
        renderGroupsList();
        renderStudentsList();
        showAdminToast(`Группа "${deletedGroup?.name}" удалена`, 'error');
    };
    
    // ========== ПОСЕЩАЕМОСТЬ ==========
    function setupAttendanceEditor() {
        const container = document.getElementById('groupAttendanceEditor');
        if (container) container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>Выберите группу и день</p></div>';
    }
    
    function renderGroupAttendance() {
        const group = document.getElementById('attendanceGroupSelect')?.value;
        const day = parseInt(document.getElementById('attendanceDaySelect')?.value || '0');
        const container = document.getElementById('groupAttendanceEditor');
        if (!container || !group) return;
        const pairs = getPairsForDay(day, group);
        const groupStudents = Object.values(students).filter(s => s.group === group || group === 'Все группы');
        if (pairs.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>Нет пар</p></div>'; return; }
        if (groupStudents.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Нет студентов в группе</p></div>'; return; }
        container.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px"><h3>${dayNames[day]} - ${group}</h3><button class="btn-primary" onclick="markAllPairs('${group}',${day})"><i class="fas fa-check-double"></i> Отметить всех</button></div>` +
            pairs.map(p => `
                <div class="group-pair-block">
                    <div style="display:flex;justify-content:space-between;margin-bottom:15px;flex-wrap:wrap;gap:10px"><strong>${p.time} - ${p.name} (${p.teacher}) +${p.reward}💎 +${p.reward} опыта</strong><button class="btn-small" onclick="markPair('${group}','${p.id}',${p.reward},'${p.name}')">Отметить группу</button></div>
                    <div class="group-students-list">${groupStudents.map(s => `<div class="group-student-item ${s.attendedPairs?.[p.id] ? 'attended' : ''}" onclick="toggleAttendance('${s.id}','${p.id}',${p.reward},'${p.name}')"><span>${escapeHtml(s.name)}</span><span>${s.attendedPairs?.[p.id] ? '✅' : '⏳'}</span></div>`).join('')}</div>
                </div>
            `).join('');
    }
    
    window.toggleAttendance = (sid, pid, reward, pname) => {
        const s = students[sid];
        if (!s) return;
        if (!s.attendedPairs) s.attendedPairs = {};
        
        if (s.attendedPairs[pid]) {
            delete s.attendedPairs[pid];
            s.balance -= reward;
            s.totalEarned = (s.totalEarned || 0) - reward;
            showToast(`❌ Студент ${s.name}\nСнята отметка с пары: ${pname}\n-${reward} 💎 и -${reward} опыта`, 'warning');
        } else {
            s.attendedPairs[pid] = true;
            s.balance += reward;
            s.totalEarned = (s.totalEarned || 0) + reward;
            s.history.unshift({ 
                time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), 
                action: 'Посещение', 
                details: `${pname} (+${reward}💎) (+${reward} опыта)` 
            });
            showToast(`✅ Студент ${s.name}\nОтмечен на паре: ${pname}\n+${reward} 💎 и +${reward} опыта`, 'success');
        }
        
        saveAll(); 
        renderGroupAttendance(); 
        if (currentUser?.studentId === sid) {
            updateAllDisplays();
            renderSchedule();
        }
    };
    
    window.markPair = (group, pid, reward, pname) => {
        let markedCount = 0;
        Object.values(students).forEach(s => {
            if (group === 'Все группы' || s.group === group) {
                if (!s.attendedPairs) s.attendedPairs = {};
                if (!s.attendedPairs[pid]) {
                    s.attendedPairs[pid] = true;
                    s.balance += reward;
                    s.totalEarned = (s.totalEarned || 0) + reward;
                    s.history.unshift({ time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }), action: 'Посещение', details: `${pname} (+${reward}💎) (+${reward} опыта)` });
                    markedCount++;
                }
            }
        });
        saveAll();
        renderGroupAttendance();
        if (currentUser?.role === 'student') { updateAllDisplays(); renderSchedule(); }
        showAdminToast(`Отмечено ${markedCount} студентов на паре "${pname}"`, 'success');
    };
    
    window.markAllPairs = (group, day) => {
        let totalMarked = 0;
        getPairsForDay(day, group).forEach(p => {
            Object.values(students).forEach(s => {
                if (group === 'Все группы' || s.group === group) {
                    if (!s.attendedPairs) s.attendedPairs = {};
                    if (!s.attendedPairs[p.id]) {
                        s.attendedPairs[p.id] = true;
                        s.balance += p.reward;
                        s.totalEarned = (s.totalEarned || 0) + p.reward;
                        s.history.unshift({ time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }), action: 'Посещение', details: `${p.name} (+${p.reward}💎) (+${p.reward} опыта)` });
                        totalMarked++;
                    }
                }
            });
        });
        saveAll();
        renderGroupAttendance();
        if (currentUser?.role === 'student') { updateAllDisplays(); renderSchedule(); }
        showAdminToast(`Отмечено ${totalMarked} посещений за день`, 'success');
    };
    
    // ========== РЕДАКТОР МАГАЗИНА ==========
    function renderAdminShopList() {
        const container = document.getElementById('adminShopItemsList');
        if (!container) return;
        if (shopItems.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-box"></i><p>Нет товаров</p></div>';
            return;
        }
        container.innerHTML = shopItems.map((item, i) => `
            <div class="admin-shop-item">
                <span style="font-size:24px">${item.emoji}</span>
                <input type="text" class="admin-edit-name" value="${escapeHtml(item.name)}">
                <input type="number" class="admin-edit-price" value="${item.price}">
                <input type="number" class="admin-edit-stock" value="${item.stock}">
                <button class="admin-edit-btn" data-i="${i}"><i class="fas fa-save"></i></button>
                <button class="admin-delete-btn" data-i="${i}"><i class="fas fa-trash"></i></button>
            </div>
        `).join('');
        container.querySelectorAll('.admin-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = btn.dataset.i, div = btn.closest('.admin-shop-item');
                const oldName = shopItems[i].name;
                shopItems[i].name = div.querySelector('.admin-edit-name').value;
                shopItems[i].price = parseInt(div.querySelector('.admin-edit-price').value);
                shopItems[i].stock = parseInt(div.querySelector('.admin-edit-stock').value);
                saveAll();
                renderAdminShopList();
                renderShop();
                showAdminToast(`Товар "${oldName}" обновлён`, 'success');
            });
        });
        container.querySelectorAll('.admin-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemName = shopItems[btn.dataset.i]?.name;
                shopItems.splice(btn.dataset.i, 1);
                saveAll();
                renderAdminShopList();
                renderShop();
                showAdminToast(`Товар "${itemName}" удалён`, 'error');
            });
        });
    }
    
    function addItem() {
        const name = document.getElementById('newItemName')?.value.trim();
        const emoji = document.getElementById('newItemEmoji')?.value || '🎁';
        const price = parseInt(document.getElementById('newItemPrice')?.value);
        const stock = parseInt(document.getElementById('newItemStock')?.value);
        if (!name) { showToast('Введите название', 'error'); return; }
        if (isNaN(price) || price < 1) { showToast('Введите цену', 'error'); return; }
        if (isNaN(stock) || stock < 0) { showToast('Введите количество', 'error'); return; }
        shopItems.push({ id: 'item_' + Date.now(), name, emoji, price, stock });
        saveAll();
        renderAdminShopList();
        renderShop();
        document.getElementById('newItemName').value = '';
        document.getElementById('newItemPrice').value = '';
        document.getElementById('newItemStock').value = '';
        document.getElementById('newItemEmoji').value = '🎁';
        closeModal('addItemModal');
        showAdminToast(`Товар "${name}" добавлен`, 'success');
    }
    
    // ========== РЕДАКТОР ПРОМОКОДОВ ==========
    function renderAdminPromoList() {
        const container = document.getElementById('adminBonusList');
        if (!container) return;
        if (promoCodes.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-ticket-alt"></i><p>Нет промокодов</p></div>';
            return;
        }
        container.innerHTML = promoCodes.map((p, i) => {
            let rewardText = '';
            if (p.rewardCrystals > 0 && p.rewardExp > 0) rewardText = `+${p.rewardCrystals} 💎 +${p.rewardExp} опыта`;
            else if (p.rewardCrystals > 0) rewardText = `+${p.rewardCrystals} 💎`;
            else if (p.rewardExp > 0) rewardText = `+${p.rewardExp} опыта`;
            return `<div class="bonus-list-item"><div><span class="bonus-list-code">${p.code}</span><div class="bonus-list-details">${rewardText} | ${p.usedCount}/${p.maxUses}</div></div><div><button class="admin-edit-btn ${p.active ? 'toggle-on' : 'toggle-off'}" onclick="togglePromo(${i})"><i class="fas fa-${p.active ? 'toggle-on' : 'toggle-off'}"></i></button><button class="admin-delete-btn" onclick="deletePromo(${i})"><i class="fas fa-trash"></i></button></div></div>`;
        }).join('');
    }
    
    window.togglePromo = (i) => { 
        const wasActive = promoCodes[i].active;
        const code = promoCodes[i].code;
        promoCodes[i].active = !promoCodes[i].active; 
        saveAll(); 
        renderAdminPromoList(); 
        const status = promoCodes[i].active ? 'активирован' : 'деактивирован';
        showAdminToast(`Промокод "${code}" ${status}`, promoCodes[i].active ? 'success' : 'warning');
    };
    
    window.deletePromo = (i) => { 
        const code = promoCodes[i].code;
        promoCodes.splice(i, 1); 
        saveAll(); 
        renderAdminPromoList(); 
        showAdminToast(`Промокод "${code}" удалён`, 'error');
    };
    
    function addPromo() {
        const code = document.getElementById('newBonusCode')?.value.trim().toUpperCase();
        const crystals = parseInt(document.getElementById('newBonusReward')?.value);
        const exp = parseInt(document.getElementById('newBonusExp')?.value);
        const uses = parseInt(document.getElementById('newBonusUses')?.value);
        
        if (!code) { showToast('Введите код', 'error'); return; }
        if (isNaN(crystals) || crystals < 0) { showToast('Введите кристаллы', 'error'); return; }
        if (isNaN(exp) || exp < 0) { showToast('Введите опыт', 'error'); return; }
        if (isNaN(uses) || uses < 1) { showToast('Введите количество использований', 'error'); return; }
        if (crystals === 0 && exp === 0) { showToast('Укажите хотя бы одну награду', 'error'); return; }
        if (promoCodes.some(p => p.code === code)) { showToast('Такой код уже существует', 'error'); return; }
        
        promoCodes.push({ code, rewardCrystals: crystals, rewardExp: exp, maxUses: uses, usedCount: 0, active: true });
        saveAll();
        renderAdminPromoList();
        
        let rewardText = '';
        if (crystals > 0 && exp > 0) rewardText = `${crystals} 💎 и ${exp} опыта`;
        else if (crystals > 0) rewardText = `${crystals} 💎`;
        else if (exp > 0) rewardText = `${exp} опыта`;
        
        showAdminToast(`Промокод "${code}" создан! Награда: ${rewardText}`, 'success');
        
        document.getElementById('newBonusCode').value = '';
        document.getElementById('newBonusReward').value = '';
        document.getElementById('newBonusExp').value = '';
        document.getElementById('newBonusUses').value = '';
        closeModal('addPromoModal');
    }
    
    function addStudent() {
        const name = document.getElementById('newStudentName')?.value.trim();
        const login = document.getElementById('newStudentLogin')?.value.trim();
        const pass = document.getElementById('newStudentPassword')?.value;
        const group = document.getElementById('newStudentGroup')?.value;
        if (!pass) { showToast('Введите пароль', 'error'); return; }
        if (!name || !login) { showToast('Заполните имя и логин', 'error'); return; }
        if (users[login]) { showToast('Логин уже существует', 'error'); return; }
        if (!group || group === 'Все группы') { showToast('Выберите группу', 'error'); return; }
        const id = 'student_' + Date.now();
        students[id] = { id, name, group, balance: 0, attendedPairs: {}, history: [], itemsOwned: 0, totalEarned: 0, usedPromoCodes: [] };
        users[login] = { password: pass, role: 'student', studentId: id };
        saveAll();
        renderStudentsList();
        document.getElementById('newStudentName').value = '';
        document.getElementById('newStudentLogin').value = '';
        document.getElementById('newStudentPassword').value = '';
        closeModal('addStudentModal');
        showAdminToast(`Студент "${name}" добавлен`, 'success');
    }
    
    function addGroup() {
        const name = document.getElementById('newGroupName')?.value.trim();
        if (!name) { showToast('Введите название группы', 'error'); return; }
        groups.push({ id: 'group_' + Date.now(), name });
        initScheduleForGroup(name);
        saveAll();
        populateAdminSelects();
        renderGroupsList();
        renderStudentsList();
        document.getElementById('newGroupName').value = '';
        closeModal('addGroupModal');
        showAdminToast(`Группа "${name}" создана`, 'success');
    }
    
    // ========== МОДАЛЬНЫЕ ОКНА ==========
    function showModal(modalId) {
        document.getElementById(modalId)?.classList.add('active');
    }
    
    function closeModal(modalId) {
        document.getElementById(modalId)?.classList.remove('active');
    }
    
    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    function init() {
        try {
            if (currentUser && typeof currentUser !== 'object') { localStorage.removeItem('currentUser'); currentUser = null; }
            if (currentUser && currentUser.role === 'student' && !students[currentUser.studentId]) { localStorage.removeItem('currentUser'); currentUser = null; }
        } catch(e) { localStorage.removeItem('currentUser'); currentUser = null; }
        
        if (currentUser?.role === 'admin') {
            document.body.classList.add('admin-mode');
        }
        
        authScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
        
        if (currentUser) {
            const s = currentUser.role === 'student' ? students[currentUser.studentId] : null;
            if (currentUser.role === 'admin' || (currentUser.role === 'student' && s)) {
                authScreen.classList.add('hidden');
                mainApp.classList.remove('hidden');
                if (userName) userName.textContent = currentUser.role === 'admin' ? 'Администратор' : s?.name;
                if (userRole) userRole.textContent = currentUser.role === 'admin' ? 'Управление' : s?.group;
                if (userAvatar) userAvatar.innerHTML = currentUser.role === 'admin' ? '<i class="fas fa-crown"></i>' : '<i class="fas fa-user-graduate"></i>';
                adminOnly.forEach(el => el.classList.toggle('hidden', currentUser.role !== 'admin'));
                studentOnly.forEach(el => el.classList.toggle('hidden', currentUser.role === 'admin'));
                
                if (currentUser.role === 'admin') {
                    switchPage('students');
                    renderAdminPanel();
                } else {
                    switchPage('schedule');
                    updateAllDisplays();
                    renderSchedule();
                    renderShop();
                    renderHistory();
                    renderLeaderboard();
                    renderUsedPromoCodes();
                }
            } else {
                localStorage.removeItem('currentUser');
                currentUser = null;
            }
        }
        
        // События
        authTabs.forEach(t => t.addEventListener('click', () => {
            authTabs.forEach(tab => tab.classList.remove('active'));
            t.classList.add('active');
            selectedRole = t.dataset.role;
            loginInput.value = '';
            passwordInput.value = '';
        }));
        
        loginForm.addEventListener('submit', e => {
            e.preventDefault();
            if (login(loginInput.value, passwordInput.value)) {
                authScreen.classList.add('hidden');
                mainApp.classList.remove('hidden');
                if (currentUser.role === 'admin') {
                    userName.textContent = 'Администратор';
                    userRole.textContent = 'Управление';
                    userAvatar.innerHTML = '<i class="fas fa-crown"></i>';
                    adminOnly.forEach(el => el.classList.remove('hidden'));
                    studentOnly.forEach(el => el.classList.add('hidden'));
                    switchPage('students');
                    renderAdminPanel();
                } else {
                    const s = students[currentUser.studentId];
                    userName.textContent = s?.name;
                    userRole.textContent = s?.group;
                    userAvatar.innerHTML = '<i class="fas fa-user-graduate"></i>';
                    adminOnly.forEach(el => el.classList.add('hidden'));
                    studentOnly.forEach(el => el.classList.remove('hidden'));
                    switchPage('schedule');
                    updateAllDisplays();
                    renderSchedule();
                    renderShop();
                    renderHistory();
                    renderLeaderboard();
                    renderUsedPromoCodes();
                }
            }
        });
        
        logoutBtn.addEventListener('click', logout);
        navLinks.forEach(l => l.addEventListener('click', e => { e.preventDefault(); switchPage(l.dataset.page); }));
        dayBtns.forEach((btn, i) => btn.addEventListener('click', () => {
            dayBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDay = i;
            renderSchedule();
        }));
        
        document.getElementById('submitBonusCodeBtn')?.addEventListener('click', activatePromoCode);
        document.getElementById('bonusCodeInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') activatePromoCode(); });
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => { const s = getCurrentStudent(); if (s) { s.history = []; saveAll(); renderHistory(); showToast('История очищена'); } });
        document.getElementById('loadGroupScheduleBtn')?.addEventListener('click', renderGroupAttendance);
        
        // Поддержка - события
        document.getElementById('sendMessageBtn')?.addEventListener('click', sendMessage);
        document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Общий чат события
        document.getElementById('sendCommonMessageBtn')?.addEventListener('click', sendCommonMessage);
        document.getElementById('commonMessageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendCommonMessage();
            }
        });
        
        // Админ общий чат события
        const adminSendBtn = document.getElementById('sendAdminCommonMessageBtn');
        if (adminSendBtn) {
            adminSendBtn.addEventListener('click', sendAdminCommonMessage);
        }
        const adminCommonInput = document.getElementById('adminCommonMessageInput');
        if (adminCommonInput) {
            adminCommonInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendAdminCommonMessage();
                }
            });
        }
        
        // Очистка общего чата (админ)
        const clearChatBtn = document.getElementById('clearCommonChatBtn');
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', clearCommonChat);
        }
        const adminClearChatBtn = document.getElementById('adminClearCommonChatBtn');
        if (adminClearChatBtn) {
            adminClearChatBtn.addEventListener('click', clearCommonChat);
        }
        
        // Фильтры заявок для админа
        document.querySelectorAll('.status-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentAdminFilter = btn.dataset.filter;
                renderAdminTickets();
            });
        });
        
        const searchInput = document.getElementById('studentsSearchInput');
        const groupFilter = document.getElementById('studentsGroupFilter');
        if (searchInput) searchInput.addEventListener('input', e => { studentsSearchTerm = e.target.value.toLowerCase(); renderStudentsList(); });
        if (groupFilter) groupFilter.addEventListener('change', e => { studentsGroupFilter = e.target.value; renderStudentsList(); });
        
        document.querySelectorAll('.day-tab').forEach((tab, i) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                selectedScheduleDay = i;
                renderPairsList();
            });
        });
        
        document.getElementById('changeGroupBtn')?.addEventListener('click', () => {
            document.getElementById('scheduleEditorCard').style.display = 'none';
        });
        
        const addPairBtn = document.getElementById('adminAddPairBtn');
        if (addPairBtn) {
            const newBtn = addPairBtn.cloneNode(true);
            addPairBtn.parentNode.replaceChild(newBtn, addPairBtn);
            newBtn.addEventListener('click', addPair);
        }
        
        // Модальные окна
        document.getElementById('showAddStudentModal')?.addEventListener('click', () => showModal('addStudentModal'));
        document.getElementById('showAddGroupModal')?.addEventListener('click', () => showModal('addGroupModal'));
        document.getElementById('showAddEventModal')?.addEventListener('click', () => showModal('addEventModal'));
        document.getElementById('showAddItemModal')?.addEventListener('click', () => showModal('addItemModal'));
        document.getElementById('showAddPromoModal')?.addEventListener('click', () => showModal('addPromoModal'));
        
        document.querySelectorAll('.modal-close, .btn-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal')?.classList.remove('active');
            });
        });
        
        document.getElementById('adminAddStudentBtn')?.addEventListener('click', addStudent);
        document.getElementById('adminAddGroupBtn')?.addEventListener('click', addGroup);
        document.getElementById('adminAddEventBtn')?.addEventListener('click', addEvent);
        document.getElementById('adminAddItemBtn')?.addEventListener('click', addItem);
        document.getElementById('adminAddBonusBtn')?.addEventListener('click', addPromo);
        
        populateAdminSelects();
    }
    
    init();
})();