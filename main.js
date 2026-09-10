// assets/js/main.js — точка входа приложения SHub

// ============================================================
// ИМПОРТ ЯДРА
// ============================================================
import { state } from './core/state.js';
import { apiCall, fetchJson } from './core/api.js';
import {
    escapeHtml, formatTime, formatDateTime, formatTimeOnly, formatDateOnly,
    formatFileSizeDisplay, getFileIconByName, downloadFile,
    containsProfanity, getStockInfo, isAdminOrFounder
} from './core/utils.js';
import { showToast, showModal, closeModal } from './core/ui.js';

// ============================================================
// ИМПОРТ МОДУЛЕЙ
// ============================================================
import {
    login, logout, performLogout, checkSessionAndLockdown,
    showLockdownScreen, hideLockdownScreen, initAuthForm, initHeaderLogout
} from './modules/auth.js';

import { initThemeToggle } from './modules/theme.js';
import { initCustomCursor } from './modules/cursor.js';

import {
    applySeasonToUI, updateSeasonIcon, showSeasonModal, initSeasonToggle,
    initSeason, renderSeasonManagement, applyGlobalSeason,
    startGlobalSeasonCheck, stopGlobalSeasonCheck, checkGlobalSeason
} from './modules/seasons.js';

import {
    loadNotifications, updateNotificationsBadge, openNotificationsModal,
    closeNotificationsModal, initNotifications, startNotificationsPolling,
    stopNotificationsPolling
} from './modules/notifications.js';

import { renderSchedule, initScheduleTabs } from './modules/schedule.js';
import { renderEvents } from './modules/events.js';
import { renderShop, buyShopItem } from './modules/shop.js';
import {
    renderTitlesShop, handleTitleClick, refreshTitleInChat,
    getUserTitleForChat, createTitleBadge
} from './modules/titles.js';

// ⚡ ПРОМОКОДЫ — добавлен initPromocodes
import { activatePromoCode, renderUsedPromoCodes, initPromocodes } from './modules/promocodes.js';

import { renderHistory, clearHistory } from './modules/history.js';
import { renderLeaderboard, renderAdminLeaderboard } from './modules/leaderboard.js';

import {
    renderCommonChat, renderAdminCommonChat, sendCommonMessage, sendAdminCommonMessage,
    deleteCommonMessage, clearCommonChat, renderCommonChatMessageText,
    startPolling, stopPolling, startTitlePolling, stopTitlePolling,
    initCharCounters, initChatEnterHandlers, initUnreadCheck,
    initCommonChatButtons
} from './modules/common-chat.js';

import {
    getCurrentChatUserInfo, getCurrentChatParticipantId, canUseMessenger,
    loadStudentChatsMessenger, selectChat, sendChatMessage,
    editChatMessage, deleteChatMessage, deleteConversation,
    renameGroup, removeParticipantFromGroup, leaveGroup,
    switchMessengerTab, startChatWithUser, searchPeopleWithAdmins,
    initMessenger, showForwardModal, addImageUploadButton, addFileUploadButton,
    initImagePaste, initFilePaste, startMessengerPolling, stopMessengerPolling,
    startMessengerUpdatesPolling, stopMessengerUpdatesPolling,
    showCreateGroupModal, createGroupChat, showAddMembersModal, showGroupInfo,
    showAddAdminToGroupModal
} from './modules/messenger.js';

import {
    loadStudentChats, selectStudentChat, loadStudentMessages, sendStudentMessage,
    createNewTicket, loadAdminTickets, selectAdminChat, loadAdminMessages,
    sendAdminReply, deleteAdminChat, initAdminFilters, initSupportButtons,
    startTicketUpdatesPolling, stopTicketUpdatesPolling
} from './modules/support.js';

import {
    renderAdminStudents, addStudent, deleteStudent, addBal, setBal, addExp, setExp,
    changeStudentGroup, toggleInfiniteBalance, renameStudent, showGiveTitleModal,
    confirmGiveTitle, impersonateStudent, openStudentManagement, initStudentFilters,
    initStudentsModule
} from './modules/students.js';

import {
    renderAdminGroups, addGroup, delGroup, loadGroups, initGroupsModule
} from './modules/groups.js';

