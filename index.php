<?php
// api/index.php — единая точка входа для всех API-запросов

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/helpers.php';

// Подключаем все модули
require_once __DIR__ . '/uploads.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/students.php';
require_once __DIR__ . '/groups.php';
require_once __DIR__ . '/titles.php';
require_once __DIR__ . '/shop.php';
require_once __DIR__ . '/promocodes.php';
require_once __DIR__ . '/events.php';
require_once __DIR__ . '/schedule.php';
require_once __DIR__ . '/attendance.php';
require_once __DIR__ . '/history.php';
require_once __DIR__ . '/support.php';
require_once __DIR__ . '/common_chat.php';
require_once __DIR__ . '/messenger.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/admin.php';
require_once __DIR__ . '/founder.php';
require_once __DIR__ . '/seasons.php';

$endpoint = trim($_GET['endpoint'] ?? '');
$input = getInput();

// === Загрузка файлов (multipart) ===
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['item_image']))        { handleImageUpload($pdo); exit(); }
    if (isset($_FILES['title_image']))       { handleTitleImageUpload($pdo); exit(); }
    if (isset($_FILES['chat_image']))        { handleChatImageUpload($pdo); exit(); }
    if (isset($_FILES['common_chat_image'])) { handleCommonChatImageUpload($pdo); exit(); }
    if (isset($_FILES['chat_file']))         { handleChatFileUpload($pdo); exit(); }
    if (isset($_FILES['common_chat_file']))  { handleCommonChatFileUpload($pdo); exit(); }
}

