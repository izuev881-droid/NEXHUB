<?php
// api/students.php

function handleGetStudents($pdo) {
    $stmt = $pdo->query("SELECT s.*, g.name as group_name, u.login, u.role as user_role FROM students s LEFT JOIN `groups` g ON s.group_id=g.id LEFT JOIN users u ON u.student_id=s.id WHERE s.id > 0 ORDER BY s.id DESC");
    $students = $stmt->fetchAll();

    $stmt = $pdo->prepare("SELECT s.*, 'founder' as user_role, '👑 Основатель' as group_name, u.login FROM students s JOIN users u ON u.student_id = s.id WHERE u.role = 'founder'");
    $stmt->execute();
    $founderStudent = $stmt->fetch();

    if ($founderStudent && $founderStudent['id'] < 0) {
        $founderAsStudent = [
            'id' => $founderStudent['id'],
            'name' => $founderStudent['name'],
            'group_id' => 0,
            'group_name' => '👑 Основатель',
            'balance' => $founderStudent['balance'] ?? 0,
            'total_earned' => $founderStudent['total_earned'] ?? 0,
            'infinite_balance' => 1,
            'login' => $founderStudent['login'],
            'user_role' => 'founder',
            'is_founder' => true
        ];
        array_unshift($students, $founderAsStudent);
    }
    respond(['success'=>true,'data'=>$students]);
}

function handleGetStudent($pdo) {
    $stmt = $pdo->prepare("SELECT s.*, g.name as group_name FROM students s LEFT JOIN `groups` g ON s.group_id=g.id WHERE s.id=?");
    $stmt->execute([(int)($_GET['student_id'] ?? 0)]);
    respond(['success'=>true,'data'=>$stmt->fetch()]);
}

function handleAddStudent($pdo, $input) {
    $name = trim($input['name'] ?? '');
    $login = trim($input['login'] ?? '');
    $pass = $input['password'] ?? '';
    $gid = (int)($input['group_id'] ?? 1);

    if (empty($name) || empty($login) || empty($pass)) {
        respond(['success'=>false,'error'=>'Заполните все поля']);
    }

    $pdo->beginTransaction();
    $pdo->prepare("INSERT INTO students (name, group_id, balance, total_earned) VALUES (?,?,0,0)")->execute([$name, $gid]);
    $sid = $pdo->lastInsertId();
    $pdo->prepare("INSERT INTO users (login, password, role, student_id) VALUES (?,?,'student',?)")->execute([$login, md5($pass), $sid]);
    savePlainPassword($pdo, $pdo->lastInsertId(), $pass);
    $pdo->commit();

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Добавление студента', "Студент: $name, Логин: $login");
    respond(['success'=>true,'data'=>['id'=>$sid]]);
}

function handleDeleteStudent($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $currentUserId = (int)($input['user_id'] ?? 0);
    $currentUserLogin = $input['user_login'] ?? '';

    if ($sid < 0) respond(['success'=>false, 'error'=>'Нельзя удалить основателя']);

    $stmt = $pdo->prepare("SELECT u.role FROM users u JOIN students s ON u.student_id = s.id WHERE s.id = ?");
    $stmt->execute([$sid]);
    $user = $stmt->fetch();
    if ($user && $user['role'] === 'founder') respond(['success'=>false, 'error'=>'Нельзя удалить основателя']);

    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$currentUserId]);
    $currentUserRole = $stmt->fetchColumn();
    if ($currentUserRole !== 'founder' && $currentUserRole !== 'admin') {
        respond(['success'=>false, 'error'=>'Недостаточно прав']);
    }

    $stmt = $pdo->prepare("SELECT name FROM students WHERE id=?");
    $stmt->execute([$sid]);
    $studentName = $stmt->fetchColumn();

    $pdo->prepare("DELETE FROM users WHERE student_id=?")->execute([$sid]);
    $pdo->prepare("DELETE FROM students WHERE id=?")->execute([$sid]);

    logAdminAction($pdo, $currentUserId, $currentUserLogin, 'Удаление студента', "Студент ID: $sid, Имя: $studentName");
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}

function handleUpdateBalance($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $amt = (int)($input['amount'] ?? 0);
    $op = $input['operation'] ?? 'add';

    $stmt = $pdo->prepare("SELECT name FROM students WHERE id=?");
    $stmt->execute([$sid]);
    $studentName = $stmt->fetchColumn();

    if ($op === 'add') {
        $pdo->prepare("UPDATE students SET balance=balance+? WHERE id=?")->execute([$amt, $sid]);
        logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Изменение баланса', "Студент: $studentName, Добавлено: +$amt");
        addNotification($pdo, $sid, 'balance', 'Изменение баланса', "Ваш баланс был изменен администратором. +{$amt}💎", 'coins', '#f59e0b');
    } else {
        $pdo->prepare("UPDATE students SET balance=? WHERE id=?")->execute([$amt, $sid]);
        logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Изменение баланса', "Студент: $studentName, Установлено: $amt");
        addNotification($pdo, $sid, 'balance', 'Изменение баланса', "Ваш баланс был изменен администратором. Новый баланс: {$amt}💎", 'coins', '#f59e0b');
    }
    respond(['success'=>true,'data'=>['updated'=>true]]);
}

