// assets/js/core/state.js — глобальное состояние приложения

export const state = {
    API_URL: 'api.php',

    // Пользователь
    currentUser: null,
    currentStudent: null,
    currentSessionToken: null,
    selectedRole: 'student',

    // Группы и расписание
    groups: [],
    currentDay: 0,
    selectedScheduleGroup: '',
    selectedScheduleDay: 0,
    dayNames: ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'],
    dayNamesFull: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],

    // Студенты (админ)
    studentsSearchTerm: '',
    studentsGroupFilter: 'all',

    // Смена пароля
    currentChangeUserId: null,
    currentChangeUserRole: null,

    // Интервалы
    unreadCheckInterval: null,
    sessionCheckInterval: null,
    globalSeasonCheckInterval: null,

    // Основатель
    founderStudentData: null,
    founderToggleMode: false,

    // Поддержка (тикеты)
    currentTicketId: null,
    studentTickets: [],
    adminCurrentTicketId: null,
    adminTickets: [],
    adminFilter: 'all',

    // Кэш титулов
    userTitleCache: {},
    userTitleColorCache: {},

    // Общий чат
    lastMessageId: 0,
    pollingInterval: null,
    isPolling: false,

    // Титулы polling
    lastTitleUpdateId: 0,
    titlePollingInterval: null,
    isTitlePolling: false,

    // Мессенджер
    messengerCurrentChat: null,
    messengerLastMessageId: 0,
    messengerPollingInterval: null,
    messengerSearchTimeout: null,
    messengerCurrentTab: 'chats',
    messengerLastUpdateId: 0,
    messengerUpdatesPollingInterval: null,

    // Тикеты polling
    ticketLastUpdateId: 0,
    ticketUpdatesPollingInterval: null,

    // Пересылка сообщений
    forwardTargetMessage: null,
    forwardTargetChatId: null,

    // Уведомления
    notifications: [],
    notificationsModalOpen: false,
    notificationsPollingInterval: null,
    lastNotificationId: 0,
    processingNotification: false,

    // Флаги
    isSelectingChat: false,

    // Блокировка
    lockdownActive: false,
    lockdownMessage: ''
};

// Экспорт в window для доступа из inline-скриптов и обработчиков onclick
window.state = state;