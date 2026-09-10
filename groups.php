<?php
// api/groups.php

function handleGetGroups($pdo) {
    $stmt = $pdo->query("SELECT * FROM `groups` ORDER BY id");
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleAddGroup($pdo, $input) {
    $groupName = trim($input['name'] ?? '');
    $pdo->prepare("INSERT INTO `groups` (name) VALUES (?)")->execute([$groupName]);
    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Создание группы', "Название: $groupName");
    respond(['success'=>true,'data'=>['id'=>$pdo->lastInsertId()]]);
}

function handleDeleteGroup($pdo, $input) {
    $gid = (int)($input['group_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT name FROM `groups` WHERE id=?");
    $stmt->execute([$gid]);
    $groupName = $stmt->fetchColumn();
    $pdo->prepare("DELETE FROM `groups` WHERE id=?")->execute([$gid]);
    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Удаление группы', "Группа ID: $gid, Название: $groupName");
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}