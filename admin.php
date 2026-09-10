<?php
// api/admin.php

function handleGetAdminAccounts($pdo) {
    $stmt = $pdo->query("SELECT id, login, role FROM users WHERE role='admin'");
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleAddAdmin($pdo, $input) {
    $login = $input['login'] ?? '';
    $password = $input['password'] ?? '';
    $m = md5($password);

    $pdo->prepare("INSERT INTO users (login, password, role, student_id) VALUES (?,?,'admin',0)")->execute([$login, $m]);
    savePlainPassword($pdo, $pdo->lastInsertId(), $password);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Добавление администратора', "Логин: $login");
    respond(['success'=>true,'data'=>['id'=>$pdo->lastInsertId()]]);
}

function handleDeleteAdmin($pdo, $input) {
    $aid = $input['admin_id']??0;

    $stmt = $pdo->prepare("SELECT login FROM users WHERE id=?");
    $stmt->execute([$aid]);
    $adminLogin = $stmt->fetchColumn();

    $pdo->prepare("DELETE FROM plain_passwords WHERE user_id=?")->execute([$aid]);
    $pdo->prepare("DELETE FROM users WHERE id=? AND role='admin'")->execute([$aid]);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Удаление администратора', "Администратор: $adminLogin");
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}

function handleGetAllUsersWithRoles($pdo) {
    $stmt = $pdo->query("SELECT u.id, u.login, u.role, s.name as student_name FROM users u LEFT JOIN students s ON u.student_id=s.id ORDER BY FIELD(u.role,'founder','admin','student'), u.id");
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleToggleAdminRole($pdo, $input) {
    $act = $input['action']??'';
    $userId = $input['user_id'] ?? 0;

    if ($act === 'promote') {
        $pdo->prepare("UPDATE users SET role='admin' WHERE id=? AND role='student'")->execute([$userId]);
        logAdminAction($pdo, $input['current_user_id'] ?? 0, $input['current_user_login'] ?? '', 'Повышение до администратора', "ID пользователя: $userId");
    } else {
        $pdo->prepare("UPDATE users SET role='student' WHERE id=? AND role='admin'")->execute([$userId]);
        logAdminAction($pdo, $input['current_user_id'] ?? 0, $input['current_user_login'] ?? '', 'Понижение до студента', "ID пользователя: $userId");
    }
    respond(['success'=>true,'data'=>['action'=>$act]]);
}

function handleDeleteAdminByFounder($pdo, $input) {
    $aid = $input['admin_id']??0;

    $stmt = $pdo->prepare("SELECT login FROM users WHERE id=?");
    $stmt->execute([$aid]);
    $adminLogin = $stmt->fetchColumn();

    $pdo->prepare("DELETE FROM plain_passwords WHERE user_id=?")->execute([$aid]);
    $pdo->prepare("DELETE FROM users WHERE id=? AND role='admin'")->execute([$aid]);

    logAdminAction($pdo, $input['founder_id'] ?? 0, $input['founder_login'] ?? '', 'Удаление администратора (основатель)', "Администратор: $adminLogin");
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}

function handleGetAdminLogs($pdo) {
    $stmt = $pdo->query("SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 500");
    respond(['success'=>true,'data'=>['logs'=>$stmt->fetchAll()]]);
}

function handleClearAdminLogs($pdo, $input) {
    $pdo->query("DELETE FROM admin_logs");
    logAdminAction($pdo, $input['founder_id'] ?? 0, $input['founder_login'] ?? '', 'Очистка логов администраторов', 'Все логи удалены');
    respond(['success'=>true,'data'=>['cleared'=>true]]);
}

function handleGetPasswords($pdo) {
    $uid = (int)($_GET['user_id'] ?? 0);
    $tr = $_GET['target_role'] ?? '';

    if ($tr === 'students') {
        $stmt = $pdo->query("SELECT u.id, u.login, p.plain_password as password, 'student' as role, s.name as student_name FROM users u LEFT JOIN students s ON u.student_id=s.id LEFT JOIN plain_passwords p ON u.id=p.user_id WHERE u.role='student'");
    } elseif ($tr === 'admins') {
        $stmt = $pdo->query("SELECT u.id, u.login, p.plain_password as password, u.role, NULL as student_name FROM users u LEFT JOIN plain_passwords p ON u.id=p.user_id WHERE u.role='admin'");
    } else {
        $stmt = $pdo->query("SELECT u.id, u.login, p.plain_password as password, u.role, s.name as student_name FROM users u LEFT JOIN students s ON u.student_id=s.id LEFT JOIN plain_passwords p ON u.id=p.user_id");
    }
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleChangePassword($pdo, $input) {
    $uid = (int)($input['user_id'] ?? 0);
    $np = $input['new_password'] ?? '';
    $trole = $input['role'] ?? 'student';
    $cuid = (int)($input['current_user_id'] ?? 0);
    $culogin = $input['current_user_login'] ?? '';
    $m = md5($np);

    if (in_array($trole, ['admin','founder'])) {
        $pdo->prepare("UPDATE users SET password=? WHERE id=? AND role IN('admin','founder')")->execute([$m, $uid]);
        savePlainPassword($pdo, $uid, $np);
    } else {
        $pdo->prepare("UPDATE users SET password=? WHERE student_id=? AND role='student'")->execute([$m, $uid]);
        $uu = $pdo->prepare("SELECT id FROM users WHERE student_id=?");
        $uu->execute([$uid]);
        $userRow = $uu->fetch();
        if ($userRow) savePlainPassword($pdo, $userRow['id'], $np);
    }

    logAdminAction($pdo, $cuid, $culogin, 'Смена пароля', "ID пользователя: $uid");
    respond(['success'=>true,'data'=>['message'=>'Пароль изменён']]);
}