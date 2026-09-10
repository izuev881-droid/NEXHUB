<?php
// api/notifications.php

function handleGetNotifications($pdo) {
    $studentId = (int)($_GET['student_id'] ?? 0);
    $limit = min((int)($_GET['limit'] ?? 20), 50);
    $onlyUnread = isset($_GET['only_unread']) && $_GET['only_unread'] == 1;

    if (!$studentId) respond(['success' => false, 'error' => 'ID студента не указан']);

    $sql = "SELECT id, student_id, type, title, message, icon, color, link, is_read, created_at FROM notifications WHERE student_id = ?";
    $params = [$studentId];

    if ($onlyUnread) $sql .= " AND is_read = 0";
    $sql .= " ORDER BY created_at DESC LIMIT " . $limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $notifications = $stmt->fetchAll();

    foreach ($notifications as &$notif) {
        $notif['time_ago'] = getTimeAgo($notif['created_at']);
        $notif['time_formatted'] = date('d.m.Y H:i', strtotime($notif['created_at']));
    }

    respond(['success' => true, 'data' => $notifications]);
}

function handleMarkNotificationRead($pdo, $input) {
    $studentId = (int)($input['student_id'] ?? 0);
    $notificationId = (int)($input['notification_id'] ?? 0);

    if (!$studentId || !$notificationId) respond(['success' => false, 'error' => 'Недостаточно данных']);

    $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND student_id = ?");
    $stmt->execute([$notificationId, $studentId]);

    respond(['success' => true, 'data' => ['updated' => true]]);
}

function handleMarkAllNotificationsRead($pdo, $input) {
    $studentId = (int)($input['student_id'] ?? 0);
    if (!$studentId) respond(['success' => false, 'error' => 'ID студента не указан']);

    $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE student_id = ?")->execute([$studentId]);
    respond(['success' => true, 'data' => ['updated' => true]]);
}

function handleDeleteNotification($pdo, $input) {
    $studentId = (int)($input['student_id'] ?? 0);
    $notificationId = (int)($input['notification_id'] ?? 0);

    if (!$studentId || !$notificationId) respond(['success' => false, 'error' => 'Недостаточно данных']);

    $stmt = $pdo->prepare("DELETE FROM notifications WHERE id = ? AND student_id = ?");
    $stmt->execute([$notificationId, $studentId]);

    respond(['success' => true, 'data' => ['deleted' => true]]);
}

function handleClearReadNotifications($pdo, $input) {
    $studentId = (int)($input['student_id'] ?? 0);
    if (!$studentId) respond(['success' => false, 'error' => 'ID студента не указан']);

    $pdo->prepare("DELETE FROM notifications WHERE student_id = ? AND is_read = 1")->execute([$studentId]);
    respond(['success' => true, 'data' => ['cleared' => true]]);
}

function handleGetUnreadNotificationsCount($pdo) {
    $studentId = (int)($_GET['student_id'] ?? 0);
    if (!$studentId) respond(['success' => false, 'error' => 'ID студента не указан']);

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE student_id = ? AND is_read = 0");
    $stmt->execute([$studentId]);
    $count = (int)$stmt->fetchColumn();

    header('Cache-Control: max-age=5, must-revalidate');
    respond(['success' => true, 'data' => ['unread_count' => $count]]);
}