import { renderAttendance, toggleAtt, markAll, initAttendance } from './modules/attendance.js';
import {
    renderScheduleEditor, selGroup, selDay, savePair, delPair, addPair, initScheduleEditor
} from './modules/schedule-editor.js';
import {
    renderAdminEvents, addEvent, updateEventAdmin, deleteEventAdmin, initEventsEditor
} from './modules/events-editor.js';
import {
    renderAdminShop, addShopItem, updateShopItemAdmin, deleteShopItemAdmin,
    uploadItemImage, deleteItemImage, initShopEditor
} from './modules/shop-editor.js';
import {
    renderAdminPromos, addPromo, togglePromoAdmin, deletePromoAdmin,
    loadTitlesForPromoSelect, initPromosEditor
} from './modules/promos-editor.js';
import {
    renderAdminTitles, addTitle, editTitle, deleteTitleAdmin,
    toggleTitlePurchasable, initTitlesEditor
} from './modules/titles-editor.js';
import {
    initFounderStudent, updateFounderStatsDisplay, updateFounderStudentStats,
    toggleFounderMode, updateFounderName, addFounderBalance, setFounderBalance,
    addFounderExp, setFounderExp, renderAdminAccounts, delAdminFounder,
    addAdmin, updateFounderStats, initFounderPanel
} from './modules/founder.js';
import { loadAdminLogs, clearAdminLogs, initAdminLogs } from './modules/admin-logs.js';
import {
    loadPasswords, openSelfChangePasswordModal, openChangePasswordModal,
    confirmChangePassword, initPasswordToggles, initPasswords
} from './modules/passwords.js';

// ============================================================
// ЭКСПОРТ В WINDOW (для onclick в HTML)
// ============================================================
Object.assign(window, {
    state,
    apiCall, fetchJson,
    escapeHtml, formatTime, formatDateTime, formatTimeOnly, formatDateOnly,
    formatFileSizeDisplay, getFileIconByName, downloadFile,
    containsProfanity, getStockInfo, isAdminOrFounder,
    showToast, showModal, closeModal,
    login, logout, performLogout, checkSessionAndLockdown,
    showLockdownScreen, hideLockdownScreen,
    showSeasonModal, applyGlobalSeason, renderSeasonManagement,
    updateNotificationsBadge, openNotificationsModal, closeNotificationsModal,
    renderSchedule, renderEvents, renderShop, buyShopItem,
    renderTitlesShop, handleTitleClick, refreshTitleInChat,
    activatePromoCode, renderUsedPromoCodes,
    renderHistory, clearHistory,
    renderLeaderboard, renderAdminLeaderboard,
    renderCommonChat, renderAdminCommonChat, sendCommonMessage, sendAdminCommonMessage,
    deleteCommonMessage, clearCommonChat,
    getCurrentChatUserInfo, getCurrentChatParticipantId, canUseMessenger,
    loadStudentChatsMessenger, selectChat, sendChatMessage,
    editChatMessage, deleteChatMessage, deleteConversation,
    renameGroup, removeParticipantFromGroup, leaveGroup,
    switchMessengerTab, startChatWithUser, searchPeopleWithAdmins,
    showForwardModal, showCreateGroupModal, createGroupChat,
    showAddMembersModal, showGroupInfo, showAddAdminToGroupModal,
    loadStudentChats, selectStudentChat, sendStudentMessage, createNewTicket,
    loadAdminTickets, selectAdminChat, sendAdminReply, deleteAdminChat,
    renderAdminStudents, addStudent, deleteStudent, addBal, setBal, addExp, setExp,
    changeStudentGroup, toggleInfiniteBalance, renameStudent, showGiveTitleModal,
    confirmGiveTitle, impersonateStudent, openStudentManagement,
    renderAdminGroups, addGroup, delGroup, loadGroups,
    renderAttendance, toggleAtt, markAll,
    renderScheduleEditor, selGroup, selDay, savePair, delPair, addPair,
    renderAdminEvents, addEvent, updateEventAdmin, deleteEventAdmin,
    renderAdminShop, addShopItem, updateShopItemAdmin, deleteShopItemAdmin,
    uploadItemImage, deleteItemImage,
    renderAdminPromos, addPromo, togglePromoAdmin, deletePromoAdmin,
    renderAdminTitles, addTitle, editTitle, deleteTitleAdmin, toggleTitlePurchasable,
    toggleFounderMode, updateFounderName,
    addFounderBalance, setFounderBalance, addFounderExp, setFounderExp,
    renderAdminAccounts, delAdminFounder, addAdmin, updateFounderStats,
    loadAdminLogs, clearAdminLogs,
    loadPasswords, openSelfChangePasswordModal, openChangePasswordModal,
    confirmChangePassword, initPasswordToggles
});

// ============================================================
// УПРАВЛЕНИЕ POLLING
// ============================================================
const activePolling = {
    commonChat: false,
    titleUpdates: false,
    messenger: false,
    messengerUpdates: false,
    ticketUpdates: false
};

function startPollingByName(name) {
    if (activePolling[name]) return;
    switch (name) {
        case 'commonChat':
            if (typeof startPolling === 'function') { startPolling(); activePolling.commonChat = true; }
            break;
        case 'titleUpdates':
            if (typeof startTitlePolling === 'function') { startTitlePolling(); activePolling.titleUpdates = true; }
            break;
        case 'messengerUpdates':
            if (typeof startMessengerUpdatesPolling === 'function') { startMessengerUpdatesPolling(); activePolling.messengerUpdates = true; }
            break;
        case 'ticketUpdates':
            if (typeof startTicketUpdatesPolling === 'function') { startTicketUpdatesPolling(); activePolling.ticketUpdates = true; }
            break;
    }
}