function handleUpdateExperience($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $amt = (int)($input['amount'] ?? 0);
    $op = $input['operation'] ?? 'add';

    $stmt = $pdo->prepare("SELECT name FROM students WHERE id=?");
    $stmt->execute([$sid]);
    $studentName = $stmt->fetchColumn();

    if ($op === 'add') {
        $pdo->prepare("UPDATE students SET total_earned=total_earned+? WHERE id=?")->execute([$amt, $sid]);
        logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Изменение опыта', "Студент: $studentName, Добавлено: +$amt");
        addNotification($pdo, $sid, 'exp', 'Изменение опыта', "Ваш опыт был изменен администратором. +{$amt}⭐", 'star', '#fbbf24');
    } else {
        $pdo->prepare("UPDATE students SET total_earned=? WHERE id=?")->execute([$amt, $sid]);
        logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Изменение опыта', "Студент: $studentName, Установлено: $amt");
        addNotification($pdo, $sid, 'exp', 'Изменение опыта', "Ваш опыт был изменен администратором. Новый опыт: {$amt}⭐", 'star', '#fbbf24');
    }
    respond(['success'=>true,'data'=>['updated'=>true]]);
}

function handleChangeStudentGroup($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $gid = (int)($input['group_id'] ?? 0);

    $stmt = $pdo->prepare("SELECT name FROM students WHERE id=?");
    $stmt->execute([$sid]);
    $studentName = $stmt->fetchColumn();

    $stmt = $pdo->prepare("SELECT name FROM `groups` WHERE id=?");
    $stmt->execute([$gid]);
    $groupName = $stmt->fetchColumn();

    $pdo->prepare("UPDATE students SET group_id=? WHERE id=?")->execute([$gid, $sid]);
    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Смена группы студента', "Студент: $studentName, Новая группа: $groupName");
    addNotification($pdo, $sid, 'group', 'Смена группы', "Вы были переведены в группу «{$groupName}»", 'users', '#10b981');
    respond(['success'=>true,'data'=>['updated'=>true]]);
}

function handleRenameStudent($pdo, $input) {
    $studentId = (int)($input['student_id'] ?? 0);
    $newName = trim($input['new_name'] ?? '');
    $userId = (int)($input['user_id'] ?? 0);
    $userLogin = $input['user_login'] ?? '';

    if (!$studentId || empty($newName)) respond(['success' => false, 'error' => 'Недостаточно данных']);
    if ($studentId < 0) respond(['success' => false, 'error' => 'Нельзя переименовать основателя']);

    $stmt = $pdo->prepare("SELECT name FROM students WHERE id = ?");
    $stmt->execute([$studentId]);
    $oldName = $stmt->fetchColumn();
    if (!$oldName) respond(['success' => false, 'error' => 'Студент не найден']);

    $pdo->prepare("UPDATE students SET name = ? WHERE id = ?")->execute([$newName, $studentId]);
    $pdo->prepare("UPDATE users SET login = ? WHERE student_id = ? AND login = ?")->execute([$newName, $studentId, $oldName]);

    logAdminAction($pdo, $userId, $userLogin, 'Переименование студента', "ID: $studentId, Было: $oldName, Стало: $newName");
    addNotification($pdo, $studentId, 'profile', 'Имя изменено', "Ваше имя было изменено с «{$oldName}» на «{$newName}»", 'user-edit', '#ab00ea');

    respond(['success' => true, 'data' => ['old_name' => $oldName, 'new_name' => $newName]]);
}

function handleGetStudentStats($pdo) {
    $sid = (int)($_GET['student_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT balance, total_earned, infinite_balance FROM students WHERE id=?");
    $stmt->execute([$sid]);
    $sd = $stmt->fetch();

    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM attendance WHERE student_id=?");
    $stmt->execute([$sid]);
    $att = $stmt->fetch()['cnt'];

    respond(['success'=>true,'data'=>[
        'balance'=>$sd?$sd['balance']:0,
        'total_earned'=>$sd?$sd['total_earned']:0,
        'attended'=>(int)$att,
        'infinite_balance'=>$sd?$sd['infinite_balance']:0
    ]]);
}

function handleGetLeaderboard($pdo) {
    $stmt = $pdo->query("SELECT s.*, g.name as group_name FROM students s LEFT JOIN `groups` g ON s.group_id=g.id ORDER BY s.total_earned DESC LIMIT 50");
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleToggleInfiniteBalance($pdo, $input) {
    $studentId = (int)($input['student_id'] ?? 0);
    $infinite = (int)($input['infinite'] ?? 0);
    $userId = (int)($input['user_id'] ?? 0);
    $userLogin = $input['user_login'] ?? '';

    $stmt = $pdo->prepare("SELECT name FROM students WHERE id = ?");
    $stmt->execute([$studentId]);
    $studentName = $stmt->fetchColumn();

    $pdo->prepare("UPDATE students SET infinite_balance = ? WHERE id = ?")->execute([$infinite, $studentId]);
    logAdminAction($pdo, $userId, $userLogin, 'Изменение бесконечного баланса', "Студент: $studentName, Статус: " . ($infinite ? 'Включен' : 'Выключен'));
    addNotification($pdo, $studentId, 'balance', 'Режим баланса изменен', ($infinite ? "Вам включен бесконечный баланс ♾️" : "Бесконечный баланс отключен"), 'infinity', '#f59e0b');

    respond(['success'=>true,'data'=>['infinite'=>$infinite]]);
}

function handleGetStudentInfiniteStatus($pdo) {
    $studentId = (int)($_GET['student_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT infinite_balance FROM students WHERE id = ?");
    $stmt->execute([$studentId]);
    respond(['success'=>true,'data'=>['infinite'=>(int)$stmt->fetchColumn()]]);
}