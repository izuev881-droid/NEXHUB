<?php
// api/auth.php

function handleLogin($pdo, $input) {
    $login = trim($input['login'] ?? '');
    $password = $input['password'] ?? '';
    $role = $input['role'] ?? 'student';

    if (empty($login) || empty($password)) {
        respond(['success'=>false,'error'=>'Введите логин и пароль']);
    }

    $lockdownEnabled = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='lockdown_enabled'")->fetch();
    $isLockdown = $lockdownEnabled && $lockdownEnabled['setting_value'] == 1;

    $stmt = $pdo->prepare("SELECT * FROM users WHERE login = ?");
    $stmt->execute([$login]);
    $user = $stmt->fetch();

    if (!$user || md5($password) !== $user['password']) {
        respond(['success'=>false,'error'=>'Неверный логин или пароль']);
    }

    if ($isLockdown && $user['role'] !== 'founder') {
        $lockdownMsg = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='lockdown_message'")->fetch();
        $msg = $lockdownMsg ? $lockdownMsg['setting_value'] : 'Доступ ограничен администратором';
        respond(['success'=>false, 'error'=>'blocked', 'message'=>$msg, 'lockdown'=>true]);
    }

    $token = md5(uniqid() . $user['id'] . time() . rand(1000, 9999));
    $pdo->prepare("UPDATE users SET session_token = ? WHERE id = ?")->execute([$token, $user['id']]);
    $user['session_token'] = $token;

    $student = null;
    if ($user['student_id'] && $user['student_id'] != 0) {
        $stmt = $pdo->prepare("SELECT s.*, g.name as group_name FROM students s LEFT JOIN `groups` g ON s.group_id = g.id WHERE s.id = ?");
        $stmt->execute([$user['student_id']]);
        $student = $stmt->fetch();
        if ($student && isset($student['infinite_balance'])) {
            $student['infinite_balance'] = (bool)$student['infinite_balance'];
        }
    }

    logAdminAction($pdo, $user['id'], $user['login'], 'Вход в систему', "Роль: {$user['role']}");
    respond(['success'=>true, 'data'=>['user'=>$user, 'student'=>$student, 'session_token'=>$token, 'lockdown_enabled'=>$isLockdown]]);
}

function handleCheckSession($pdo) {
    $uid = (int)($_GET['user_id'] ?? 0);
    $tok = $_GET['session_token'] ?? '';
    $stmt = $pdo->prepare("SELECT session_token, role FROM users WHERE id=?");
    $stmt->execute([$uid]);
    $u = $stmt->fetch();

    if (!$u || $u['session_token'] !== $tok) {
        respond(['success'=>true,'data'=>['valid'=>false]]);
    }

    $lockdownEnabled = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='lockdown_enabled'")->fetch();
    $isLockdown = $lockdownEnabled && $lockdownEnabled['setting_value'] == 1;

    if ($isLockdown && $u['role'] !== 'founder') {
        respond(['success'=>true,'data'=>['valid'=>false, 'lockdown'=>true]]);
    }
    respond(['success'=>true,'data'=>['valid'=>true]]);
}

function handleLogout($pdo, $input) {
    $id = (int)($input['user_id'] ?? 0);
    if ($id > 0) $pdo->prepare("UPDATE users SET session_token=NULL WHERE id=?")->execute([$id]);
    respond(['success'=>true,'data'=>['logged_out'=>true]]);
}

function handleGetLockdownStatus($pdo) {
    $en = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='lockdown_enabled'")->fetch();
    $msg = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key='lockdown_message'")->fetch();
    respond(['success'=>true,'data'=>[
        'enabled'=>$en?(bool)$en['setting_value']:false,
        'message'=>$msg?$msg['setting_value']:'Доступ ограничен'
    ]]);
}

function handleSetLockdown($pdo, $input) {
    $en = isset($input['enabled']) ? (bool)$input['enabled'] : false;
    $msg = $input['message'] ?? 'Доступ ограничен';

    $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('lockdown_enabled',?) ON DUPLICATE KEY UPDATE setting_value=?")
        ->execute([$en?'1':'0', $en?'1':'0']);
    $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('lockdown_message',?) ON DUPLICATE KEY UPDATE setting_value=?")
        ->execute([$msg, $msg]);

    $adminId = (int)($input['founder_id'] ?? 0);
    $adminLogin = $input['founder_login'] ?? '';
    $action = $en ? "Статус: ВКЛ. Сообщение: $msg" : "Статус: ВЫКЛ.";
    logAdminAction($pdo, $adminId, $adminLogin, 'Блокировка сайта', $action);

    if ($en) {
        $pdo->prepare("UPDATE users SET session_token = NULL WHERE role != 'founder'")->execute();
    }
    respond(['success'=>true,'data'=>['enabled'=>$en]]);
}