<?php
// api/titles.php

function handleGetTitles($pdo) {
    $stmt = $pdo->query("SELECT * FROM titles ORDER BY price ASC");
    $titles = $stmt->fetchAll();
    foreach ($titles as &$title) {
        if (empty($title['text_color'])) $title['text_color'] = '#ffffff';
    }
    respond(['success'=>true,'data'=>$titles]);
}

function handleGetStudentTitles($pdo) {
    $sid = (int)($_GET['student_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT t.*, ut.acquired_at FROM titles t JOIN user_titles ut ON t.id=ut.title_id WHERE ut.student_id=? ORDER BY FIELD(t.rarity, 'divine','unique','mythical','legendary','epic','rare','common'), t.price DESC");
    $stmt->execute([$sid]);
    $owned = $stmt->fetchAll();

    $stmt = $pdo->prepare("SELECT title_id FROM active_titles WHERE student_id=?");
    $stmt->execute([$sid]);
    $active = $stmt->fetch();

    respond(['success'=>true,'data'=>['owned'=>$owned, 'active_title_id'=>$active ? $active['title_id'] : null]]);
}

function handleGetActiveTitle($pdo) {
    $sid = (int)($_GET['student_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT t.* FROM titles t JOIN active_titles at ON t.id=at.title_id WHERE at.student_id=?");
    $stmt->execute([$sid]);
    $title = $stmt->fetch();
    if ($title && empty($title['text_color'])) $title['text_color'] = '#ffffff';
    respond(['success'=>true,'data'=>$title]);
}

function handleGetUserTitleForChat($pdo) {
    $sid = (int)($_GET['student_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT t.* FROM titles t JOIN active_titles at ON t.id=at.title_id WHERE at.student_id=?");
    $stmt->execute([$sid]);
    $title = $stmt->fetch();
    if ($title && empty($title['text_color'])) $title['text_color'] = '#ffffff';
    respond(['success'=>true,'data'=>$title]);
}

function handleBuyTitle($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $tid = (int)($input['title_id'] ?? 0);

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("SELECT * FROM titles WHERE id = ? AND purchasable = 1");
        $stmt->execute([$tid]);
        $title = $stmt->fetch();
        if (!$title) throw new Exception('Титул не найден или недоступен для покупки');

        $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM user_titles WHERE student_id = ? AND title_id = ?");
        $stmt->execute([$sid, $tid]);
        if ($stmt->fetch()['cnt'] > 0) throw new Exception('У вас уже есть этот титул');

        $stmt = $pdo->prepare("SELECT balance, infinite_balance FROM students WHERE id = ? FOR UPDATE");
        $stmt->execute([$sid]);
        $student = $stmt->fetch();

        if (!$student) {
            $stmt = $pdo->prepare("SELECT student_id FROM users WHERE id = ?");
            $stmt->execute([$sid]);
            $userStudentId = $stmt->fetchColumn();
            if ($userStudentId) {
                $stmt = $pdo->prepare("SELECT balance, infinite_balance FROM students WHERE id = ? FOR UPDATE");
                $stmt->execute([$userStudentId]);
                $student = $stmt->fetch();
                $sid = $userStudentId;
            }
        }
        if (!$student) throw new Exception('Студент не найден');

        $hasEnoughBalance = $student['infinite_balance'] || $student['balance'] >= $title['price'];
        if (!$hasEnoughBalance) throw new Exception('Недостаточно средств для покупки титула');

        if (!$student['infinite_balance']) {
            $pdo->prepare("UPDATE students SET balance = balance - ? WHERE id = ?")->execute([$title['price'], $sid]);
        }
        $pdo->prepare("INSERT INTO user_titles (student_id, title_id) VALUES (?, ?)")->execute([$sid, $tid]);
        $pdo->prepare("INSERT INTO history (student_id, action, details, time, created_at) VALUES (?, 'Покупка', ?, CURTIME(), NOW())")
            ->execute([$sid, "Купил(а) титул «{$title['name']}» за {$title['price']} 💎"]);

        addNotification($pdo, $sid, 'title', 'Титул куплен', "Вы приобрели титул «{$title['name']}» за {$title['price']}💎", 'medal', '#ab00ea');

        $pdo->commit();
        respond(['success' => true, 'data' => ['bought' => true, 'title' => $title]]);
    } catch (Exception $e) {
        $pdo->rollBack();
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleActivateTitle($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $tid = (int)($input['title_id'] ?? 0);

    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM user_titles WHERE student_id=? AND title_id=?");
    $stmt->execute([$sid, $tid]);
    if ($stmt->fetch()['cnt'] == 0) {
        respond(['success'=>false,'error'=>'Нет титула']);
    }

    $pdo->prepare("INSERT INTO active_titles (student_id, title_id) VALUES (?,?) ON DUPLICATE KEY UPDATE title_id=?")
        ->execute([$sid, $tid, $tid]);

    respond(['success'=>true,'data'=>['activated'=>true]]);
}

function handleDeactivateTitle($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $pdo->prepare("DELETE FROM active_titles WHERE student_id=?")->execute([$sid]);
    respond(['success'=>true,'data'=>['deactivated'=>true]]);
}

function handleCreateTitle($pdo, $input) {
    $name = trim($input['name'] ?? '');
    $desc = trim($input['description'] ?? '');
    $rar = $input['rarity'] ?? 'common';
    $col = $input['color'] ?? '#ab00ea';
    $textColor = $input['text_color'] ?? '#ffffff';
    $price = (int)($input['price'] ?? 0);
    $icon = $input['icon'] ?? '⭐';
    $uid = (int)($input['user_id'] ?? 0);
    $ulogin = $input['user_login'] ?? '';

    if (empty($name)) respond(['success'=>false,'error'=>'Введите название']);

    $pdo->prepare("INSERT INTO titles (name, description, rarity, color, text_color, price, icon, purchasable) VALUES (?,?,?,?,?,?,?,1)")
        ->execute([$name, $desc, $rar, $col, $textColor, $price, $icon]);

    logAdminAction($pdo, $uid, $ulogin, 'Создание титула', "Название: $name");
    respond(['success'=>true,'data'=>['id'=>$pdo->lastInsertId()]]);
}

function handleUpdateTitle($pdo, $input) {
    $tid = (int)($input['title_id'] ?? 0);
    $name = trim($input['name'] ?? '');
    $desc = trim($input['description'] ?? '');
    $rarity = $input['rarity'] ?? 'common';
    $color = $input['color'] ?? '#ab00ea';
    $textColor = $input['text_color'] ?? '#ffffff';
    $price = (int)($input['price'] ?? 0);
    $icon = $input['icon'] ?? '⭐';
    $purchasable = isset($input['purchasable']) ? (int)$input['purchasable'] : 1;
    $uid = (int)($input['user_id'] ?? 0);
    $ulogin = $input['user_login'] ?? '';

    if (empty($name)) respond(['success'=>false,'error'=>'Введите название']);

    $stmt = $pdo->prepare("UPDATE titles SET name=?, description=?, rarity=?, color=?, text_color=?, price=?, icon=?, purchasable=? WHERE id=?");
    $stmt->execute([$name, $desc, $rarity, $color, $textColor, $price, $icon, $purchasable, $tid]);

    logAdminAction($pdo, $uid, $ulogin, 'Редактирование титула', "ID: $tid, Название: $name");
    respond(['success'=>true,'data'=>['updated'=>true]]);
}

function handleDeleteTitle($pdo, $input) {
    $tid = (int)($input['title_id'] ?? 0);
    $uid = (int)($input['user_id'] ?? 0);
    $ulogin = $input['user_login'] ?? '';

    $stmt = $pdo->prepare("SELECT name FROM titles WHERE id = ?");
    $stmt->execute([$tid]);
    $titleName = $stmt->fetchColumn();

    $pdo->prepare("DELETE FROM user_titles WHERE title_id=?")->execute([$tid]);
    $pdo->prepare("DELETE FROM active_titles WHERE title_id=?")->execute([$tid]);
    $pdo->prepare("DELETE FROM titles WHERE id=?")->execute([$tid]);

    logAdminAction($pdo, $uid, $ulogin, 'Удаление титула', "ID: $tid, Название: $titleName");
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}

function handleToggleTitlePurchasable($pdo, $input) {
    $tid = (int)($input['title_id'] ?? 0);
    $uid = (int)($input['user_id'] ?? 0);
    $ulogin = $input['user_login'] ?? '';

    $pdo->prepare("UPDATE titles SET purchasable = NOT purchasable WHERE id=?")->execute([$tid]);
    logAdminAction($pdo, $uid, $ulogin, 'Изменение доступности титула', "ID: $tid");
    respond(['success'=>true,'data'=>['toggled'=>true]]);
}

function handleGiveTitle($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $tid = (int)($input['title_id'] ?? 0);
    $uid = (int)($input['user_id'] ?? 0);
    $ulogin = $input['user_login'] ?? '';

    $stmt = $pdo->prepare("SELECT name FROM students WHERE id=?");
    $stmt->execute([$sid]);
    $studentName = $stmt->fetchColumn();

    $stmt = $pdo->prepare("SELECT name FROM titles WHERE id=?");
    $stmt->execute([$tid]);
    $titleName = $stmt->fetchColumn();

    $pdo->prepare("INSERT IGNORE INTO user_titles (student_id, title_id) VALUES (?,?)")->execute([$sid, $tid]);
    logAdminAction($pdo, $uid, $ulogin, 'Выдача титула', "Студент: $studentName, Титул: $titleName");
    addNotification($pdo, $sid, 'title', 'Новый титул', "Вам выдан титул «{$titleName}»", 'medal', '#10b981');

    respond(['success'=>true,'data'=>['given'=>true]]);
}

function handleRemoveTitle($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $tid = (int)($input['title_id'] ?? 0);
    $uid = (int)($input['user_id'] ?? 0);
    $ulogin = $input['user_login'] ?? '';

    $stmt = $pdo->prepare("SELECT name FROM students WHERE id=?");
    $stmt->execute([$sid]);
    $studentName = $stmt->fetchColumn();

    $stmt = $pdo->prepare("SELECT name FROM titles WHERE id=?");
    $stmt->execute([$tid]);
    $titleName = $stmt->fetchColumn();

    $pdo->prepare("DELETE FROM user_titles WHERE student_id=? AND title_id=?")->execute([$sid, $tid]);
    $pdo->prepare("DELETE FROM active_titles WHERE student_id=? AND title_id=?")->execute([$sid, $tid]);

    logAdminAction($pdo, $uid, $ulogin, 'Удаление титула у студента', "Студент: $studentName, Титул: $titleName");
    respond(['success'=>true,'data'=>['removed'=>true]]);
}

function handleNotifyTitleChange($pdo, $input) {
    $studentId = (int)($input['student_id'] ?? 0);
    if (!$studentId) respond(['success'=>false,'error'=>'ID студента не указан']);

    $stmt = $pdo->prepare("SELECT t.* FROM titles t JOIN active_titles at ON t.id=at.title_id WHERE at.student_id=?");
    $stmt->execute([$studentId]);
    $newTitle = $stmt->fetch();

    $titleId = $newTitle ? $newTitle['id'] : null;
    $pdo->prepare("INSERT INTO title_updates (student_id, title_id) VALUES (?, ?)")->execute([$studentId, $titleId]);

    respond(['success'=>true,'data'=>['title'=>$newTitle]]);
}

function handleGetTitleUpdates($pdo) {
    $lastUpdateId = (int)($_GET['last_id'] ?? 0);
    $timeout = 20;
    $startTime = time();

    while (time() - $startTime < $timeout) {
        $stmt = $pdo->prepare("SELECT * FROM title_updates WHERE id > ? ORDER BY id ASC");
        $stmt->execute([$lastUpdateId]);
        $updates = $stmt->fetchAll();

        if (!empty($updates)) {
            $result = [];
            foreach ($updates as $update) {
                $stmt = $pdo->prepare("SELECT t.* FROM titles t WHERE t.id = ?");
                $stmt->execute([$update['title_id']]);
                $title = $stmt->fetch();

                $stmt = $pdo->prepare("SELECT s.name, g.name as group_name FROM students s LEFT JOIN `groups` g ON s.group_id=g.id WHERE s.id=?");
                $stmt->execute([$update['student_id']]);
                $student = $stmt->fetch();

                $result[] = [
                    'id' => $update['id'],
                    'student_id' => $update['student_id'],
                    'student_name' => $student['name'] ?? '',
                    'student_group' => $student['group_name'] ?? '',
                    'title' => $title
                ];
            }
            respond(['success'=>true,'data'=>$result]);
        }
        usleep(200000);
    }
    respond(['success'=>true,'data'=>[]]);
}