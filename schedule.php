<?php
// api/schedule.php

function handleGetSchedule($pdo) {
    $gn = $_GET['group_name'] ?? '';
    $day = isset($_GET['day']) ? (int)$_GET['day'] : null;

    if (empty($gn)) respond(['success'=>true,'data'=>[]]);

    $stmt = $pdo->prepare("SELECT id FROM `groups` WHERE name=?");
    $stmt->execute([$gn]);
    $g = $stmt->fetch();
    if (!$g) respond(['success'=>true,'data'=>[]]);

    $sql = "SELECT * FROM schedule WHERE group_id=?";
    $params = [$g['id']];

    if ($day !== null && $day >= 0 && $day <= 5) {
        $sql .= " AND day_index=?";
        $params[] = $day;
    }
    $sql .= " ORDER BY time ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleAddSchedulePair($pdo, $input) {
    $pid = 'pair_' . time() . '_' . rand(1000, 9999);
    $dayIndex = $input['day_index'] ?? 0;
    $groupId = $input['group_id'] ?? 0;
    $time = $input['time'] ?? '';
    $name = $input['name'] ?? '';
    $teacher = $input['teacher'] ?? '';
    $room = $input['room'] ?? '';
    $reward = $input['reward'] ?? 50;
    $rewardExp = $input['reward_exp'] ?? 25;

    $pdo->prepare("INSERT INTO schedule (day_index, group_id, pair_id, time, name, teacher, room, reward, reward_exp) VALUES (?,?,?,?,?,?,?,?,?)")
        ->execute([$dayIndex, $groupId, $pid, $time, $name, $teacher, $room, $reward, $rewardExp]);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Добавление пары в расписание', "Группа ID: $groupId, Пара: $name");
    respond(['success'=>true,'data'=>['pairId'=>$pid]]);
}

function handleUpdateSchedulePair($pdo, $input) {
    $pairId = $input['pair_id'] ?? '';
    $time = $input['time'] ?? '';
    $name = $input['name'] ?? '';

    $pdo->prepare("UPDATE schedule SET time=?, name=?, teacher=?, room=?, reward=?, reward_exp=? WHERE pair_id=?")
        ->execute([$time, $name, $input['teacher']??'', $input['room']??'', $input['reward']??50, $input['reward_exp']??25, $pairId]);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Редактирование пары в расписании', "ID пары: $pairId");
    respond(['success'=>true,'data'=>['updated'=>true]]);
}

function handleDeleteSchedulePair($pdo, $input) {
    $pairId = $input['pair_id'] ?? '';
    $pdo->prepare("DELETE FROM schedule WHERE pair_id=?")->execute([$pairId]);
    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Удаление пары из расписания', "ID пары: $pairId");
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}