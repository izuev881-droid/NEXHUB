<?php
// api/events.php

function handleGetEvents($pdo) {
    $stmt = $pdo->query("SELECT * FROM events ORDER BY date ASC");
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleAddEvent($pdo, $input) {
    $title = $input['title'] ?? '';
    $date = $input['date'] ?? '';
    $time = $input['time'] ?? '';
    $location = $input['location'] ?? '';
    $description = $input['description'] ?? '';

    $pdo->prepare("INSERT INTO events (title, date, time, location, description) VALUES (?,?,?,?,?)")
        ->execute([$title, $date, $time, $location, $description]);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Добавление события', "Название: $title");
    respond(['success'=>true,'data'=>['id'=>$pdo->lastInsertId()]]);
}

function handleUpdateEvent($pdo, $input) {
    $eventId = $input['event_id'] ?? 0;
    $title = $input['title'] ?? '';

    $pdo->prepare("UPDATE events SET title=?, date=?, time=?, location=?, description=? WHERE id=?")
        ->execute([$title, $input['date']??'', $input['time']??'', $input['location']??'', $input['description']??'', $eventId]);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Редактирование события', "ID: $eventId, Название: $title");
    respond(['success'=>true,'data'=>['updated'=>true]]);
}

function handleDeleteEvent($pdo, $input) {
    $eventId = $input['event_id'] ?? 0;
    $pdo->prepare("DELETE FROM events WHERE id=?")->execute([$eventId]);
    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Удаление события', "ID: $eventId");
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}