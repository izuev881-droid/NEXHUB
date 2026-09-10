<?php
// api/messenger.php

function handleGetAllUsersForChat($pdo) {
    $currentUserId = (int)($_GET['student_id'] ?? 0);
    $search = $_GET['search'] ?? '';
    $includeAdmins = isset($_GET['include_admins']) ? (bool)$_GET['include_admins'] : true;

    $sql = "SELECT s.id, s.name, COALESCE(g.name, 'Без группы') as group_name, 'student' as user_type 
            FROM students s 
            LEFT JOIN `groups` g ON s.group_id = g.id 
            WHERE s.id != ? AND s.name != 'System' AND s.id > 0";
    $params = [$currentUserId];

    if (!empty($search)) {
        $sql .= " AND s.name LIKE ?";
        $params[] = "%$search%";
    }
    $sql .= " ORDER BY s.name LIMIT 100";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $students = $stmt->fetchAll();

    $users = [];
    foreach ($students as $student) {
        $users[] = [
            'id' => $student['id'],
            'name' => $student['name'],
            'group_name' => $student['group_name'],
            'user_type' => 'student',
            'is_admin' => false
        ];
    }

    if ($includeAdmins) {
        $sqlAdmin = "SELECT id, login as name, role, 0 as student_id FROM users WHERE role IN ('admin', 'founder')";
        if (!empty($search)) {
            $sqlAdmin .= " AND login LIKE ?";
            $stmtAdmin = $pdo->prepare($sqlAdmin);
            $stmtAdmin->execute(["%$search%"]);
        } else {
            $stmtAdmin = $pdo->query($sqlAdmin);
        }
        $admins = $stmtAdmin->fetchAll();

        foreach ($admins as $admin) {
            if ($admin['id'] == $currentUserId) continue;
            $users[] = [
                'id' => -$admin['id'],
                'name' => $admin['name'] . ' (' . ($admin['role'] === 'founder' ? 'Основатель' : 'Админ') . ')',
                'group_name' => $admin['role'] === 'founder' ? '👑 Основатель' : '🛡️ Администратор',
                'user_type' => 'admin',
                'is_admin' => true,
                'original_id' => $admin['id'],
                'role' => $admin['role']
            ];
        }
    }

    respond(['success' => true, 'data' => $users]);
}

function handleSearchStudentsToAdd($pdo) {
    $conversationId = (int)($_GET['conversation_id'] ?? 0);
    $currentUserId = (int)($_GET['current_user_id'] ?? 0);
    $search = $_GET['search'] ?? '';

    if (!$conversationId) respond(['success' => false, 'error' => 'ID чата не указан']);

    $stmt = $pdo->prepare("SELECT student_id FROM chat_participants WHERE conversation_id = ?");
    $stmt->execute([$conversationId]);
    $existingIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $excludeIds = array_merge($existingIds, [$currentUserId]);
    $placeholders = implode(',', array_fill(0, count($excludeIds), '?'));

    $sql = "SELECT s.id, s.name, COALESCE(g.name, 'Без группы') as group_name, 'student' as user_type 
            FROM students s 
            LEFT JOIN `groups` g ON s.group_id = g.id 
            WHERE s.id NOT IN ($placeholders) AND s.name != 'System' AND s.id > 0";
    $params = $excludeIds;

    if (!empty($search)) {
        $sql .= " AND s.name LIKE ?";
        $params[] = "%$search%";
    }
    $sql .= " ORDER BY s.name LIMIT 50";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $students = $stmt->fetchAll();

    $sqlAdmin = "SELECT id, login as name, role, 'admin' as user_type 
                 FROM users 
                 WHERE role IN ('admin', 'founder') 
                 AND id NOT IN ($placeholders)";
    $paramsAdmin = $excludeIds;

    if (!empty($search)) {
        $sqlAdmin .= " AND login LIKE ?";
        $paramsAdmin[] = "%$search%";
    }
    $sqlAdmin .= " LIMIT 30";

    $stmt = $pdo->prepare($sqlAdmin);
    $stmt->execute($paramsAdmin);
    $admins = $stmt->fetchAll();

    foreach ($admins as &$admin) {
        $admin['id'] = -$admin['id'];
        $admin['group_name'] = $admin['role'] === 'founder' ? '👑 Основатель' : '🛡️ Администратор';
        $admin['name'] = $admin['name'] . ' (' . ($admin['role'] === 'founder' ? 'Основатель' : 'Админ') . ')';
    }

    $all = array_merge($students, $admins);
    respond(['success' => true, 'data' => $all]);
}