// === Карта эндпоинтов ===
$routes = [
    // --- Система ---
    'test'                      => fn() => respond(['success'=>true,'message'=>'SHub API работает!','time'=>date('Y-m-d H:i:s')]),
    'getVersions'               => fn() => handleGetVersions(),

    // --- Авторизация ---
    'login'                     => fn() => handleLogin($pdo, $input),
    'checkSession'              => fn() => handleCheckSession($pdo),
    'logout'                    => fn() => handleLogout($pdo, $input),
    'getLockdownStatus'         => fn() => handleGetLockdownStatus($pdo),
    'setLockdown'               => fn() => handleSetLockdown($pdo, $input),

    // --- Студенты ---
    'getStudents'               => fn() => handleGetStudents($pdo),
    'getStudent'                => fn() => handleGetStudent($pdo),
    'addStudent'                => fn() => handleAddStudent($pdo, $input),
    'deleteStudent'             => fn() => handleDeleteStudent($pdo, $input),
    'updateBalance'             => fn() => handleUpdateBalance($pdo, $input),
    'updateExperience'          => fn() => handleUpdateExperience($pdo, $input),
    'changeStudentGroup'        => fn() => handleChangeStudentGroup($pdo, $input),
    'renameStudent'             => fn() => handleRenameStudent($pdo, $input),
    'getStudentStats'           => fn() => handleGetStudentStats($pdo),
    'getLeaderboard'            => fn() => handleGetLeaderboard($pdo),
    'toggleInfiniteBalance'     => fn() => handleToggleInfiniteBalance($pdo, $input),
    'getStudentInfiniteStatus'  => fn() => handleGetStudentInfiniteStatus($pdo),

    // --- Группы ---
    'getGroups'                 => fn() => handleGetGroups($pdo),
    'addGroup'                  => fn() => handleAddGroup($pdo, $input),
    'deleteGroup'               => fn() => handleDeleteGroup($pdo, $input),

    // --- Титулы ---
    'getTitles'                 => fn() => handleGetTitles($pdo),
    'getStudentTitles'          => fn() => handleGetStudentTitles($pdo),
    'getActiveTitle'            => fn() => handleGetActiveTitle($pdo),
    'getUserTitleForChat'       => fn() => handleGetUserTitleForChat($pdo),
    'buyTitle'                  => fn() => handleBuyTitle($pdo, $input),
    'activateTitle'             => fn() => handleActivateTitle($pdo, $input),
    'deactivateTitle'           => fn() => handleDeactivateTitle($pdo, $input),
    'createTitle'               => fn() => handleCreateTitle($pdo, $input),
    'updateTitle'               => fn() => handleUpdateTitle($pdo, $input),
    'deleteTitle'               => fn() => handleDeleteTitle($pdo, $input),
    'toggleTitlePurchasable'    => fn() => handleToggleTitlePurchasable($pdo, $input),
    'giveTitle'                 => fn() => handleGiveTitle($pdo, $input),
    'removeTitle'               => fn() => handleRemoveTitle($pdo, $input),
    'notifyTitleChange'         => fn() => handleNotifyTitleChange($pdo, $input),
    'getTitleUpdates'           => fn() => handleGetTitleUpdates($pdo),
    'uploadTitleImage'          => fn() => handleTitleImageUpload($pdo),
    'deleteTitleImage'          => fn() => respond(['success'=>true,'data'=>['deleted'=>true, 'message'=>'Функция отключена']]),

    // --- Магазин ---
    'getShopItems'              => fn() => handleGetShopItems($pdo),
    'addShopItem'               => fn() => handleAddShopItem($pdo, $input),
    'updateShopItem'            => fn() => handleUpdateShopItem($pdo, $input),
    'deleteShopItem'            => fn() => handleDeleteShopItem($pdo, $input),
    'buyItem'                   => fn() => handleBuyItem($pdo, $input),
    'deleteShopItemImage'       => fn() => handleDeleteShopItemImage($pdo, $input),

    // --- Промокоды ---
    'getPromocodes'             => fn() => handleGetPromocodes($pdo),
    'addPromo'                  => fn() => handleAddPromo($pdo, $input),
    'activatePromo'             => fn() => handleActivatePromo($pdo, $input),
    'togglePromo'               => fn() => handleTogglePromo($pdo, $input),
    'deletePromo'               => fn() => handleDeletePromo($pdo, $input),
    'getStudentPromoCodes'      => fn() => handleGetStudentPromoCodes($pdo),

    // --- События ---
    'getEvents'                 => fn() => handleGetEvents($pdo),
    'addEvent'                  => fn() => handleAddEvent($pdo, $input),
    'updateEvent'               => fn() => handleUpdateEvent($pdo, $input),
    'deleteEvent'               => fn() => handleDeleteEvent($pdo, $input),

    // --- Расписание ---
    'getSchedule'               => fn() => handleGetSchedule($pdo),
    'addSchedulePair'           => fn() => handleAddSchedulePair($pdo, $input),
    'updateSchedulePair'        => fn() => handleUpdateSchedulePair($pdo, $input),
    'deleteSchedulePair'        => fn() => handleDeleteSchedulePair($pdo, $input),

    // --- Посещаемость ---
    'getStudentAttendance'      => fn() => handleGetStudentAttendance($pdo),
    'toggleAttendance'          => fn() => handleToggleAttendance($pdo, $input),

    // --- История ---
    'getStudentHistory'         => fn() => handleGetStudentHistory($pdo),
    'clearHistory'              => fn() => handleClearHistory($pdo, $input),

    // --- Поддержка ---
    'getSupportTickets'         => fn() => handleGetSupportTickets($pdo),
    'getAllSupportTickets'      => fn() => handleGetAllSupportTickets($pdo),
    'sendSupportMessage'        => fn() => handleSendSupportMessage($pdo, $input),
    'addSupportReply'           => fn() => handleAddSupportReply($pdo, $input),
    'getTicketReplies'          => fn() => handleGetTicketReplies($pdo),
    'deleteSupportTicket'       => fn() => handleDeleteSupportTicket($pdo, $input),
    'answerSupport'             => fn() => handleAnswerSupport($pdo, $input),
    'getTicketUpdates'          => fn() => handleGetTicketUpdates($pdo),

    // --- Общий чат ---
    'getCommonMessages'         => fn() => handleGetCommonMessages($pdo),
    'sendCommonMessage'         => fn() => handleSendCommonMessage($pdo, $input),
    'deleteCommonMessage'       => fn() => handleDeleteCommonMessage($pdo, $input),
    'clearCommonChat'           => fn() => handleClearCommonChat($pdo, $input),
    'getNewMessages'            => fn() => handleGetNewMessages($pdo),
    'markMessagesRead'          => fn() => respond(['success'=>true]),
    'getUnreadCount'            => fn() => respond(['success'=>true,'data'=>['unread'=>0]]),

    // --- Мессенджер ---
    'getAllUsersForChat'        => fn() => handleGetAllUsersForChat($pdo),
    'searchStudentsToAdd'       => fn() => handleSearchStudentsToAdd($pdo),
    'getOrCreatePrivateChat'    => fn() => handleGetOrCreatePrivateChat($pdo, $input),
    'getOrCreateChat'           => fn() => handleGetOrCreateChat($pdo, $input),
    'getAdminChats'             => fn() => handleGetAdminChats($pdo),
    'getStudentChats'           => fn() => handleGetStudentChats($pdo),
    'getAllAdmins'              => fn() => handleGetAllAdmins($pdo),
    'addAdminToGroup'           => fn() => handleAddAdminToGroup($pdo, $input),
    'getAllStudentsForChat'     => fn() => handleGetAllStudentsForChat($pdo),
    'getChatParticipants'       => fn() => handleGetChatParticipants($pdo),
    'createGroupChat'           => fn() => handleCreateGroupChat($pdo, $input),
    'getChatMessages'           => fn() => handleGetChatMessages($pdo),
    'sendChatMessage'           => fn() => handleSendChatMessage($pdo, $input),
    'getNewChatMessages'        => fn() => handleGetNewChatMessages($pdo),
    'getChatMessageInfo'        => fn() => handleGetChatMessageInfo($pdo),
    'forwardChatMessage'        => fn() => respond(handleForwardMessage($pdo, $input)),
    'editChatMessage'           => fn() => handleEditChatMessage($pdo, $input),
    'deleteChatMessage'         => fn() => handleDeleteChatMessage($pdo, $input),
    'deleteConversation'        => fn() => handleDeleteConversation($pdo, $input),
    'renameGroup'               => fn() => handleRenameGroup($pdo, $input),
    'removeGroupParticipant'    => fn() => handleRemoveGroupParticipant($pdo, $input),
    'addGroupParticipants'      => fn() => handleAddGroupParticipants($pdo, $input),
    'leaveGroup'                => fn() => handleLeaveGroup($pdo, $input),
    'getGroupInfo'              => fn() => handleGetGroupInfo($pdo),
    'getFounderChatProfile'     => fn() => handleGetFounderChatProfile($pdo),
    'getMessengerUpdates'       => fn() => handleGetMessengerUpdates($pdo),

    // --- Уведомления ---
    'getNotifications'          => fn() => handleGetNotifications($pdo),
    'markNotificationRead'      => fn() => handleMarkNotificationRead($pdo, $input),
    'markAllNotificationsRead'  => fn() => handleMarkAllNotificationsRead($pdo, $input),
    'deleteNotification'        => fn() => handleDeleteNotification($pdo, $input),
    'clearReadNotifications'    => fn() => handleClearReadNotifications($pdo, $input),
    'getUnreadNotificationsCount'=> fn() => handleGetUnreadNotificationsCount($pdo),

    // --- Админ ---
    'getAdminAccounts'          => fn() => handleGetAdminAccounts($pdo),
    'addAdmin'                  => fn() => handleAddAdmin($pdo, $input),
    'deleteAdmin'               => fn() => handleDeleteAdmin($pdo, $input),
    'getAllUsersWithRoles'      => fn() => handleGetAllUsersWithRoles($pdo),
    'toggleAdminRole'           => fn() => handleToggleAdminRole($pdo, $input),
    'deleteAdminByFounder'      => fn() => handleDeleteAdminByFounder($pdo, $input),
    'getAdminLogs'              => fn() => handleGetAdminLogs($pdo),
    'clearAdminLogs'            => fn() => handleClearAdminLogs($pdo, $input),
    'getPasswords'              => fn() => handleGetPasswords($pdo),
    'changePassword'            => fn() => handleChangePassword($pdo, $input),
    'canChangePassword'         => fn() => respond(['success'=>true,'data'=>['can_change'=>true]]),

    // --- Основатель ---
    'getFounderStudent'         => fn() => handleGetFounderStudent($pdo),
    'updateFounderName'         => fn() => handleUpdateFounderName($pdo, $input),
    'updateFounderBalance'      => fn() => handleUpdateFounderBalance($pdo, $input),
    'updateFounderExperience'   => fn() => handleUpdateFounderExperience($pdo, $input),
    'impersonateStudent'        => fn() => handleImpersonateStudent($pdo, $input),

    // --- Сезоны ---
    'getGlobalSeason'           => fn() => handleGetGlobalSeason($pdo),
    'setGlobalSeason'           => fn() => handleSetGlobalSeason($pdo, $input),
    'setPersonalSeason'         => fn() => handleSetPersonalSeason($pdo, $input),
    'getPersonalSeason'         => fn() => handleGetPersonalSeason($pdo),
];

// === Диспетчеризация ===
if (isset($routes[$endpoint])) {
    $routes[$endpoint]();
} else {
    respond(['success' => false, 'error' => 'Endpoint not found: ' . $endpoint], 404);
}