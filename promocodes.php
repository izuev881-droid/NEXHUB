<?php
// api/promocodes.php

function handleGetPromocodes($pdo) {
    $stmt = $pdo->query("SELECT * FROM promocodes ORDER BY id DESC");
    respond(['success'=>true,'data'=>$stmt->fetchAll()]);
}

function handleAddPromo($pdo, $input) {
    $code = strtoupper($input['code'] ?? '');
    $rewardCrystals = $input['reward_crystals'] ?? 0;
    $rewardExp = $input['reward_exp'] ?? 0;
    $maxUses = $input['max_uses'] ?? 1;
    $titleId = !empty($input['title_id']) ? $input['title_id'] : null;

    $pdo->prepare("INSERT INTO promocodes (code, reward_crystals, reward_exp, max_uses, used_count, active, title_id) VALUES (?,?,?,?,0,1,?)")
        ->execute([$code, $rewardCrystals, $rewardExp, $maxUses, $titleId]);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Создание промокода', "Код: $code, Награда: +$rewardCrystals💎 +$rewardExp⭐");
    respond(['success'=>true,'data'=>['id'=>$pdo->lastInsertId()]]);
}

function handleActivatePromo($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $code = strtoupper($input['code'] ?? '');

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("SELECT * FROM promocodes WHERE code=? AND active=1");
        $stmt->execute([$code]);
        $promo = $stmt->fetch();
        if (!$promo) throw new Exception('Промокод не найден');
        if ($promo['used_count'] >= $promo['max_uses']) throw new Exception('Лимит использований');

        $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM used_promocodes WHERE student_id=? AND code=?");
        $stmt->execute([$sid, $code]);
        if ($stmt->fetch()['cnt'] > 0) throw new Exception('Уже использован');

        $rewardText = "";
        if ($promo['reward_crystals'] > 0 || $promo['reward_exp'] > 0) {
            $pdo->prepare("UPDATE students SET balance=balance+?, total_earned=total_earned+? WHERE id=?")
                ->execute([$promo['reward_crystals'], $promo['reward_exp'], $sid]);
            if ($promo['reward_crystals'] > 0) $rewardText .= "+{$promo['reward_crystals']}💎 ";
            if ($promo['reward_exp'] > 0) $rewardText .= "+{$promo['reward_exp']}⭐ ";
        }

        if ($promo['title_id']) {
            $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM user_titles WHERE student_id=? AND title_id=?");
            $stmt->execute([$sid, $promo['title_id']]);
            if ($stmt->fetch()['cnt'] == 0) {
                $pdo->prepare("INSERT INTO user_titles (student_id, title_id) VALUES (?, ?)")->execute([$sid, $promo['title_id']]);
                $stmt = $pdo->prepare("SELECT name FROM titles WHERE id=?");
                $stmt->execute([$promo['title_id']]);
                $titleName = $stmt->fetchColumn();
                $pdo->prepare("INSERT INTO history (student_id, action, details, time, created_at) VALUES (?,'Промокод (тег)',?,CURTIME(),NOW())")
                    ->execute([$sid, "Получен тег: «{$titleName}»"]);
                $rewardText .= "и титул «{$titleName}» ";
            }
        }

        $pdo->prepare("INSERT INTO used_promocodes (student_id, code) VALUES (?,?)")->execute([$sid, $code]);
        $pdo->prepare("UPDATE promocodes SET used_count=used_count+1 WHERE id=?")->execute([$promo['id']]);
        $pdo->prepare("INSERT INTO history (student_id, action, details, time, created_at) VALUES (?,'Промокод',?,CURTIME(),NOW())")
            ->execute([$sid, "Промокод «{$code}»: +{$promo['reward_crystals']} 💎 +{$promo['reward_exp']} ⭐"]);

        addNotification($pdo, $sid, 'promo', 'Промокод активирован', "Промокод «{$code}» активирован! Получено: {$rewardText}", 'ticket-alt', '#f59e0b');

        $pdo->commit();
        respond(['success'=>true,'data'=>[
            'reward'=>['crystals'=>(int)$promo['reward_crystals'], 'exp'=>(int)$promo['reward_exp']],
            'title_given'=>!empty($promo['title_id'])
        ]]);
    } catch (Exception $e) {
        $pdo->rollBack();
        respond(['success'=>false,'error'=>$e->getMessage()]);
    }
}

function handleTogglePromo($pdo, $input) {
    $promoId = $input['promo_id'] ?? 0;
    $pdo->prepare("UPDATE promocodes SET active=NOT active WHERE id=?")->execute([$promoId]);
    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Переключение промокода', "ID: $promoId");
    respond(['success'=>true,'data'=>['toggled'=>true]]);
}

function handleDeletePromo($pdo, $input) {
    $promoId = $input['promo_id'] ?? 0;
    $stmt = $pdo->prepare("SELECT code FROM promocodes WHERE id=?");
    $stmt->execute([$promoId]);
    $promoCode = $stmt->fetchColumn();

    $pdo->prepare("DELETE FROM promocodes WHERE id=?")->execute([$promoId]);
    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Удаление промокода', "Код: $promoCode");
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}

function handleGetStudentPromoCodes($pdo) {
    $stmt = $pdo->prepare("SELECT code FROM used_promocodes WHERE student_id=? ORDER BY used_at DESC");
    $stmt->execute([(int)($_GET['student_id']??0)]);
    respond(['success'=>true,'data'=>$stmt->fetchAll(PDO::FETCH_COLUMN)]);
}