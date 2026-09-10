<?php
// api/uploads.php — загрузка файлов и изображений

function handleImageUpload($pdo) {
    $uploadDir = UPLOAD_DIR_SHOP;
    $itemId = (int)($_POST['item_id'] ?? 0);
    $userId = (int)($_POST['user_id'] ?? 0);
    $userLogin = trim($_POST['user_login'] ?? '');

    if (!$itemId) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'ID товара не указан']); return; }
    if (!isset($_FILES['item_image']) || $_FILES['item_image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400); echo json_encode(['success'=>false,'error'=>'Ошибка загрузки файла']); return;
    }

    $file = $_FILES['item_image'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, ['image/jpeg','image/png','image/gif','image/webp'])) {
        http_response_code(400); echo json_encode(['success'=>false,'error'=>'Разрешены только JPEG, PNG, GIF, WEBP']); return;
    }
    if ($file['size'] > 5*1024*1024) {
        http_response_code(400); echo json_encode(['success'=>false,'error'=>'Файл слишком большой (макс 5MB)']); return;
    }

    $stmt = $pdo->prepare("SELECT id, image_url FROM shop_items WHERE id=?");
    $stmt->execute([$itemId]);
    $item = $stmt->fetch();
    if (!$item) { http_response_code(404); echo json_encode(['success'=>false,'error'=>'Товар не найден']); return; }

    if (!empty($item['image_url'])) {
        $old = __DIR__ . '/../' . ltrim($item['image_url'], '/');
        if (file_exists($old)) @unlink($old);
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (empty($ext)) $ext = 'jpg';
    $filename = 'item_' . $itemId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $filepath = $uploadDir . $filename;
    $relPath = 'uploads/shop/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        http_response_code(500); echo json_encode(['success'=>false,'error'=>'Не удалось сохранить файл']); return;
    }

    $pdo->prepare("UPDATE shop_items SET image_url=? WHERE id=?")->execute([$relPath, $itemId]);
    if ($userId > 0) logAdminAction($pdo, $userId, $userLogin, 'Загрузка изображения', "Товар ID: $itemId");
    echo json_encode(['success'=>true, 'data'=>['image_url'=>$relPath, 'item_id'=>$itemId]]);
}

function handleTitleImageUpload($pdo) {
    http_response_code(400);
    echo json_encode(['success'=>false,'error'=>'Загрузка изображений для титулов отключена. Используйте эмодзи.']);
    exit();
}

function handleChatImageUpload($pdo) {
    $chatUploadDir = UPLOAD_DIR_CHAT;
    $conversationId = (int)($_POST['conversation_id'] ?? 0);
    $studentId = (int)($_POST['student_id'] ?? 0);
    $studentName = trim($_POST['student_name'] ?? '');

    if (!$conversationId || !$studentId) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID чата или студента не указан']); return;
    }
    if (!isset($_FILES['chat_image']) || $_FILES['chat_image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Ошибка загрузки файла']); return;
    }

    $file = $_FILES['chat_image'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'])) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Разрешены только JPEG, PNG, GIF, WEBP']); return;
    }
    if ($file['size'] > 20 * 1024 * 1024) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Файл слишком большой (макс 20MB)']); return;
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (empty($ext)) $ext = 'jpg';
    $filename = 'chat_' . $conversationId . '_' . time() . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $filepath = $chatUploadDir . $filename;
    $relPath = 'uploads/chat/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        http_response_code(500); echo json_encode(['success' => false, 'error' => 'Не удалось сохранить файл']); return;
    }

    $imageTag = '[IMAGE:' . $relPath . ']';
    $stmt = $pdo->prepare("INSERT INTO chat_messages (conversation_id, student_id, student_name, text, file_url, file_name, file_size, file_type, is_forwarded) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)");
    $stmt->execute([$conversationId, $studentId, $studentName, $imageTag, $relPath, $file['name'], $file['size'], $ext]);

    echo json_encode([
        'success' => true,
        'data' => [
            'message_id' => $pdo->lastInsertId(),
            'image_url' => '/' . $relPath,
            'image_path' => $relPath
        ]
    ]);
    exit();
}

function handleCommonChatImageUpload($pdo) {
    $commonChatUploadDir = UPLOAD_DIR_COMMON_CHAT;
    $authorId = trim($_POST['author_id'] ?? '');
    $authorName = trim($_POST['author_name'] ?? '');
    $authorGroup = trim($_POST['author_group'] ?? '');

    if (!$authorId || !$authorName) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Данные автора не указаны']); return;
    }
    if (!isset($_FILES['common_chat_image']) || $_FILES['common_chat_image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Ошибка загрузки файла']); return;
    }

    $file = $_FILES['common_chat_image'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'])) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Разрешены только JPEG, PNG, GIF, WEBP']); return;
    }
    if ($file['size'] > 20 * 1024 * 1024) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Файл слишком большой (макс 20MB)']); return;
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (empty($ext)) $ext = 'jpg';
    $filename = 'common_' . time() . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $filepath = $commonChatUploadDir . $filename;
    $relPath = 'uploads/common_chat/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        http_response_code(500); echo json_encode(['success' => false, 'error' => 'Не удалось сохранить файл']); return;
    }

    $imageTag = '[IMAGE:' . $relPath . ']';
    $mid = 'msg_' . time() . '_' . rand(1000, 9999);
    $stmt = $pdo->prepare("INSERT INTO common_chat (message_id, author_id, author_name, author_group, text, file_url, file_name, file_size, file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$mid, $authorId, $authorName, $authorGroup, $imageTag, $relPath, $file['name'], $file['size'], $ext]);

    echo json_encode([
        'success' => true,
        'data' => [
            'message_id' => $pdo->lastInsertId(),
            'image_url' => '/' . $relPath,
            'image_path' => $relPath
        ]
    ]);
    exit();
}