function stopPollingByName(name) {
    if (!activePolling[name]) return;
    switch (name) {
        case 'commonChat':
            if (typeof stopPolling === 'function') stopPolling();
            activePolling.commonChat = false;
            break;
        case 'titleUpdates':
            if (typeof stopTitlePolling === 'function') stopTitlePolling();
            activePolling.titleUpdates = false;
            break;
        case 'messenger':
            if (typeof stopMessengerPolling === 'function') stopMessengerPolling();
            activePolling.messenger = false;
            break;
        case 'messengerUpdates':
            if (typeof stopMessengerUpdatesPolling === 'function') stopMessengerUpdatesPolling();
            activePolling.messengerUpdates = false;
            break;
        case 'ticketUpdates':
            if (typeof stopTicketUpdatesPolling === 'function') stopTicketUpdatesPolling();
            activePolling.ticketUpdates = false;
            break;
    }
}

function syncPollingWithPage(pageId) {
    // Общий чат
    if (pageId === 'common-chat' || pageId === 'common-chat-admin') {
        startPollingByName('commonChat');
        startPollingByName('titleUpdates');
    } else {
        stopPollingByName('commonChat');
        stopPollingByName('titleUpdates');
    }

    // Мессенджер
    if (pageId !== 'messenger') {
        stopPollingByName('messenger');
    }
    if (pageId === 'messenger') {
        startPollingByName('messengerUpdates');
    } else {
        stopPollingByName('messengerUpdates');
    }

    // Поддержка
    if (pageId === 'chat' || pageId === 'chat-admin') {
        startPollingByName('ticketUpdates');
    } else {
        stopPollingByName('ticketUpdates');
    }
}

// ============================================================
// ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ
// ============================================================
export function switchPage(pageId) {
    syncPollingWithPage(pageId);

    const pages = document.querySelectorAll('.page');
    for (let p = 0; p < pages.length; p++) pages[p].classList.remove('active');

    const tp = document.getElementById(pageId + 'Page');
    if (tp) tp.classList.add('active');

    const navLinks = document.querySelectorAll('.menu-nav-link');
    for (let l = 0; l < navLinks.length; l++) {
        if (navLinks[l].dataset.page === pageId) navLinks[l].classList.add('active');
        else navLinks[l].classList.remove('active');
    }

    updateDiscordActiveItem(pageId);
    updatePageTitle(pageId);

    const actions = {
        'schedule': renderSchedule,
        'events': renderEvents,
        'shop': renderShop,
        'history': renderHistory,
        'leaderboard': renderLeaderboard,
        'promo': renderUsedPromoCodes,
        'titles': renderTitlesShop,
        'common-chat': renderCommonChat,
        'students': renderAdminStudents,
        'groups': renderAdminGroups,
        'shop-editor': renderAdminShop,
        'promo-editor': renderAdminPromos,
        'titles-editor': renderAdminTitles,
        'events-editor': renderAdminEvents,
        'rating-admin': renderAdminLeaderboard,
        'common-chat-admin': renderAdminCommonChat,
        'attendance': renderAttendance,
        'founder-panel': function() {
            renderAdminAccounts();
            renderSeasonManagement();
            updateFounderStats();
        },
        'admin-logs': loadAdminLogs,
        'passwords': function() { loadPasswords('all'); },
        'chat': loadStudentChats,
        'chat-admin': function() { loadAdminTickets(); initAdminFilters(); },
        'messenger': async function() {
            if (canUseMessenger()) {
                stopPollingByName('messenger');
                state.messengerCurrentChat = null;
                state.messengerLastMessageId = 0;

                const messengerChatArea = document.getElementById('messengerChatArea');
                const messengerEmptyState = document.getElementById('messengerEmptyState');
                if (messengerChatArea) messengerChatArea.style.display = 'none';
                if (messengerEmptyState) messengerEmptyState.style.display = 'flex';

                const messengerMessagesArea = document.getElementById('messengerMessagesArea');
                if (messengerMessagesArea) messengerMessagesArea.innerHTML = '';

                if (state.messengerCurrentTab === 'chats') await loadStudentChatsMessenger();
                else await searchPeopleWithAdmins('');
            }
        }
    };

    if (actions[pageId]) actions[pageId]();

    if (pageId === 'schedule-editor') {
        renderScheduleEditor();
        const scheduleEditorCard = document.getElementById('scheduleEditorCard');
        if (scheduleEditorCard) scheduleEditorCard.style.display = 'none';
    }

    setTimeout(function() {
        if (typeof window.initPasswordToggles === 'function') window.initPasswordToggles();
    }, 100);
}

