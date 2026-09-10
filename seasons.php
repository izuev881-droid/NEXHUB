<?php
// api/seasons.php

function handleGetGlobalSeason($pdo) {
    $stmt = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'global_season'");
    $row = $stmt->fetch();
    $season = $row ? $row['setting_value'] : 'default';
    respond(['success' => true, 'data' => ['season' => $season]]);
}

function handleSetGlobalSeason($pdo, $input) {
    $season = $input['season'] ?? 'default';
    $userId = (int)($input['user_id'] ?? 0);
    $userLogin = $input['user_login'] ?? '';

    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user || ($user['role'] !== 'founder' && $user['role'] !== 'admin')) {
        respond(['success' => false, 'error' => 'Недостаточно прав']);
    }

    $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('global_season', ?) ON DUPLICATE KEY UPDATE setting_value = ?")
        ->execute([$season, $season]);

    logAdminAction($pdo, $userId, $userLogin, 'Смена глобальной сезонной темы', "Новый сезон: $season");
    respond(['success' => true, 'data' => ['season' => $season]]);
}

function handleSetPersonalSeason($pdo, $input) {
    $studentId = (int)($input['student_id'] ?? 0);
    $season = $input['season'] ?? 'default';

    if (!$studentId) respond(['success' => false, 'error' => 'ID студента не указан']);

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `user_seasons` (
            `student_id` INT PRIMARY KEY,
            `season` VARCHAR(50) NOT NULL DEFAULT 'default',
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $stmt = $pdo->prepare("INSERT INTO user_seasons (student_id, season) VALUES (?, ?) ON DUPLICATE KEY UPDATE season = ?");
        $stmt->execute([$studentId, $season, $season]);

        respond(['success' => true, 'data' => ['season' => $season]]);
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleGetPersonalSeason($pdo) {
    $studentId = (int)($_GET['student_id'] ?? 0);
    if (!$studentId) respond(['success' => false, 'error' => 'ID студента не указан']);

    try {
        $stmt = $pdo->prepare("SELECT season FROM user_seasons WHERE student_id = ?");
        $stmt->execute([$studentId]);
        $result = $stmt->fetch();

        $season = $result ? $result['season'] : null;
        respond(['success' => true, 'data' => ['season' => $season]]);
    } catch (Exception $e) {
        respond(['success' => false, 'error' => $e->getMessage()]);
    }
}