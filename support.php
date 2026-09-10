<?php
// api/support.php — поддержка (тикеты)

// ============================================================
// ПОЛУЧЕНИЕ ТИКЕТОВ
// ============================================================
function handleGetSupportTickets($pdo) {
    $stmt = $pdo->prepare("SELECT * FROM support_tickets WHERE student_id=? ORDER BY created_at DESC");
    $stmt->execute([$_GET['student_id']??0]);
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleGetAllSupportTickets($pdo) {
    $stmt = $pdo->query("SELECT st.*, s.name as student_name, g.name as group_name FROM support_tickets st LEFT JOIN students s ON st.student_id=s.id LEFT JOIN `groups` g ON s.group_id=g.id ORDER BY st.created_at DESC");
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

// ============================================================
// СОЗДАНИЕ ОБРАЩЕНИЯ (с уведомлениями админам)
// ============================================================
function handleSendSupportMessage($pdo, $input) {
    $tid = 'ticket_' . time() . '_' . rand(1000, 9999);
    $studentId = (int)($input['student_id'] ?? 0);
    $text = $input['text'] ?? '';
    $isAnonymous = (int)($input['is_anonymous'] ?? 0);

    $pdo->prepare("INSERT INTO support_tickets (ticket_id, student_id, text, is_anonymous, created_at) VALUES (?,?,?,?,NOW())")
        ->execute([$tid, $studentId, $text, $isAnonymous]);

    // Логи обновлений
    logTicketUpdate($pdo, $studentId, $tid, 'new_ticket', 'Новое обращение в поддержку', 1);
    logTicketUpdate($pdo, $studentId, $tid, 'new_ticket', 'Обращение создано', 0);

    // ⚡ Уведомить всех админов и основателя
    try {
        $stmtAdmins = $pdo->query("SELECT id, role FROM users WHERE role IN ('admin', 'founder')");
        $admins = $stmtAdmins->fetchAll();
        foreach ($admins as $admin) {
            addNotification(
                $pdo,
                -$admin['id'],                                     // ⬅️ отрицательный ID для админа
                'support',
                'Новое обращение в поддержку',
                'Поступило новое обращение от ' . ($isAnonymous ? 'анонима' : 'студента'),
                'headset',
                '#3b82f6',
                '#/chat-admin'
            );
        }
    } catch (Exception $e) {
        error_log('Notify admins error: ' . $e->getMessage());
    }

    respond(['success'=>true,'data'=>['ticketId'=>$tid]]);
}

// ============================================================
// ДОБАВЛЕНИЕ ОТВЕТА (уведомления в обе стороны)
// ============================================================
function handleAddSupportReply($pdo, $input) {
    $rid = 'reply_' . time() . '_' . rand(1000, 9999);
    $ticketId = $input['ticket_id'] ?? '';
    $text = $input['text'] ?? '';
    $isAdmin = (int)($input['is_admin'] ?? 0);
    $adminName = $input['admin_name'] ?? '';

    $pdo->prepare("INSERT INTO support_replies (reply_id, ticket_id, text, is_admin_reply, admin_name) VALUES (?,?,?,?,?)")
        ->execute([$rid, $ticketId, $text, $isAdmin, $adminName]);

    // Получаем информацию о тикете
    $stmt = $pdo->prepare("SELECT student_id FROM support_tickets WHERE ticket_id = ?");
    $stmt->execute([$ticketId]);
    $ticket = $stmt->fetch();
    $studentId = $ticket ? (int)$ticket['student_id'] : 0;

    if ($isAdmin == 1) {
        // ⚡ ОТВЕТ АДМИНА → уведомить студента
        $pdo->prepare("UPDATE support_tickets SET answer=?, answer_date=NOW() WHERE ticket_id=?")
            ->execute([$text, $ticketId]);

        if ($studentId > 0) {
            logTicketUpdate($pdo, $studentId, $ticketId, 'admin_reply', 'Администратор ответил', 1);
            logTicketUpdate($pdo, $studentId, $ticketId, 'admin_reply', 'Новый ответ от поддержки', 0);

            // Уведомление студенту
            addNotification(
                $pdo,
                $studentId,
                'support',
                'Ответ от поддержки',
                'Администратор ответил на ваше обращение',
                'reply',
                '#10b981',
                '#/chat'
            );
        }

        logTicketUpdate($pdo, 0, $ticketId, 'admin_reply', 'Новый ответ администратора', 1);
    } else {
        // ⚡ ОТВЕТ СТУДЕНТА → уведомить всех админов
        if ($studentId > 0) {
            logTicketUpdate($pdo, $studentId, $ticketId, 'student_reply', 'Новое сообщение от студента', 0);
            logTicketUpdate($pdo, $studentId, $ticketId, 'student_reply', 'Новое сообщение от студента', 1);

            // Уведомление всем админам
            try {
                $stmtAdmins = $pdo->query("SELECT id FROM users WHERE role IN ('admin', 'founder')");
                $admins = $stmtAdmins->fetchAll();
                foreach ($admins as $admin) {
                    addNotification(
                        $pdo,
                        -$admin['id'],
                        'support',
                        'Новое сообщение в обращении',
                        'Студент ответил в обращении #' . substr($ticketId, -6),
                        'comment',
                        '#3b82f6',
                        '#/chat-admin'
                    );
                }
            } catch (Exception $e) {
                error_log('Notify admins reply error: ' . $e->getMessage());
            }
        }
    }

    respond(['success'=>true,'data'=>['replyId'=>$rid]]);
}

// ============================================================
// ПОЛУЧЕНИЕ ОТВЕТОВ
// ============================================================
function handleGetTicketReplies($pdo) {
    $stmt = $pdo->prepare("SELECT * FROM support_replies WHERE ticket_id=? ORDER BY created_at ASC");
    $stmt->execute([$_GET['ticket_id']??'']);
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

// ============================================================
// УДАЛЕНИЕ ТИКЕТА
// ============================================================
function handleDeleteSupportTicket($pdo, $input) {
    $tid = $input['ticket_id'] ?? '';

    $stmt = $pdo->prepare("SELECT student_id FROM support_tickets WHERE ticket_id = ?");
    $stmt->execute([$tid]);
    $ticket = $stmt->fetch();
    $studentId = $ticket ? (int)$ticket['student_id'] : 0;

    $pdo->prepare("DELETE FROM support_replies WHERE ticket_id=?")->execute([$tid]);
    $pdo->prepare("DELETE FROM support_tickets WHERE ticket_id=?")->execute([$tid]);

    if ($studentId > 0) {
        logTicketUpdate($pdo, $studentId, $tid, 'deleted', 'Обращение удалено', 1);
        logTicketUpdate($pdo, $studentId, $tid, 'deleted', 'Обращение удалено', 0);
        logTicketUpdate($pdo, 0, $tid, 'deleted', 'Обращение удалено админом', 1);

        // Уведомление студенту
        addNotification(
            $pdo,
            $studentId,
            'support',
            'Обращение удалено',
            'Ваше обращение было удалено администратором',
            'trash',
            '#ef4444',
            '#/chat'
        );
    }

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Удаление тикета поддержки', "ID тикета: $tid");
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}

// ============================================================
// ПРЯМОЙ ОТВЕТ НА ТИКЕТ
// ============================================================
function handleAnswerSupport($pdo, $input) {
    $ticketId = $input['ticket_id'] ?? '';
    $answer = $input['answer'] ?? '';

    $pdo->prepare("UPDATE support_tickets SET answer=?, answer_date=NOW() WHERE ticket_id=?")
        ->execute([$answer, $ticketId]);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Ответ в тикете поддержки', "ID тикета: $ticketId");
    respond(['success'=>true,'data'=>['answered'=>true]]);
}

// ============================================================
// LONG-POLLING ОБНОВЛЕНИЙ ТИКЕТОВ
// ============================================================
function handleGetTicketUpdates($pdo) {
    $studentId = (int)($_GET['student_id'] ?? 0);
    $lastUpdateId = (int)($_GET['last_update_id'] ?? 0);
    $isAdmin = (int)($_GET['is_admin'] ?? 0);
    $timeout = 10;   // ⬅️ было 25, стало 10 (меньше держим PHP-воркер)
    $startTime = time();

    while (time() - $startTime < $timeout) {
        if ($isAdmin) {
            // Админ видит все is_admin = 1
            $stmt = $pdo->prepare("SELECT * FROM ticket_updates WHERE is_admin = 1 AND id > ? ORDER BY id ASC");
            $stmt->execute([$lastUpdateId]);
        } else {
            // Студент видит только свои is_admin = 0
            $stmt = $pdo->prepare("SELECT * FROM ticket_updates WHERE student_id = ? AND is_admin = 0 AND id > ? ORDER BY id ASC");
            $stmt->execute([$studentId, $lastUpdateId]);
        }

        $updates = $stmt->fetchAll();

        if (!empty($updates)) {
            // Очищаем старые записи
            $pdo->exec("DELETE FROM ticket_updates WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 MINUTE)");

            respond([
                'success' => true,
                'data' => $updates,
                'last_update_id' => end($updates)['id']
            ]);
        }

        usleep(200000);  // 0.2 сек между проверками
    }

    respond(['success' => true, 'data' => [], 'last_update_id' => $lastUpdateId]);
}