// ============================================================
// ЗАГОЛОВОК СТРАНИЦЫ
// ============================================================
export function updatePageTitle(pageId) {
    const titles = {
        'schedule': { icon: 'fa-calendar-week', title: 'Расписание', sub: 'Главная' },
        'events': { icon: 'fa-calendar-alt', title: 'События', sub: 'Календарь' },
        'shop': { icon: 'fa-store', title: 'Магазин', sub: 'Покупки' },
        'promo': { icon: 'fa-ticket-alt', title: 'Промокоды', sub: 'Активация' },
        'history': { icon: 'fa-history', title: 'История', sub: 'Действия' },
        'leaderboard': { icon: 'fa-trophy', title: 'Рейтинг', sub: 'Топ студентов' },
        'titles': { icon: 'fa-medal', title: 'Титулы', sub: 'Коллекция' },
        'messenger': { icon: 'fa-comments', title: 'Мессенджер', sub: 'Чаты' },
        'chat': { icon: 'fa-headset', title: 'Поддержка', sub: 'Обращения' },
        'common-chat': { icon: 'fa-globe', title: 'Общий чат', sub: 'Все студенты' },
        'students': { icon: 'fa-users', title: 'Студенты', sub: 'Управление' },
        'groups': { icon: 'fa-layer-group', title: 'Группы', sub: 'Управление' },
        'attendance': { icon: 'fa-calendar-check', title: 'Посещаемость', sub: 'Отметки' },
        'schedule-editor': { icon: 'fa-edit', title: 'Редактор расписания', sub: 'Управление' },
        'events-editor': { icon: 'fa-calendar-plus', title: 'Редактор событий', sub: 'Управление' },
        'shop-editor': { icon: 'fa-box', title: 'Редактор магазина', sub: 'Управление' },
        'promo-editor': { icon: 'fa-ticket-alt', title: 'Редактор промокодов', sub: 'Управление' },
        'titles-editor': { icon: 'fa-medal', title: 'Редактор титулов', sub: 'Управление' },
        'rating-admin': { icon: 'fa-trophy', title: 'Рейтинг', sub: 'Админ-панель' },
        'chat-admin': { icon: 'fa-headset', title: 'Поддержка', sub: 'Админ-панель' },
        'common-chat-admin': { icon: 'fa-globe', title: 'Общий чат', sub: 'Админ-панель' },
        'founder-panel': { icon: 'fa-crown', title: 'Управление правами', sub: 'Основатель' },
        'admin-logs': { icon: 'fa-history', title: 'Логи администраторов', sub: 'Основатель' },
        'passwords': { icon: 'fa-key', title: 'Управление паролями', sub: 'Основатель' }
    };

    const info = titles[pageId] || { icon: 'fa-cube', title: 'Страница', sub: '' };
    const iconEl = document.getElementById('pageTitleIcon');
    const titleMain = document.getElementById('titleMain');
    const titleSub = document.getElementById('titleSub');

    if (iconEl) iconEl.innerHTML = '<i class="fas ' + info.icon + '"></i>';
    if (titleMain) titleMain.textContent = info.title;
    if (titleSub) titleSub.textContent = info.sub;
}

// ============================================================
// БОКОВОЕ МЕНЮ
// ============================================================
function initDiscordMenu() {
    const menuItems = document.querySelectorAll('.discord-menu-item');

    for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];

        if (item.dataset.page) {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const page = this.dataset.page;
                if (page) {
                    switchPage(page);
                    updateDiscordActiveItem(page);
                }
            });
        }
    }

    const sidebarChangePwd = document.getElementById('sidebarChangePwd');
    if (sidebarChangePwd) {
        sidebarChangePwd.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof window.openSelfChangePasswordModal === 'function') window.openSelfChangePasswordModal();
        });
    }

    const sidebarAdminChangePwd = document.getElementById('sidebarAdminChangePwd');
    if (sidebarAdminChangePwd) {
        sidebarAdminChangePwd.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof window.openSelfChangePasswordModal === 'function') window.openSelfChangePasswordModal();
        });
    }

    const sidebarLockdown = document.getElementById('sidebarLockdown');
    if (sidebarLockdown) {
        sidebarLockdown.addEventListener('click', function(e) {
            e.preventDefault();
            toggleLockdown();
        });
    }
}

function updateDiscordActiveItem(pageId) {
    const items = document.querySelectorAll('.discord-menu-item');
    for (let i = 0; i < items.length; i++) {
        if (items[i].dataset.page === pageId) items[i].classList.add('active');
        else items[i].classList.remove('active');
    }
}

