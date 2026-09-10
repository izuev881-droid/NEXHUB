<?php
// api/history.php

function handleGetStudentHistory($pdo) {
    $sid = (int)($_GET['student_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM history WHERE student_id=? ORDER BY created_at DESC LIMIT 200");
    $stmt->execute([$sid]);
    $h = $stmt->fetchAll();

    foreach ($h as &$item) {
        if (isset($item['created_at'])) {
            $item['time'] = date('H:i', strtotime($item['created_at']));
            $item['date'] = date('d.m.Y', strtotime($item['created_at']));
        }
    }
    respond(['success'=>true,'data'=>$h]);
}

function handleClearHistory($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $pdo->prepare("DELETE FROM history WHERE student_id=?")->execute([$sid]);
    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Очистка истории', "Студент ID: $sid");
    respond(['success'=>true,'data'=>['cleared'=>true]]);
}