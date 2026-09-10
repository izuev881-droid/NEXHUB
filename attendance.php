<?php
// api/attendance.php

function handleGetStudentAttendance($pdo) {
    $stmt = $pdo->prepare("SELECT * FROM attendance WHERE student_id=?");
    $stmt->execute([(int)($_GET['student_id'] ?? 0)]);
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleToggleAttendance($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $pid = $input['pair_id'] ?? '';
    $rc = (int)($input['reward_crystals'] ?? 0);
    $re = (int)($input['reward_exp'] ?? 0);
    $act = $input['action'] ?? '';

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("SELECT * FROM attendance WHERE student_id=? AND pair_id=?");
        $stmt->execute([$sid, $pid]);
        $ex = $stmt->fetch();

        if ($act === 'add' && !$ex) {
            $stmtPair = $pdo->prepare("SELECT name FROM schedule WHERE pair_id = ?");
            $stmtPair->execute([$pid]);
            $pairName = $stmtPair->fetchColumn();

            $pdo->prepare("INSERT INTO attendance (student_id, pair_id) VALUES (?,?)")->execute([$sid, $pid]);
            $pdo->prepare("UPDATE students SET balance=balance+?, total_earned=total_earned+? WHERE id=?")
                ->execute([$rc, $re, $sid]);

            logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Отметка посещения', "Студент ID: $sid, Пара: $pid");
            addNotification($pdo, $sid, 'attendance', 'Посещение отмечено', "✅ Вы отметили посещение пары «{$pairName}». Получено +{$rc}💎 и +{$re}⭐", 'check-circle', '#10b981', '#/schedule');
        } elseif ($act === 'remove' && $ex) {
            $stmtPair = $pdo->prepare("SELECT name FROM schedule WHERE pair_id = ?");
            $stmtPair->execute([$pid]);
            $pairName = $stmtPair->fetchColumn();

            $pdo->prepare("DELETE FROM attendance WHERE student_id=? AND pair_id=?")->execute([$sid, $pid]);
            $pdo->prepare("UPDATE students SET balance=balance-?, total_earned=total_earned-? WHERE id=?")
                ->execute([$rc, $re, $sid]);

            logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Снятие отметки посещения', "Студент ID: $sid, Пара: $pid");
            addNotification($pdo, $sid, 'attendance', 'Посещение отменено', "❌ С вас снята отметка посещения пары «{$pairName}». Снято {$rc}💎 и {$re}⭐", 'times-circle', '#ef4444', '#/schedule');
        }
        $pdo->commit();
        respond(['success'=>true,'data'=>['toggled'=>true]]);
    } catch (Exception $e) {
        $pdo->rollBack();
        respond(['success'=>false,'error'=>$e->getMessage()]);
    }
}