// ============================================================
// БЛОКИРОВКА САЙТА
// ============================================================
async function toggleLockdown() {
    if (!state.currentUser || state.currentUser.role !== 'founder') {
        showToast('Доступ запрещен. Только основатель может управлять блокировкой.', 'error');
        return;
    }

    try {
        const response = await fetch(state.API_URL + '?endpoint=getLockdownStatus&t=' + Date.now());
        const statusData = await response.json();
        const isEnabled = statusData.success && statusData.data.enabled;
        const currentMessage = statusData.data && statusData.data.message ? statusData.data.message : 'Доступ ограничен';

        const msg = prompt('Сообщение для пользователей (при включении блокировки):', currentMessage);
        if (msg === null) return;

        const result = await apiCall('setLockdown', 'POST', {
            enabled: !isEnabled,
            message: msg,
            founder_id: state.currentUser.id,
            founder_login: state.currentUser.login
        });

        if (result) {
            const newState = !isEnabled;
            showToast(newState ? '🔒 Блокировка включена' : '🔓 Блокировка выключена', 'success');

            if (newState) {
                setTimeout(function() { window.location.reload(); }, 1500);
            }
        } else {
            showToast('❌ Ошибка при переключении блокировки', 'error');
        }
    } catch (e) {
        console.error('Toggle lockdown error:', e);
        showToast('❌ Ошибка при переключении блокировки', 'error');
    }
}

// ============================================================
// ПРОФИЛЬ В ШАПКЕ
// ============================================================
export function updateMenuProfile() {
    const topProfileName = document.getElementById('topProfileName');
    const topProfileGroup = document.getElementById('topProfileGroup');
    const topBalanceValue = document.getElementById('topBalanceValue');
    const topProfileBalance = document.getElementById('topProfileBalance');
    const avatarLetter = document.getElementById('avatarLetter');

    if (!topProfileName || !topProfileGroup) return;

    const isFounderMode = state.currentUser && state.currentUser.role === 'founder' && !state.founderToggleMode;
    const isAdminMode = state.currentUser && state.currentUser.role === 'admin' && !state.founderToggleMode;

    // Студент
    if (state.currentStudent && ((!isFounderMode && !isAdminMode) || state.founderToggleMode)) {
        const displayName = state.currentStudent.name || 'Студент';
        const groupName = state.currentStudent.group_name || 'Группа не назначена';

        const isImpersonate = state.founderToggleMode && state.currentUser && state.currentUser.role === 'founder';

        if (isImpersonate) {
            topProfileName.innerHTML = displayName + ' <span class="role-badge" style="background:rgba(251,191,36,0.15);color:#fbbf24;border-color:rgba(251,191,36,0.2);cursor:pointer;">🎓 Студент (вернуться)</span>';
        } else {
            topProfileName.innerHTML = displayName + ' <span class="role-badge">Студент</span>';
        }

        topProfileGroup.textContent = groupName;

        if (topBalanceValue) {
            if (state.currentStudent.infinite_balance) {
                topBalanceValue.innerHTML = '&#8734;';
                topBalanceValue.style.fontSize = '20px';
                topBalanceValue.style.fontWeight = '700';
                topBalanceValue.style.color = '#c44dff';
                topBalanceValue.style.textShadow = '0 0 3px #9b4dff';
            } else {
                topBalanceValue.textContent = state.currentStudent.balance || 0;
                topBalanceValue.style.fontSize = '';
                topBalanceValue.style.fontWeight = '';
                topBalanceValue.style.color = '';
                topBalanceValue.style.textShadow = '';
            }
        }
        if (topProfileBalance) topProfileBalance.style.display = 'flex';
        if (avatarLetter) avatarLetter.textContent = displayName.charAt(0).toUpperCase();

        updateTopProfileTitle();
        return;
    }

    // Основатель
    if (isFounderMode && state.currentUser) {
        const founderName = state.currentUser.login || 'Основатель';
        topProfileName.innerHTML = founderName + ' <span class="role-badge founder" style="cursor:pointer;" title="Кликните, чтобы войти в режим студента">👑 Основатель</span>';
        topProfileGroup.innerHTML = '<i class="fas fa-crown"></i> Основатель <span style="background:rgba(251,191,36,0.2); padding:2px 8px; border-radius:12px; font-size:10px; margin-left:6px;">👑 Панель управления</span>';
        if (topBalanceValue) {
            topBalanceValue.innerHTML = '&#8734;';
            topBalanceValue.style.fontSize = '20px';
            topBalanceValue.style.fontWeight = '700';
            topBalanceValue.style.color = '#fbbf24';
            topBalanceValue.style.textShadow = '0 0 3px #f59e0b';
        }
        if (topProfileBalance) topProfileBalance.style.display = 'flex';
        if (avatarLetter) avatarLetter.textContent = founderName.charAt(0).toUpperCase();
        return;
    }

    // Админ
    if (isAdminMode && state.currentUser) {
        const adminName = state.currentUser.login || 'Администратор';
        topProfileName.innerHTML = adminName + ' <span class="role-badge admin">Администратор</span>';
        topProfileGroup.innerHTML = '<i class="fas fa-user-shield"></i> Администратор';
        if (topBalanceValue) {
            topBalanceValue.textContent = '0';
            topBalanceValue.style.fontSize = '';
            topBalanceValue.style.fontWeight = '';
            topBalanceValue.style.color = '';
            topBalanceValue.style.textShadow = '';
        }
        if (topProfileBalance) topProfileBalance.style.display = 'none';
        if (avatarLetter) avatarLetter.textContent = adminName.charAt(0).toUpperCase();
        return;
    }

    // Гость
    topProfileName.innerHTML = 'Гость <span class="role-badge">Гость</span>';
    topProfileGroup.textContent = 'Не авторизован';
    if (topBalanceValue) topBalanceValue.textContent = '0';
    if (topProfileBalance) topProfileBalance.style.display = 'flex';
    if (avatarLetter) avatarLetter.textContent = '?';
}