function handleChatFileUpload($pdo) {
    $filesUploadDir = UPLOAD_DIR_FILES;
    $conversationId = (int)($_POST['conversation_id'] ?? 0);
    $studentId = (int)($_POST['student_id'] ?? 0);
    $studentName = trim($_POST['student_name'] ?? '');

    if (!$conversationId || !$studentId) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID чата или студента не указан']); return;
    }
    if (!isset($_FILES['chat_file']) || $_FILES['chat_file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Ошибка загрузки файла']); return;
    }

    $file = $_FILES['chat_file'];
    if ($file['size'] > 20 * 1024 * 1024) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Файл слишком большой (макс 20MB)']); return;
    }

    $originalName = basename($file['name']);
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $filename = 'file_' . time() . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $filepath = $filesUploadDir . $filename;
    $relPath = 'uploads/files/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        http_response_code(500); echo json_encode(['success' => false, 'error' => 'Не удалось сохранить файл']); return;
    }

    $fileTag = '[FILE:' . $relPath . '|' . $originalName . '|' . $file['size'] . ']';
    $stmt = $pdo->prepare("INSERT INTO chat_messages (conversation_id, student_id, student_name, text, file_url, file_name, file_size, file_type, is_forwarded) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)");
    $stmt->execute([$conversationId, $studentId, $studentName, $fileTag, $relPath, $originalName, $file['size'], $ext]);

    echo json_encode([
        'success' => true,
        'data' => [
            'message_id' => $pdo->lastInsertId(),
            'file_url' => '/' . $relPath,
            'file_name' => $originalName,
            'file_size' => formatFileSize($file['size']),
            'file_icon' => getFileIcon($originalName)
        ]
    ]);
    exit();
}

function handleCommonChatFileUpload($pdo) {
    $filesUploadDir = UPLOAD_DIR_FILES;
    $authorId = trim($_POST['author_id'] ?? '');
    $authorName = trim($_POST['author_name'] ?? '');
    $authorGroup = trim($_POST['author_group'] ?? '');

    if (!$authorId || !$authorName) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Данные автора не указаны']); return;
    }
    if (!isset($_FILES['common_chat_file']) || $_FILES['common_chat_file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Ошибка загрузки файла']); return;
    }

    $file = $_FILES['common_chat_file'];
    if ($file['size'] > 20 * 1024 * 1024) {
        http_response_code(400); echo json_encode(['success' => false, 'error' => 'Файл слишком большой (макс 20MB)']); return;
    }

    $originalName = basename($file['name']);
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $filename = 'common_' . time() . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $filepath = $filesUploadDir . $filename;
    $relPath = 'uploads/files/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        http_response_code(500); echo json_encode(['success' => false, 'error' => 'Не удалось сохранить файл']); return;
    }

    $fileTag = '[FILE:' . $relPath . '|' . $originalName . '|' . $file['size'] . ']';
    $mid = 'msg_' . time() . '_' . rand(1000, 9999);
    $stmt = $pdo->prepare("INSERT INTO common_chat (message_id, author_id, author_name, author_group, text, file_url, file_name, file_size, file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$mid, $authorId, $authorName, $authorGroup, $fileTag, $relPath, $originalName, $file['size'], $ext]);

    echo json_encode([
        'success' => true,
        'data' => [
            'message_id' => $pdo->lastInsertId(),
            'file_url' => '/' . $relPath,
            'file_name' => $originalName,
            'file_size' => formatFileSize($file['size']),
            'file_icon' => getFileIcon($originalName)
        ]
    ]);
    exit();
}

function handleForwardMessage($pdo, $input) {
    $originalMessageId = (int)($input['original_message_id'] ?? 0);
    $targetConversationId = (int)($input['target_conversation_id'] ?? 0);
    $studentId = (int)($input['student_id'] ?? 0);
    $studentName = trim($input['student_name'] ?? '');

    if (!$originalMessageId || !$targetConversationId || !$studentId) {
        return ['success' => false, 'error' => 'Недостаточно данных'];
    }

    $stmt = $pdo->prepare("SELECT id, student_id, student_name, text, file_url, file_name, file_size, file_type, created_at FROM chat_messages WHERE id = ? AND is_deleted = 0");
    $stmt->execute([$originalMessageId]);
    $original = $stmt->fetch();
    if (!$original) return ['success' => false, 'error' => 'Сообщение не найдено'];

    $stmt = $pdo->prepare("SELECT 1 FROM chat_participants WHERE conversation_id = ? AND student_id = ?");
    $stmt->execute([$targetConversationId, $studentId]);
    if (!$stmt->fetch()) return ['success' => false, 'error' => 'Нет доступа к чату'];

    $stmt = $pdo->prepare("INSERT INTO chat_messages 
        (conversation_id, student_id, student_name, text, file_url, file_name, file_size, file_type, is_forwarded, original_author, original_author_id, original_message_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)");
    $stmt->execute([
        $targetConversationId,
        $studentId,
        $studentName,
        $original['text'],
        $original['file_url'],
        $original['file_name'],
        $original['file_size'],
        $original['file_type'],
        $original['student_name'],
        $original['student_id'],
        $originalMessageId
    ]);

    return ['success' => true, 'data' => ['message_id' => $pdo->lastInsertId()]];
}