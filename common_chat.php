<?php
// api/common_chat.php

function handleGetCommonMessages($pdo) {
    $stmt = $pdo->query("SELECT * FROM common_chat WHERE is_deleted=0 ORDER BY created_at ASC LIMIT 200");
    $messages = $stmt->fetchAll();

    foreach ($messages as &$msg) {
        if ($msg['author_id'] !== 'admin' && is_numeric($msg['author_id'])) {
            $stmt2 = $pdo->prepare("SELECT t.* FROM titles t JOIN active_titles at ON t.id=at.title_id WHERE at.student_id=?");
            $stmt2->execute([$msg['author_id']]);
            $title = $stmt2->fetch();
            if ($title) $msg['title'] = $title;
        }
    }
    respond(['success'=>true,'data'=>$messages]);
}

function handleSendCommonMessage($pdo, $input) {
    $mid = 'msg_' . time() . '_' . rand(1000, 9999);
    $pdo->prepare("INSERT INTO common_chat (message_id, author_id, author_name, author_group, text) VALUES (?,?,?,?,?)")
        ->execute([$mid, $input['author_id']??'', $input['author_name']??'', $input['author_group']??'', $input['text']??'']);
    respond(['success'=>true,'data'=>['messageId'=>$mid]]);
}

function handleDeleteCommonMessage($pdo, $input) {
    $messageId = $input['message_id'] ?? '';
    $userId = $input['user_id'] ?? 0;
    $userLogin = $input['user_login'] ?? '';
    $isAdmin = $input['is_admin'] ?? 0;

    $stmt = $pdo->prepare("SELECT author_id, author_name FROM common_chat WHERE message_id = ?");
    $stmt->execute([$messageId]);
    $message = $stmt->fetch();

    if (!$message) respond(['success' => false, 'error' => 'Сообщение не найдено']);

    $authorId = $message['author_id'];
    if (!$isAdmin && $authorId != $userId) {
        respond(['success' => false, 'error' => 'Можно удалять только свои сообщения']);
    }

    $pdo->prepare("UPDATE common_chat SET is_deleted=1, text='[Сообщение удалено]' WHERE message_id=?")->execute([$messageId]);
    logAdminAction($pdo, $userId, $userLogin, 'Удаление сообщения в общем чате', "ID сообщения: $messageId, Автор: {$message['author_name']}");
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}

function handleClearCommonChat($pdo, $input) {
    $pdo->query("DELETE FROM common_chat");
    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Очистка общего чата', '');
    respond(['success'=>true,'data'=>['cleared'=>true]]);
}

function handleGetNewMessages($pdo) {
    $lastId = (int)($_GET['last_id'] ?? 0);
    $timeout = 10;
    $startTime = time();

    while (time() - $startTime < $timeout) {
        $stmt = $pdo->prepare("SELECT * FROM common_chat WHERE is_deleted=0 AND id > ? ORDER BY created_at ASC");
        $stmt->execute([$lastId]);
        $newMessages = $stmt->fetchAll();

        if (!empty($newMessages)) {
            $authorIds = array_unique(array_filter(array_column($newMessages, 'author_id'), function($id) {
                return $id !== 'admin';
            }));
            $titles = [];
            foreach ($authorIds as $aid) {
                $stmt = $pdo->prepare("SELECT t.* FROM titles t JOIN active_titles at ON t.id=at.title_id WHERE at.student_id=?");
                $stmt->execute([$aid]);
                $title = $stmt->fetch();
                if ($title) $titles[$aid] = $title;
            }
            foreach ($newMessages as &$msg) {
                if ($msg['author_id'] !== 'admin' && isset($titles[$msg['author_id']])) {
                    $msg['title'] = $titles[$msg['author_id']];
                }
            }
            respond(['success'=>true,'data'=>$newMessages]);
        }
        usleep(200000);
    }
    respond(['success'=>true,'data'=>[]]);
}