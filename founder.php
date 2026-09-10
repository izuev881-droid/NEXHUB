<?php
// api/founder.php

function handleGetFounderStudent($pdo) {
    $fid = (int)($_GET['founder_id'] ?? 0);

    try {
        $stmt = $pdo->prepare("SELECT s.*, g.name as group_name FROM students s LEFT JOIN `groups` g ON s.group_id = g.id WHERE s.id < 0 AND s.id = -?");
        $stmt->execute([$fid]);
        $student = $stmt->fetch();

        if ($student) {
            respond(['success' => true, 'data' => $student]);
        } else {
            respond(['success' => true, 'data' => [
                'id' => -$fid,
                'name' => 'Основатель',
                'group_name' => '👑 Основатель',
                'balance' => 0,
                'total_earned' => 0,
                'infinite_balance' => 1,
                'attended' => 0
            ]]);
        }
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleUpdateFounderName($pdo, $input) {
    $fid = (int)($input['founder_id'] ?? 0);
    $name = trim($input['name'] ?? '');

    if (!$fid || empty($name)) respond(['success'=>false,'error'=>'Недостаточно данных']);

    try {
        $pdo->prepare("UPDATE users SET login = ? WHERE id = ? AND role = 'founder'")->execute([$name, $fid]);
        $pdo->prepare("UPDATE students SET name = ? WHERE id = -?")->execute([$name, $fid]);
        logAdminAction($pdo, $fid, $name, 'Обновление имени основателя', "Новое имя: $name");
        respond(['success'=>true,'data'=>['name'=>$name]]);
    } catch (Exception $e) {
        respond(['success'=>false,'error'=>$e->getMessage()]);
    }
}

function handleUpdateFounderBalance($pdo, $input) {
    $fid = (int)($input['founder_id'] ?? 0);
    $amt = (int)($input['amount'] ?? 0);
    $op = $input['operation'] ?? 'set';

    if (!$fid) respond(['success'=>false,'error'=>'ID основателя не указан']);

    logAdminAction($pdo, $fid, $input['founder_login'] ?? '', 'Попытка изменения баланса основателя', "Операция: $op, Сумма: $amt (основатель имеет бесконечный баланс)");
    respond(['success'=>true,'data'=>['updated'=>true]]);
}

function handleUpdateFounderExperience($pdo, $input) {
    $fid = (int)($input['founder_id'] ?? 0);
    $amt = (int)($input['amount'] ?? 0);
    $op = $input['operation'] ?? 'set';

    if (!$fid) respond(['success'=>false,'error'=>'ID основателя не указан']);

    $stmt = $pdo->prepare("SELECT total_earned FROM students WHERE id = -?");
    $stmt->execute([$fid]);
    $currentExp = $stmt->fetchColumn();

    if ($currentExp === false) {
        $stmt = $pdo->prepare("SELECT login FROM users WHERE id = ?");
        $stmt->execute([$fid]);
        $founderLogin = $stmt->fetchColumn();
        $pdo->prepare("INSERT INTO students (id, name, group_id, balance, total_earned, infinite_balance) VALUES (?, ?, 0, 0, 0, 1)")
            ->execute([-$fid, $founderLogin ?: 'Основатель']);
        $currentExp = 0;
    }

    if ($op === 'add') {
        $pdo->prepare("UPDATE students SET total_earned = total_earned + ? WHERE id = -?")->execute([$amt, $fid]);
        logAdminAction($pdo, $fid, $input['founder_login'] ?? '', 'Начисление опыта основателю', "Добавлено: +$amt, Новый опыт: " . ($currentExp + $amt));
    } else {
        $pdo->prepare("UPDATE students SET total_earned = ? WHERE id = -?")->execute([$amt, $fid]);
        logAdminAction($pdo, $fid, $input['founder_login'] ?? '', 'Установка опыта основателю', "Установлено: $amt");
    }

    respond(['success'=>true,'data'=>['updated'=>true]]);
}

function handleImpersonateStudent($pdo, $input) {
    $founderId = (int)($input['founder_id'] ?? 0);
    $studentId = (int)($input['student_id'] ?? 0);

    if (!$founderId || !$studentId) respond(['success' => false, 'error' => 'Недостаточно данных']);

    $stmt = $pdo->prepare("SELECT role, login FROM users WHERE id = ?");
    $stmt->execute([$founderId]);
    $founder = $stmt->fetch();

    if (!$founder || $founder['role'] !== 'founder') {
        respond(['success' => false, 'error' => 'Доступ запрещен']);
    }

    $stmt = $pdo->prepare("SELECT s.*, g.name as group_name, u.login, u.id as user_id FROM students s LEFT JOIN `groups` g ON s.group_id = g.id LEFT JOIN users u ON u.student_id = s.id WHERE s.id = ?");
    $stmt->execute([$studentId]);
    $student = $stmt->fetch();

    if (!$student) respond(['success' => false, 'error' => 'Студент не найден']);

    logAdminAction($pdo, $founderId, $founder['login'], 'Вход в аккаунт студента', "Студент: {$student['name']} (ID: $studentId)");
    respond(['success' => true, 'data' => $student]);
}