export async function updateTopProfileTitle() {
    const topProfileTitle = document.getElementById('topProfileTitle');
    if (!topProfileTitle) return;

    let sid = null;
    if (state.founderToggleMode && state.currentStudent) sid = state.currentStudent.id;
    else if (state.currentStudent) sid = state.currentStudent.id;
    else if (state.currentUser && state.currentUser.role === 'founder' && state.currentUser.student_id) sid = state.currentUser.student_id;

    if (!sid) { topProfileTitle.innerHTML = ''; return; }

    const title = await apiCall('getActiveTitle', 'GET', { student_id: sid });
    if (title && typeof window.createTitleBadge === 'function') {
        topProfileTitle.innerHTML = window.createTitleBadge(title, false);
    } else {
        topProfileTitle.innerHTML = '';
    }
}

export async function updateStudentStats() {
    if (!state.currentStudent) return;
    const s = await apiCall('getStudentStats', 'GET', { student_id: state.currentStudent.id });

    if (s) {
        const attendanceStat = document.getElementById('attendanceStat');
        const totalExpStat = document.getElementById('totalExpStat');
        const topBalanceValue = document.getElementById('topBalanceValue');

        if (attendanceStat) attendanceStat.textContent = s.attended || 0;
        if (totalExpStat) totalExpStat.innerHTML = (s.total_earned || 0) + ' ⭐';

        if (topBalanceValue) {
            if (s.infinite_balance) {
                topBalanceValue.innerHTML = '&#8734;';
                topBalanceValue.style.fontSize = '20px';
                topBalanceValue.style.fontWeight = '700';
                topBalanceValue.style.color = '#c44dff';
                topBalanceValue.style.textShadow = '0 0 3px #9b4dff';
            } else {
                topBalanceValue.textContent = s.balance || 0;
                topBalanceValue.style.fontSize = '';
                topBalanceValue.style.fontWeight = '';
                topBalanceValue.style.color = '';
                topBalanceValue.style.textShadow = '';
            }
        }

        state.currentStudent.balance = s.balance;
        state.currentStudent.total_earned = s.total_earned;
        state.currentStudent.infinite_balance = s.infinite_balance;
    }
}

// ============================================================
// ЗАГРУЗКА СЕЛЕКТОВ
// ============================================================
export async function populateSelects() {
    const selectIds = ['newStudentGroup', 'attendanceGroupSelect', 'studentsGroupFilter'];

    for (let s = 0; s < selectIds.length; s++) {
        const sel = document.getElementById(selectIds[s]);
        if (sel) {
            sel.innerHTML = selectIds[s] === 'newStudentGroup'
                ? '<option value="">Выберите группу</option>'
                : '<option value="all">Все группы</option>';
            for (let g = 0; g < state.groups.length; g++) {
                const opt = document.createElement('option');
                opt.value = state.groups[g].id;
                opt.textContent = state.groups[g].name;
                sel.appendChild(opt);
            }
        }
    }

    const ws = document.getElementById('weekSelector');
    if (ws) {
        ws.innerHTML = '';
        for (let i = 0; i < state.dayNamesFull.length; i++) {
            const b = document.createElement('button');
            b.className = 'day-btn ' + (state.currentDay === i ? 'active' : '');
            b.textContent = state.dayNamesFull[i];
            b.onclick = (function(dayIndex) {
                return function() {
                    state.currentDay = dayIndex;
                    const btns = document.querySelectorAll('.day-btn');
                    for (let d = 0; d < btns.length; d++) btns[d].classList.remove('active');
                    this.classList.add('active');
                    renderSchedule();
                };
            })(i);
            ws.appendChild(b);
        }
    }
}