function handleGetOrCreateChat($pdo, $input) {
    $currentUserId = (int)($input['user_id'] ?? 0);
    $targetUserId = (int)($input['target_user_id'] ?? 0);
    $currentUserType = $input['current_user_type'] ?? 'student';
    $targetUserType = $input['target_user_type'] ?? 'student';

    if (!$currentUserId || !$targetUserId) {
        respond(['success' => false, 'error' => 'Недостаточно данных']);
    }

    $participant1 = $currentUserId;
    $participant2 = $targetUserId;
    if ($currentUserType === 'admin' && $currentUserId > 0) $participant1 = -$currentUserId;
    if ($targetUserType === 'admin' && $targetUserId > 0) $participant2 = -$targetUserId;

    $stmt = $pdo->prepare("SELECT c.* FROM chat_conversations c 
        JOIN chat_participants p1 ON c.id = p1.conversation_id AND p1.student_id = ?
        JOIN chat_participants p2 ON c.id = p2.conversation_id AND p2.student_id = ?
        WHERE c.type = 'private'");
    $stmt->execute([$participant1, $participant2]);
    $chat = $stmt->fetch();

    if (!$chat) {
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO chat_conversations (type, created_by) VALUES ('private', ?)");
            $stmt->execute([$participant1]);
            $chatId = $pdo->lastInsertId();

            $stmt = $pdo->prepare("INSERT INTO chat_participants (conversation_id, student_id) VALUES (?, ?)");
            $stmt->execute([$chatId, $participant1]);
            $stmt->execute([$chatId, $participant2]);

            $pdo->commit();

            $stmt = $pdo->prepare("SELECT * FROM chat_conversations WHERE id = ?");
            $stmt->execute([$chatId]);
            $chat = $stmt->fetch();
        } catch (Exception $e) {
            $pdo->rollBack();
            respond(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    respond(['success' => true, 'data' => $chat]);
}

function handleGetOrCreatePrivateChat($pdo, $input) {
    $studentId1 = (int)($input['student_id'] ?? 0);
    $studentId2 = (int)($input['other_student_id'] ?? 0);

    $stmt = $pdo->prepare("SELECT c.* FROM chat_conversations c 
        JOIN chat_participants p1 ON c.id = p1.conversation_id AND p1.student_id = ? 
        JOIN chat_participants p2 ON c.id = p2.conversation_id AND p2.student_id = ? 
        WHERE c.type = 'private'");
    $stmt->execute([$studentId1, $studentId2]);
    $chat = $stmt->fetch();

    if (!$chat) {
        $pdo->prepare("INSERT INTO chat_conversations (type, created_by) VALUES ('private', ?)")->execute([$studentId1]);
        $chatId = $pdo->lastInsertId();

        $stmt = $pdo->prepare("INSERT INTO chat_participants (conversation_id, student_id) VALUES (?, ?)");
        $stmt->execute([$chatId, $studentId1]);
        $stmt->execute([$chatId, $studentId2]);

        $stmt = $pdo->prepare("SELECT * FROM chat_conversations WHERE id = ?");
        $stmt->execute([$chatId]);
        $chat = $stmt->fetch();
    }
    respond(['success'=>true,'data'=>$chat]);
}

function handleGetAdminChats($pdo) {
    $adminId = (int)($_GET['admin_id'] ?? 0);
    $adminParticipantId = -$adminId;

    $stmt = $pdo->prepare("
        SELECT DISTINCT c.*, 
            (SELECT text FROM chat_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message,
            (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message_time
        FROM chat_conversations c 
        INNER JOIN chat_participants p ON c.id = p.conversation_id AND p.student_id = ?
        ORDER BY COALESCE(last_message_time, c.created_at) DESC
    ");
    $stmt->execute([$adminParticipantId]);
    $chats = $stmt->fetchAll();

    foreach ($chats as &$chat) {
        if ($chat['type'] == 'private') {
            $stmt2 = $pdo->prepare("
                SELECT 
                    p.student_id,
                    CASE 
                        WHEN p.student_id < 0 THEN (SELECT login FROM users WHERE id = ABS(p.student_id))
                        ELSE (SELECT name FROM students WHERE id = p.student_id)
                    END as name,
                    CASE 
                        WHEN p.student_id < 0 THEN 'admin'
                        ELSE 'student'
                    END as user_type
                FROM chat_participants p 
                WHERE p.conversation_id = ? AND p.student_id != ?
                LIMIT 1
            ");
            $stmt2->execute([$chat['id'], $adminParticipantId]);
            $other = $stmt2->fetch();

            if ($other) {
                if ($other['user_type'] === 'admin') {
                    $chat['display_name'] = $other['name'] . ($other['name'] === 'SHub' ? ' (Основатель)' : ' (Администратор)');
                } else {
                    $chat['display_name'] = $other['name'];
                }
                $chat['is_admin_chat'] = ($other['user_type'] === 'admin');
            } else {
                $chat['display_name'] = 'Пользователь';
            }
        } else {
            $chat['display_name'] = $chat['name'] ?? 'Групповой чат';
            $chat['is_admin_chat'] = false;
        }
        $chat['last_message_time_formatted'] = $chat['last_message_time'] ? 'только что' : '';
    }

    respond(['success' => true, 'data' => $chats]);
}

function handleGetStudentChats($pdo) {
    $studentId = (int)($_GET['student_id'] ?? 0);

    $stmt = $pdo->prepare("
        SELECT DISTINCT c.*, 
            (SELECT text FROM chat_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message,
            (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message_time
        FROM chat_conversations c 
        INNER JOIN chat_participants p ON c.id = p.conversation_id AND p.student_id = ?
        ORDER BY COALESCE(last_message_time, c.created_at) DESC
    ");
    $stmt->execute([$studentId]);
    $chats = $stmt->fetchAll();

    foreach ($chats as &$chat) {
        if ($chat['type'] == 'private') {
            $stmt2 = $pdo->prepare("
                SELECT 
                    p.student_id,
                    CASE 
                        WHEN p.student_id < 0 THEN (SELECT login FROM users WHERE id = ABS(p.student_id))
                        ELSE (SELECT name FROM students WHERE id = p.student_id)
                    END as name,
                    CASE 
                        WHEN p.student_id < 0 THEN 'admin'
                        ELSE 'student'
                    END as user_type
                FROM chat_participants p 
                WHERE p.conversation_id = ? AND p.student_id != ?
                LIMIT 1
            ");
            $stmt2->execute([$chat['id'], $studentId]);
            $other = $stmt2->fetch();

            if ($other) {
                if ($other['user_type'] === 'admin') {
                    $chat['display_name'] = $other['name'] . ($other['name'] === 'SHub' ? ' (Основатель)' : ' (Администратор)');
                } else {
                    $chat['display_name'] = $other['name'];
                }
                $chat['is_admin_chat'] = ($other['user_type'] === 'admin');
            } else {
                $chat['display_name'] = 'Пользователь';
            }
        } else {
            $chat['display_name'] = $chat['name'] ?? 'Групповой чат';
            $chat['is_admin_chat'] = false;
        }
        $chat['last_message_time_formatted'] = $chat['last_message_time'] ? 'только что' : '';
    }

    respond(['success' => true, 'data' => $chats]);
}

function handleGetAllAdmins($pdo) {
    $stmt = $pdo->query("SELECT id, login, role FROM users WHERE role IN ('admin', 'founder')");
    $admins = $stmt->fetchAll();

    $result = [];
    foreach ($admins as $admin) {
        $result[] = [
            'id' => $admin['id'],
            'name' => $admin['login'],
            'role' => $admin['role'],
            'display_name' => $admin['login'] . ($admin['role'] === 'founder' ? ' (Основатель)' : ' (Админ)')
        ];
    }
    respond(['success' => true, 'data' => $result]);
}

function handleAddAdminToGroup($pdo, $input) {
    $conversationId = (int)($input['conversation_id'] ?? 0);
    $currentUserId = (int)($input['current_user_id'] ?? 0);
    $adminId = (int)($input['admin_id'] ?? 0);
    $isAdmin = (int)($input['is_admin'] ?? 0);

    if (!$conversationId || !$adminId) {
        respond(['success' => false, 'error' => 'Недостаточно данных']);
    }

    try {
        $stmt = $pdo->prepare("SELECT created_by FROM chat_conversations WHERE id = ? AND type = 'group'");
        $stmt->execute([$conversationId]);
        $group = $stmt->fetch();

        if (!$group) respond(['success' => false, 'error' => 'Группа не найдена']);
        if ($group['created_by'] != $currentUserId && !$isAdmin) {
            respond(['success' => false, 'error' => 'Нет прав для добавления участников']);
        }

        $adminParticipantId = -$adminId;

        $stmt = $pdo->prepare("INSERT IGNORE INTO chat_participants (conversation_id, student_id) VALUES (?, ?)");
        $stmt->execute([$conversationId, $adminParticipantId]);

        if ($stmt->rowCount() > 0) {
            $stmt = $pdo->prepare("SELECT login FROM users WHERE id = ?");
            $stmt->execute([$adminId]);
            $adminName = $stmt->fetchColumn();

            $stmt = $pdo->prepare("SELECT name FROM students WHERE id = ?");
            $stmt->execute([$currentUserId]);
            $creatorName = $stmt->fetchColumn();
            if (!$creatorName) {
                $stmt = $pdo->prepare("SELECT login FROM users WHERE id = ?");
                $stmt->execute([$currentUserId]);
                $creatorName = $stmt->fetchColumn() ?: 'Пользователь';
            }

            $systemMsg = sanitizeText("👤 " . $creatorName . " добавил(а) администратора " . $adminName . " в группу");
            $stmt = $pdo->prepare("INSERT INTO chat_messages (conversation_id, student_id, student_name, text) VALUES (?, 0, 'System', ?)");
            $stmt->execute([$conversationId, $systemMsg]);
        }

        respond(['success' => true, 'data' => ['added' => true]]);
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetAllStudentsForChat($pdo) {
    $currentStudentId = (int)($_GET['student_id'] ?? 0);
    $search = $_GET['search'] ?? '';

    $sql = "SELECT s.id, s.name, COALESCE(g.name, 'Без группы') as group_name FROM students s LEFT JOIN `groups` g ON s.group_id=g.id WHERE s.id != ? AND s.name != 'System' AND s.id > 0";
    $params = [$currentStudentId];
    if (!empty($search)) {
        $sql .= " AND s.name LIKE ?";
        $params[] = "%$search%";
    }
    $sql .= " ORDER BY s.name LIMIT 50";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleGetChatParticipants($pdo) {
    $conversationId = (int)($_GET['conversation_id'] ?? 0);
    $studentId = (int)($_GET['student_id'] ?? 0);

    $stmt = $pdo->prepare("SELECT 1 FROM chat_participants WHERE conversation_id = ? AND student_id = ?");
    $stmt->execute([$conversationId, $studentId]);
    if (!$stmt->fetch()) respond(['success'=>false,'error'=>'Нет доступа']);

    $stmt = $pdo->prepare("SELECT s.id, s.name, COALESCE(g.name, 'Без группы') as group_name FROM chat_participants p JOIN students s ON p.student_id = s.id LEFT JOIN `groups` g ON s.group_id=g.id WHERE p.conversation_id = ? ORDER BY s.name");
    $stmt->execute([$conversationId]);
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleCreateGroupChat($pdo, $input) {
    $name = trim($input['name'] ?? '');
    $createdBy = (int)($input['created_by'] ?? 0);
    $participants = $input['participants'] ?? [];

    if (empty($name)) respond(['success'=>false,'error'=>'Введите название']);
    if (count($participants) < 2) respond(['success'=>false,'error'=>'Минимум 2 участника']);

    $participants = array_map('intval', $participants);
    $participants = array_unique($participants);
    if (!in_array($createdBy, $participants)) $participants[] = $createdBy;

    $pdo->beginTransaction();
    $pdo->prepare("INSERT INTO chat_conversations (type, name, created_by) VALUES ('group', ?, ?)")->execute([$name, $createdBy]);
    $conversationId = $pdo->lastInsertId();

    $stmt = $pdo->prepare("INSERT INTO chat_participants (conversation_id, student_id) VALUES (?, ?)");
    foreach ($participants as $studentId) {
        $stmt->execute([$conversationId, $studentId]);
    }
    $pdo->commit();

    respond(['success'=>true,'data'=>['id'=>$conversationId,'name'=>$name]]);
}

function handleGetChatMessages($pdo) {
    $conversationId = (int)($_GET['conversation_id'] ?? 0);
    $userId = (int)($_GET['student_id'] ?? 0);
    $userType = $_GET['user_type'] ?? 'student';
    $limit = min((int)($_GET['limit'] ?? 100), 200);

    $participantId = ($userType === 'admin' && $userId > 0) ? -$userId : $userId;

    $stmt = $pdo->prepare("SELECT 1 FROM chat_participants WHERE conversation_id = ? AND student_id = ?");
    $stmt->execute([$conversationId, $participantId]);
    if (!$stmt->fetch()) respond(['success' => false, 'error' => 'Нет доступа']);

    $sql = "SELECT * FROM chat_messages WHERE conversation_id = ? AND is_deleted = 0 ORDER BY id ASC LIMIT " . $limit;
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$conversationId]);
    $messages = $stmt->fetchAll();

    foreach ($messages as &$msg) {
        $time = new DateTime($msg['created_at']);
        $msg['time_formatted'] = $time->format('H:i');

        if ($msg['student_id'] < 0 && $msg['student_name'] !== 'System') {
            $stmt2 = $pdo->prepare("SELECT login FROM users WHERE id = ?");
            $stmt2->execute([abs($msg['student_id'])]);
            $adminUser = $stmt2->fetch();
            if ($adminUser) {
                $msg['student_name'] = $adminUser['login'] . ($adminUser['login'] === 'SHub' ? ' (Основатель)' : ' (Админ)');
            }
        }

        if ($msg['student_id'] > 0) {
            $stmt2 = $pdo->prepare("
                SELECT t.id, t.name as title_name, t.color as title_color, t.icon as title_icon, t.rarity as title_rarity 
                FROM active_titles at 
                JOIN titles t ON at.title_id = t.id 
                WHERE at.student_id = ?
            ");
            $stmt2->execute([$msg['student_id']]);
            $title = $stmt2->fetch();
            if ($title) {
                $msg['title'] = [
                    'title_name' => $title['title_name'],
                    'title_color' => $title['title_color'],
                    'title_icon' => $title['title_icon'],
                    'title_rarity' => $title['title_rarity']
                ];
            }
        }
    }

    respond(['success' => true, 'data' => $messages]);
}

function handleSendChatMessage($pdo, $input) {
    $conversationId = (int)($input['conversation_id'] ?? 0);
    $senderId = (int)($input['student_id'] ?? 0);
    $senderName = trim($input['student_name'] ?? '');
    $senderType = $input['sender_type'] ?? 'student';
    $text = trim($input['text'] ?? '');

    if (!$conversationId || !$senderId || empty($text)) {
        respond(['success' => false, 'error' => 'Недостаточно данных']);
    }

    $participantId = ($senderType === 'admin' && $senderId > 0) ? -$senderId : $senderId;

    $stmt = $pdo->prepare("SELECT 1 FROM chat_participants WHERE conversation_id = ? AND student_id = ?");
    $stmt->execute([$conversationId, $participantId]);
    if (!$stmt->fetch()) respond(['success' => false, 'error' => 'Нет доступа к чату']);

    $pdo->prepare("INSERT INTO chat_messages (conversation_id, student_id, student_name, text, is_forwarded) VALUES (?, ?, ?, ?, 0)")
        ->execute([$conversationId, $participantId, $senderName, $text]);

    $stmt = $pdo->prepare("SELECT student_id FROM chat_participants WHERE conversation_id = ? AND student_id != ?");
    $stmt->execute([$conversationId, $participantId]);
    $recipients = $stmt->fetchAll(PDO::FETCH_COLUMN);

    foreach ($recipients as $recipientId) {
        if ($recipientId < 0) continue;
        addNotification($pdo, $recipientId, 'message', 'Новое сообщение', "Новое сообщение от {$senderName} в чате", 'envelope', '#3b82f6', '#/messenger');
    }

    respond(['success' => true, 'data' => ['id' => $pdo->lastInsertId()]]);
}

function handleGetNewChatMessages($pdo) {
    $conversationId = (int)($_GET['conversation_id'] ?? 0);
    $userId = (int)($_GET['student_id'] ?? 0);
    $userType = $_GET['user_type'] ?? 'student';
    $lastId = (int)($_GET['last_id'] ?? 0);
    $timeout = 10;
    $startTime = time();

    if (!$conversationId || !$userId) {
        respond(['success' => false, 'error' => 'Недостаточно данных']);
    }

    $participantId = ($userType === 'admin' && $userId > 0) ? -$userId : $userId;

    while (time() - $startTime < $timeout) {
        $stmt = $pdo->prepare("
            SELECT m.* FROM chat_messages m 
            WHERE m.conversation_id = ? AND m.id > ? AND m.is_deleted = 0 
            ORDER BY m.id ASC
        ");
        $stmt->execute([$conversationId, $lastId]);
        $newMessages = $stmt->fetchAll();

        if (empty($newMessages) && $lastId > 0) {
            $stmt = $pdo->prepare("
                SELECT m.* FROM chat_messages m 
                WHERE m.conversation_id = ? AND m.id <= ? AND m.is_edited = 1 AND m.edited_at > DATE_SUB(NOW(), INTERVAL 10 SECOND)
                ORDER BY m.id ASC
            ");
            $stmt->execute([$conversationId, $lastId]);
            $editedMessages = $stmt->fetchAll();
            if (!empty($editedMessages)) $newMessages = $editedMessages;
        }

        if (!empty($newMessages)) {
            foreach ($newMessages as &$msg) {
                $time = new DateTime($msg['created_at']);
                $msg['time_formatted'] = $time->format('H:i');

                if ($msg['student_id'] < 0 && $msg['student_name'] !== 'System') {
                    $stmt2 = $pdo->prepare("SELECT login FROM users WHERE id = ?");
                    $stmt2->execute([abs($msg['student_id'])]);
                    $adminUser = $stmt2->fetch();
                    if ($adminUser) {
                        $msg['student_name'] = $adminUser['login'] . ($adminUser['login'] === 'SHub' ? ' (Основатель)' : ' (Админ)');
                    }
                }

                if ($msg['student_id'] > 0) {
                    $stmt2 = $pdo->prepare("
                        SELECT t.id, t.name as title_name, t.color as title_color, t.icon as title_icon, t.rarity as title_rarity 
                        FROM active_titles at 
                        JOIN titles t ON at.title_id = t.id 
                        WHERE at.student_id = ?
                    ");
                    $stmt2->execute([$msg['student_id']]);
                    $title = $stmt2->fetch();
                    if ($title) {
                        $msg['title'] = [
                            'title_name' => $title['title_name'],
                            'title_color' => $title['title_color'],
                            'title_icon' => $title['title_icon'],
                            'title_rarity' => $title['title_rarity']
                        ];
                    }
                }
            }

            $maxId = max(array_column($newMessages, 'id'));
            $pdo->prepare("
                UPDATE chat_participants 
                SET last_read_id = ? 
                WHERE conversation_id = ? AND student_id = ? AND (last_read_id IS NULL OR last_read_id < ?)
            ")->execute([$maxId, $conversationId, $participantId, $maxId]);

            respond(['success' => true, 'data' => $newMessages]);
        }
        usleep(200000);
    }
    respond(['success' => true, 'data' => []]);
}

function handleGetChatMessageInfo($pdo) {
    $messageId = (int)($_GET['message_id'] ?? 0);
    if (!$messageId) respond(['success' => false, 'error' => 'ID сообщения не указан']);

    $stmt = $pdo->prepare("SELECT id, is_forwarded, original_author, original_message_id FROM chat_messages WHERE id = ?");
    $stmt->execute([$messageId]);
    $msg = $stmt->fetch();

    respond(['success' => true, 'data' => $msg]);
}

function handleEditChatMessage($pdo, $input) {
    $messageId = (int)($input['message_id'] ?? 0);
    $studentId = (int)($input['student_id'] ?? 0);
    $newText = trim($input['text'] ?? '');

    if (!$messageId || !$studentId || empty($newText)) {
        respond(['success' => false, 'error' => 'Недостаточно данных']);
    }

    $stmt = $pdo->prepare("SELECT is_forwarded, student_id, created_at, text, conversation_id FROM chat_messages WHERE id = ? AND is_deleted = 0");
    $stmt->execute([$messageId]);
    $message = $stmt->fetch();

    if (!$message) respond(['success' => false, 'error' => 'Сообщение не найдено']);
    if ($message['is_forwarded']) respond(['success' => false, 'error' => 'Пересланные сообщения нельзя редактировать']);
    if (strlen($newText) > 2000) respond(['success' => false, 'error' => 'Сообщение слишком длинное']);

    $isAdmin = false;
    if ($studentId > 0) {
        $stmt = $pdo->prepare("SELECT role FROM users WHERE student_id = ? OR id = ?");
        $stmt->execute([$studentId, $studentId]);
        $user = $stmt->fetch();
        $isAdmin = ($user && in_array($user['role'], ['admin', 'founder']));
    }

    if ($message['student_id'] != $studentId && $message['student_id'] != -$studentId && !$isAdmin) {
        respond(['success' => false, 'error' => 'Можно редактировать только свои сообщения']);
    }

    $messageTime = strtotime($message['created_at']);
    $currentTime = time();
    $diffMinutes = ($currentTime - $messageTime) / 60;

    if (!$isAdmin && $diffMinutes > 5) {
        respond(['success' => false, 'error' => 'Сообщение можно редактировать только в течение 5 минут']);
    }

    $pdo->prepare("UPDATE chat_messages SET text = ?, is_edited = 1, edited_at = NOW() WHERE id = ?")->execute([$newText, $messageId]);

    if ($isAdmin && isset($input['user_login'])) {
        logAdminAction($pdo, $studentId, $input['user_login'], 'Редактирование сообщения в чате', "ID сообщения: $messageId");
    }

    respond(['success' => true, 'data' => ['edited' => true, 'new_text' => $newText, 'message_id' => $messageId]]);
}

function handleDeleteChatMessage($pdo, $input) {
    $messageId = (int)($input['message_id'] ?? 0);
    $studentId = (int)($input['student_id'] ?? 0);
    $isAdmin = (int)($input['is_admin'] ?? 0);

    if (!$messageId || !$studentId) respond(['success' => false, 'error' => 'Недостаточно данных']);

    try {
        $stmt = $pdo->prepare("SELECT student_id, conversation_id, is_forwarded FROM chat_messages WHERE id = ? AND is_deleted = 0");
        $stmt->execute([$messageId]);
        $message = $stmt->fetch();

        if (!$message) respond(['success' => false, 'error' => 'Сообщение не найдено']);
        if ($message['is_forwarded'] && !$isAdmin) respond(['success' => false, 'error' => 'Пересланные сообщения нельзя удалять']);

        if ($message['student_id'] != $studentId && $message['student_id'] != -$studentId && !$isAdmin) {
            $stmt2 = $pdo->prepare("SELECT c.created_by, c.type FROM chat_conversations c WHERE c.id = ?");
            $stmt2->execute([$message['conversation_id']]);
            $chat = $stmt2->fetch();

            if ($chat['type'] != 'group' || $chat['created_by'] != $studentId) {
                respond(['success' => false, 'error' => 'Можно удалять только свои сообщения']);
            }
        }

        $pdo->prepare("UPDATE chat_messages SET is_deleted = 1, text = '[Сообщение удалено]' WHERE id = ?")->execute([$messageId]);

        $stmt = $pdo->prepare("SELECT student_id FROM chat_participants WHERE conversation_id = ?");
        $stmt->execute([$message['conversation_id']]);
        $participants = $stmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($participants as $pid) {
            logMessengerUpdate($pdo, $pid, $message['conversation_id'], 'message_deleted', 'Сообщение удалено');
        }

        respond(['success' => true, 'data' => ['deleted' => true]]);
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleDeleteConversation($pdo, $input) {
    $conversationId = (int)($input['conversation_id'] ?? 0);
    $studentId = (int)($input['student_id'] ?? 0);
    $isAdmin = (int)($input['is_admin'] ?? 0);

    if (!$conversationId || !$studentId) respond(['success' => false, 'error' => 'Недостаточно данных']);

    try {
        $stmt = $pdo->prepare("SELECT type, created_by FROM chat_conversations WHERE id = ?");
        $stmt->execute([$conversationId]);
        $chat = $stmt->fetch();

        if (!$chat) respond(['success' => false, 'error' => 'Чат не найден']);

        $participantId = $studentId;
        if ($isAdmin && $studentId > 0) $participantId = -$studentId;

        $stmt = $pdo->prepare("SELECT 1 FROM chat_participants WHERE conversation_id = ? AND student_id = ?");
        $stmt->execute([$conversationId, $participantId]);
        if (!$stmt->fetch()) respond(['success' => false, 'error' => 'Вы не являетесь участником этого чата']);

        $stmt = $pdo->prepare("SELECT student_id FROM chat_participants WHERE conversation_id = ?");
        $stmt->execute([$conversationId]);
        $participants = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if ($chat['type'] == 'private') {
            foreach ($participants as $pid) {
                logMessengerUpdate($pdo, $pid, $conversationId, 'deleted', 'Чат удален');
            }
            $pdo->prepare("DELETE FROM chat_messages WHERE conversation_id = ?")->execute([$conversationId]);
            $pdo->prepare("DELETE FROM chat_participants WHERE conversation_id = ?")->execute([$conversationId]);
            $pdo->prepare("DELETE FROM chat_conversations WHERE id = ?")->execute([$conversationId]);
            respond(['success' => true, 'data' => ['deleted' => true]]);
        } else if ($chat['type'] == 'group') {
            if ($chat['created_by'] == $participantId || $isAdmin) {
                foreach ($participants as $pid) {
                    logMessengerUpdate($pdo, $pid, $conversationId, 'deleted', 'Группа удалена');
                }
                $pdo->prepare("DELETE FROM chat_messages WHERE conversation_id = ?")->execute([$conversationId]);
                $pdo->prepare("DELETE FROM chat_participants WHERE conversation_id = ?")->execute([$conversationId]);
                $pdo->prepare("DELETE FROM chat_conversations WHERE id = ?")->execute([$conversationId]);
                respond(['success' => true, 'data' => ['deleted' => true]]);
            } else {
                $pdo->prepare("DELETE FROM chat_participants WHERE conversation_id = ? AND student_id = ?")->execute([$conversationId, $participantId]);

                $stmt = $pdo->prepare("SELECT name FROM students WHERE id = ?");
                $stmt->execute([abs($studentId)]);
                $studentName = $stmt->fetchColumn();
                if (!$studentName) {
                    $stmt = $pdo->prepare("SELECT login FROM users WHERE id = ?");
                    $stmt->execute([$studentId]);
                    $studentName = $stmt->fetchColumn() ?: 'Пользователь';
                }

                foreach ($participants as $pid) {
                    if ($pid != $participantId) {
                        logMessengerUpdate($pdo, $pid, $conversationId, 'participant_left', "Пользователь {$studentName} покинул группу");
                    }
                }
                logMessengerUpdate($pdo, $participantId, $conversationId, 'left', 'Вы покинули группу');

                $systemMsg = sanitizeText("🚪 " . $studentName . " покинул(а) чат");
                $pdo->prepare("INSERT INTO chat_messages (conversation_id, student_id, student_name, text) VALUES (?, 0, 'System', ?)")->execute([$conversationId, $systemMsg]);
                respond(['success' => true, 'data' => ['left' => true]]);
            }
        }
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleRenameGroup($pdo, $input) {
    $conversationId = (int)($input['conversation_id'] ?? 0);
    $studentId = (int)($input['student_id'] ?? 0);
    $newName = trim($input['new_name'] ?? '');

    if (!$conversationId || !$studentId || empty($newName)) {
        respond(['success' => false, 'error' => 'Недостаточно данных']);
    }

    try {
        $stmt = $pdo->prepare("SELECT created_by, type FROM chat_conversations WHERE id = ?");
        $stmt->execute([$conversationId]);
        $group = $stmt->fetch();

        if (!$group || $group['type'] != 'group') respond(['success' => false, 'error' => 'Группа не найдена']);

        $isAdmin = false;
        if ($studentId > 0) {
            $stmt = $pdo->prepare("SELECT role FROM users WHERE student_id = ?");
            $stmt->execute([$studentId]);
            $user = $stmt->fetch();
            $isAdmin = ($user && in_array($user['role'], ['admin', 'founder']));
        }

        if ($group['created_by'] != $studentId && !$isAdmin) {
            respond(['success' => false, 'error' => 'Нет прав для переименования группы']);
        }

        $pdo->prepare("UPDATE chat_conversations SET name = ? WHERE id = ?")->execute([$newName, $conversationId]);

        $stmt = $pdo->prepare("SELECT name FROM students WHERE id = ?");
        $stmt->execute([$studentId]);
        $creatorName = $stmt->fetchColumn();
        if (!$creatorName) {
            $stmt = $pdo->prepare("SELECT login FROM users WHERE id = ?");
            $stmt->execute([$studentId]);
            $creatorName = $stmt->fetchColumn() ?: 'Пользователь';
        }

        $stmt = $pdo->prepare("SELECT student_id FROM chat_participants WHERE conversation_id = ?");
        $stmt->execute([$conversationId]);
        $participants = $stmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($participants as $pid) {
            logMessengerUpdate($pdo, $pid, $conversationId, 'renamed', "Группа переименована в «{$newName}»");
        }

        $systemMsg = sanitizeText("📝 " . $creatorName . " изменил(а) название группы на \"" . $newName . "\"");
        $pdo->prepare("INSERT INTO chat_messages (conversation_id, student_id, student_name, text) VALUES (?, 0, 'System', ?)")->execute([$conversationId, $systemMsg]);

        respond(['success' => true, 'data' => ['new_name' => $newName]]);
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleRemoveGroupParticipant($pdo, $input) {
    $conversationId = (int)($input['conversation_id'] ?? 0);
    $studentId = (int)($input['student_id'] ?? 0);
    $targetStudentId = (int)($input['target_student_id'] ?? 0);

    if (!$conversationId || !$studentId || !$targetStudentId) {
        respond(['success' => false, 'error' => 'Недостаточно данных']);
    }

    try {
        $stmt = $pdo->prepare("SELECT created_by, name FROM chat_conversations WHERE id = ? AND type = 'group'");
        $stmt->execute([$conversationId]);
        $group = $stmt->fetch();

        if (!$group) respond(['success' => false, 'error' => 'Группа не найдена']);
        if ($group['created_by'] != $studentId) respond(['success' => false, 'error' => 'Только создатель группы может исключать участников']);
        if ($targetStudentId == $studentId) respond(['success' => false, 'error' => 'Нельзя исключить самого себя']);

        $pdo->prepare("DELETE FROM chat_participants WHERE conversation_id = ? AND student_id = ?")->execute([$conversationId, $targetStudentId]);

        $stmt = $pdo->prepare("SELECT name FROM students WHERE id = ?");
        $stmt->execute([$targetStudentId]);
        $targetName = $stmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT name FROM students WHERE id = ?");
        $stmt->execute([$studentId]);
        $creatorName = $stmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT student_id FROM chat_participants WHERE conversation_id = ?");
        $stmt->execute([$conversationId]);
        $participants = $stmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($participants as $pid) {
            logMessengerUpdate($pdo, $pid, $conversationId, 'participant_removed', "Пользователь {$targetName} был исключен из группы");
        }
        logMessengerUpdate($pdo, $targetStudentId, $conversationId, 'removed_from_group', "Вы были исключены из группы");

        $systemMsg = sanitizeText("⚠️ " . $creatorName . " исключил(а) " . $targetName . " из группы");
        $pdo->prepare("INSERT INTO chat_messages (conversation_id, student_id, student_name, text) VALUES (?, 0, 'System', ?)")->execute([$conversationId, $systemMsg]);

        respond(['success' => true, 'data' => ['removed' => true]]);
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleAddGroupParticipants($pdo, $input) {
    $conversationId = (int)($input['conversation_id'] ?? 0);
    $studentId = (int)($input['student_id'] ?? 0);
    $newParticipants = $input['participants'] ?? [];

    if (!$conversationId || empty($newParticipants)) {
        respond(['success' => false, 'error' => 'Недостаточно данных']);
    }

    try {
        $stmt = $pdo->prepare("SELECT created_by FROM chat_conversations WHERE id = ? AND type = 'group'");
        $stmt->execute([$conversationId]);
        $group = $stmt->fetch();

        if (!$group || $group['created_by'] != $studentId) {
            respond(['success' => false, 'error' => 'Только создатель группы может добавлять участников']);
        }

        $added = 0;
        $addedNames = [];
        $stmt = $pdo->prepare("INSERT IGNORE INTO chat_participants (conversation_id, student_id) VALUES (?, ?)");

        foreach ($newParticipants as $pid) {
            $stmt->execute([$conversationId, $pid]);
            if ($stmt->rowCount() > 0) {
                $added++;
                $stmt2 = $pdo->prepare("SELECT name FROM students WHERE id = ?");
                $stmt2->execute([$pid]);
                $name = $stmt2->fetchColumn();
                if ($name) $addedNames[] = $name;
                logMessengerUpdate($pdo, $pid, $conversationId, 'added_to_group', "Вы были добавлены в группу");
            }
        }

        if ($added > 0) {
            $stmt = $pdo->prepare("SELECT student_id FROM chat_participants WHERE conversation_id = ?");
            $stmt->execute([$conversationId]);
            $participants = $stmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($participants as $pid) {
                if (!in_array($pid, $newParticipants)) {
                    logMessengerUpdate($pdo, $pid, $conversationId, 'participants_added', "Новые участники добавлены в группу");
                }
            }

            $stmt = $pdo->prepare("SELECT name FROM students WHERE id = ?");
            $stmt->execute([$studentId]);
            $creatorName = $stmt->fetchColumn();

            $systemMsg = sanitizeText("👤 " . $creatorName . " добавил(а): " . implode(', ', $addedNames));
            $pdo->prepare("INSERT INTO chat_messages (conversation_id, student_id, student_name, text) VALUES (?, 0, 'System', ?)")->execute([$conversationId, $systemMsg]);
        }

        respond(['success' => true, 'data' => ['added' => $added]]);
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleLeaveGroup($pdo, $input) {
    $conversationId = (int)($input['conversation_id'] ?? 0);
    $studentId = (int)($input['student_id'] ?? 0);

    if (!$conversationId || !$studentId) respond(['success' => false, 'error' => 'Недостаточно данных']);

    try {
        $stmt = $pdo->prepare("SELECT created_by FROM chat_conversations WHERE id = ? AND type = 'group'");
        $stmt->execute([$conversationId]);
        $group = $stmt->fetch();

        if (!$group) respond(['success' => false, 'error' => 'Группа не найдена']);

        $stmt = $pdo->prepare("SELECT student_id FROM chat_participants WHERE conversation_id = ?");
        $stmt->execute([$conversationId]);
        $participants = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if ($group['created_by'] == $studentId) {
            foreach ($participants as $pid) {
                logMessengerUpdate($pdo, $pid, $conversationId, 'deleted', 'Группа удалена создателем');
            }
            $pdo->prepare("DELETE FROM chat_participants WHERE conversation_id = ?")->execute([$conversationId]);
            $pdo->prepare("DELETE FROM chat_messages WHERE conversation_id = ?")->execute([$conversationId]);
            $pdo->prepare("DELETE FROM chat_conversations WHERE id = ?")->execute([$conversationId]);
            respond(['success' => true, 'data' => ['deleted' => true]]);
        } else {
            $pdo->prepare("DELETE FROM chat_participants WHERE conversation_id = ? AND student_id = ?")->execute([$conversationId, $studentId]);

            $stmt = $pdo->prepare("SELECT name FROM students WHERE id = ?");
            $stmt->execute([$studentId]);
            $studentName = $stmt->fetchColumn();
            if (!$studentName) {
                $stmt = $pdo->prepare("SELECT login FROM users WHERE id = ?");
                $stmt->execute([$studentId]);
                $studentName = $stmt->fetchColumn() ?: 'Пользователь';
            }

            foreach ($participants as $pid) {
                if ($pid != $studentId) {
                    logMessengerUpdate($pdo, $pid, $conversationId, 'participant_left', "Пользователь {$studentName} покинул группу");
                }
            }
            logMessengerUpdate($pdo, $studentId, $conversationId, 'left', 'Вы покинули группу');

            $systemMsg = sanitizeText("🚪 " . $studentName . " покинул(а) чат");
            $pdo->prepare("INSERT INTO chat_messages (conversation_id, student_id, student_name, text) VALUES (?, 0, 'System', ?)")->execute([$conversationId, $systemMsg]);
            respond(['success' => true, 'data' => ['left' => true]]);
        }
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetGroupInfo($pdo) {
    $conversationId = (int)($_GET['conversation_id'] ?? 0);
    $studentId = (int)($_GET['student_id'] ?? 0);

    if (!$conversationId || !$studentId) respond(['success' => false, 'error' => 'Недостаточно данных']);

    try {
        $stmt = $pdo->prepare("SELECT c.*, (SELECT COUNT(*) FROM chat_participants WHERE conversation_id = c.id) as member_count FROM chat_conversations c WHERE c.id = ? AND c.type = 'group'");
        $stmt->execute([$conversationId]);
        $group = $stmt->fetch();

        if (!$group) respond(['success' => false, 'error' => 'Группа не найдена']);

        $stmt = $pdo->prepare("SELECT s.id, s.name, COALESCE(g.name, 'Без группы') as group_name FROM chat_participants p JOIN students s ON p.student_id = s.id LEFT JOIN `groups` g ON s.group_id = g.id WHERE p.conversation_id = ? ORDER BY s.name");
        $stmt->execute([$conversationId]);
        $group['participants'] = $stmt->fetchAll();
        $group['is_creator'] = ($group['created_by'] == $studentId);

        respond(['success' => true, 'data' => $group]);
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetFounderChatProfile($pdo) {
    $founderId = (int)($_GET['founder_id'] ?? 0);
    if (!$founderId) respond(['success' => false, 'error' => 'ID не указан']);

    $stmt = $pdo->prepare("SELECT id, login as name, role FROM users WHERE id = ? AND role = 'founder'");
    $stmt->execute([$founderId]);
    $founder = $stmt->fetch();

    if ($founder) {
        $founder['chat_id'] = -$founder['id'];
        $founder['display_name'] = $founder['name'] . ' (Основатель)';
        respond(['success' => true, 'data' => $founder]);
    } else {
        respond(['success' => false, 'error' => 'Основатель не найден']);
    }
}

function handleGetMessengerUpdates($pdo) {
    $userId = (int)($_GET['user_id'] ?? 0);
    $userType = $_GET['user_type'] ?? 'student';
    $lastUpdateId = (int)($_GET['last_update_id'] ?? 0);
    $timeout = 10;
    $startTime = time();

    if (!$userId) respond(['success' => false, 'error' => 'ID пользователя не указан']);

    $participantId = ($userType === 'admin' && $userId > 0) ? -$userId : $userId;

    while (time() - $startTime < $timeout) {
        $stmt = $pdo->prepare("SELECT * FROM messenger_updates WHERE user_id = ? AND id > ? ORDER BY id ASC");
        $stmt->execute([$participantId, $lastUpdateId]);
        $updates = $stmt->fetchAll();

        if (!empty($updates)) {
            $pdo->exec("DELETE FROM messenger_updates WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 MINUTE)");
            respond([
                'success' => true,
                'data' => $updates,
                'last_update_id' => end($updates)['id']
            ]);
        }
        usleep(200000);
    }
    respond(['success' => true, 'data' => [], 'last_update_id' => $lastUpdateId]);
}