// ============================================================
// ВОССТАНОВЛЕНИЕ СЕССИИ
// ============================================================
async function restoreSession() {
    const savedUser = localStorage.getItem('nexhub_user');
    if (!savedUser) return false;

    try {
        const user = JSON.parse(savedUser);
        state.currentUser = user;

        const savedStudent = localStorage.getItem('nexhub_student');
        if (savedStudent) state.currentStudent = JSON.parse(savedStudent);
        else state.currentStudent = null;

        state.currentSessionToken = user.session_token || '';

        if (savedStudent && user.role === 'founder') {
            state.founderToggleMode = true;
        } else {
            state.founderToggleMode = false;
        }

        try {
            const lockdownCheck = await fetch(state.API_URL + '?endpoint=getLockdownStatus&t=' + Date.now());
            const lockdownData = await lockdownCheck.json();
            if (lockdownData.success && lockdownData.data.enabled && user.role !== 'founder') {
                performLogout();
                showLockdownScreen(lockdownData.data.message);
                return false;
            }
        } catch (e) { /* ignore */ }

        if (state.sessionCheckInterval) clearInterval(state.sessionCheckInterval);
        state.sessionCheckInterval = setInterval(async function() {
            if (!await checkSessionAndLockdown()) clearInterval(state.sessionCheckInterval);
        }, 3000);

        const ia = (user.role === 'admin' || user.role === 'founder') && !state.founderToggleMode;
        document.body.classList.toggle('admin-mode', ia);
        document.body.classList.toggle('founder-mode', user.role === 'founder' && !state.founderToggleMode);

        document.querySelectorAll('.admin-nav').forEach(el => el.classList.toggle('hidden', !ia));
        document.querySelectorAll('.student-nav').forEach(el => el.classList.toggle('hidden', ia));
        document.querySelectorAll('.founder-only').forEach(el => el.classList.toggle('hidden', user.role !== 'founder'));

        const authOverlay = document.getElementById('authOverlay');
        const mainApp = document.getElementById('mainApp');
        if (authOverlay) authOverlay.classList.add('hidden');
        if (mainApp) mainApp.classList.add('visible');

        await initAfterLogin();

        if (state.founderToggleMode) {
            switchPage('schedule');
            await updateStudentStats();
        } else if (user.role === 'admin' || user.role === 'founder') {
            switchPage('students');
        } else if (state.currentStudent) {
            switchPage('schedule');
            await updateStudentStats();
        }

        updateMenuProfile();
        return true;
    } catch (e) {
        console.error('Session restore error:', e);
        localStorage.removeItem('nexhub_user');
        localStorage.removeItem('nexhub_student');
        return false;
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ ПОСЛЕ ВХОДА
// ============================================================
async function initAfterLogin() {
    await loadGroups();
    await loadTitlesForPromoSelect();

    await populateSelects();

    // ===== БАЗОВЫЕ ОБРАБОТЧИКИ =====
    initCharCounters();
    initUnreadCheck();
    initSupportButtons();
    initChatEnterHandlers();
    initCommonChatButtons();
    initMessenger();

    // ===== АДМИН-МОДУЛИ =====
    initStudentFilters();
    initStudentsModule();
    initGroupsModule();
    initAttendance();
    initScheduleEditor();
    initEventsEditor();
    initShopEditor();
    initPromosEditor();
    initTitlesEditor();
    initFounderPanel();
    initAdminLogs();

    // ===== ⚡ ПРОМОКОДЫ (СТУДЕНТ) — КНОПКА АКТИВАЦИИ =====
    initPromocodes();

    // ===== МЕНЮ =====
    initDiscordMenu();

    // ===== ФАЙЛЫ В ЧАТАХ =====
    addImageUploadButton();
    addFileUploadButton();
    initImagePaste();
    initFilePaste();

    // ===== ПАРОЛИ И СЕЗОНЫ =====
    initPasswords();
    initSeasonToggle();
    await initSeason();

    // ===== УВЕДОМЛЕНИЯ =====
    startNotificationsPolling();

    // ===== ОСНОВАТЕЛЬ =====
    if (state.currentUser && state.currentUser.role === 'founder') {
        await initFounderStudent();
        setTimeout(function() {
            renderSeasonManagement();
            updateFounderStats();
        }, 500);
    }

    setTimeout(function() {
        if (typeof window.initPasswordToggles === 'function') window.initPasswordToggles();
    }, 100);
}

// ============================================================
// ПОКАЗ ГЛАВНОГО ПРИЛОЖЕНИЯ
// ============================================================
function showMainApp() {
    const authOverlay = document.getElementById('authOverlay');
    const mainApp = document.getElementById('mainApp');
    if (authOverlay) authOverlay.classList.add('hidden');
    if (mainApp) mainApp.classList.add('visible');
}

// ============================================================
// ОБРАБОТЧИК СОБЫТИЯ ВХОДА
// ============================================================
document.addEventListener('user:logged-in', async function() {
    const ia = state.currentUser.role === 'admin' || state.currentUser.role === 'founder';
    document.body.classList.toggle('admin-mode', ia);
    document.body.classList.toggle('founder-mode', state.currentUser.role === 'founder');

    document.querySelectorAll('.admin-nav').forEach(el => el.classList.toggle('hidden', !ia));
    document.querySelectorAll('.student-nav').forEach(el => el.classList.toggle('hidden', ia));
    document.querySelectorAll('.founder-only').forEach(el => el.classList.toggle('hidden', state.currentUser.role !== 'founder'));

    showMainApp();
    await initAfterLogin();

    if (ia) switchPage('students');
    else if (state.currentStudent) {
        switchPage('schedule');
        await updateStudentStats();
    }

    updateMenuProfile();
    initHeaderLogout();
});

// ============================================================
// КЛИК ПО ПРОФИЛЮ — ВОЗВРАТ ИЗ РЕЖИМА СТУДЕНТА
// ============================================================
function initProfileClickHandler() {
    const topProfileAvatar = document.getElementById('topProfileAvatar');
    const topProfileNameEl = document.getElementById('topProfileName');
    const topProfileBalanceEl = document.getElementById('topProfileBalance');

    const handler = function(e) {
        if (!state.currentUser || state.currentUser.role !== 'founder') return;
        if (!state.founderToggleMode) return;

        e.preventDefault();
        e.stopPropagation();

        if (confirm('Вернуться в режим основателя?')) {
            toggleFounderMode();
        }
    };

    if (topProfileAvatar) {
        topProfileAvatar.style.cursor = 'pointer';
        topProfileAvatar.addEventListener('click', handler);
    }

    if (topProfileNameEl) {
        topProfileNameEl.style.cursor = 'pointer';
        topProfileNameEl.addEventListener('click', handler);
    }

    if (topProfileBalanceEl) {
        topProfileBalanceEl.style.cursor = 'pointer';
        topProfileBalanceEl.addEventListener('click', handler);
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================
async function init() {
    initCustomCursor();
    initThemeToggle();
    initAuthForm();
    initDiscordMenu();
    initNotifications();
    initProfileClickHandler();

    const restored = await restoreSession();

    if (!restored) {
        const authOverlay = document.getElementById('authOverlay');
        const mainApp = document.getElementById('mainApp');
        if (authOverlay) authOverlay.classList.remove('hidden');
        if (mainApp) mainApp.classList.remove('visible');

        // Если не восстановили сессию — всё равно вешаем обработчики на модалки редакторов,
        // чтобы после логина они работали. Но initAfterLogin() вызывается после входа,
        // поэтому здесь дублировать не нужно.
    }

    // Закрытие модалок
    const closeModalButtons = document.querySelectorAll('.modal-close, .btn-cancel');
    for (let cm = 0; cm < closeModalButtons.length; cm++) {
        closeModalButtons[cm].addEventListener('click', function() {
            const m = this.closest('.modal');
            if (m) m.classList.remove('active');
        });
    }

    // Кнопки открытия модалок для редакторов
    const showAddEventModal = document.getElementById('showAddEventModal');
    if (showAddEventModal) showAddEventModal.addEventListener('click', function() { showModal('addEventModal'); });

    const showAddItemModal = document.getElementById('showAddItemModal');
    if (showAddItemModal) showAddItemModal.addEventListener('click', function() { showModal('addItemModal'); });

    const showAddPromoModal = document.getElementById('showAddPromoModal');
    if (showAddPromoModal) showAddPromoModal.addEventListener('click', function() { showModal('addPromoModal'); });

    const showAddTitleModal = document.getElementById('showAddTitleModal');
    if (showAddTitleModal) showAddTitleModal.addEventListener('click', function() { showModal('addTitleModal'); });

    // Периодическое обновление статистики
    setInterval(async function() {
        if (state.currentStudent && document.visibilityState === 'visible') {
            await updateStudentStats();
        }
    }, 120000);

    initHeaderLogout();

    console.log('✅ SHub application initialized');
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.switchPage = switchPage;
window.updatePageTitle = updatePageTitle;
window.updateMenuProfile = updateMenuProfile;
window.updateTopProfileTitle = updateTopProfileTitle;
window.updateStudentStats = updateStudentStats;
window.populateSelects = populateSelects;
window.initDiscordMenu = initDiscordMenu;
window.updateDiscordActiveItem = updateDiscordActiveItem;
window.toggleLockdown = toggleLockdown;
window.syncPollingWithPage = syncPollingWithPage;

// ============================================================
// ЗАПУСК
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}