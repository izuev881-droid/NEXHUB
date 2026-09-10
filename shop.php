<?php
// api/shop.php

function handleGetShopItems($pdo) {
    $stmt = $pdo->query("SELECT * FROM shop_items ORDER BY id DESC");
    $items = $stmt->fetchAll();
    foreach ($items as &$item) {
        $item['image_full_url'] = !empty($item['image_url'])
            ? '/' . ltrim($item['image_url'], '/') . '?v=' . time()
            : null;
    }
    respond(['success'=>true,'data'=>$items]);
}

function handleAddShopItem($pdo, $input) {
    $name = $input['name'] ?? '';
    $price = $input['price'] ?? 0;
    $stock = $input['stock'] ?? -1;

    $pdo->prepare("INSERT INTO shop_items (name, price, stock, image_url) VALUES (?,?,?,NULL)")
        ->execute([$name, $price, $stock]);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Добавление товара', "Название: $name, Цена: $price");
    respond(['success'=>true,'data'=>['id'=>$pdo->lastInsertId()]]);
}

function handleUpdateShopItem($pdo, $input) {
    $itemId = $input['item_id'] ?? 0;
    $name = $input['name'] ?? '';
    $price = $input['price'] ?? 0;
    $stock = $input['stock'] ?? -1;

    $pdo->prepare("UPDATE shop_items SET name=?, price=?, stock=? WHERE id=?")
        ->execute([$name, $price, $stock, $itemId]);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Редактирование товара', "ID: $itemId, Название: $name");
    respond(['success'=>true,'data'=>['updated'=>true]]);
}

function handleDeleteShopItem($pdo, $input) {
    $iid = $input['item_id'] ?? 0;

    $stmt = $pdo->prepare("SELECT name, image_url FROM shop_items WHERE id=?");
    $stmt->execute([$iid]);
    $item = $stmt->fetch();

    if ($item && !empty($item['image_url'])) {
        $fp = __DIR__ . '/../' . ltrim($item['image_url'], '/');
        if (file_exists($fp)) @unlink($fp);
    }
    $pdo->prepare("DELETE FROM shop_items WHERE id=?")->execute([$iid]);

    logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Удаление товара', "ID: $iid, Название: " . ($item['name'] ?? ''));
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}

function handleBuyItem($pdo, $input) {
    $sid = (int)($input['student_id'] ?? 0);
    $iid = (int)($input['item_id'] ?? 0);
    $price = (int)($input['price'] ?? 0);

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("SELECT * FROM shop_items WHERE id=? FOR UPDATE");
        $stmt->execute([$iid]);
        $item = $stmt->fetch();
        if (!$item) throw new Exception('Товар не найден');

        $stmt = $pdo->prepare("SELECT balance, infinite_balance FROM students WHERE id=? FOR UPDATE");
        $stmt->execute([$sid]);
        $st = $stmt->fetch();

        $hasEnoughBalance = $st['infinite_balance'] || $st['balance'] >= $price;
        if (!$hasEnoughBalance) throw new Exception('Недостаточно средств');

        if (!$st['infinite_balance']) {
            $pdo->prepare("UPDATE students SET balance=balance-? WHERE id=?")->execute([$price, $sid]);
        }
        if ($item['stock'] > 0) {
            $pdo->prepare("UPDATE shop_items SET stock=stock-1 WHERE id=?")->execute([$iid]);
        }
        $pdo->prepare("INSERT INTO purchases (student_id, item_id) VALUES (?,?)")->execute([$sid, $iid]);
        $pdo->prepare("INSERT INTO history (student_id, action, details, time, created_at) VALUES (?,'Покупка',?,CURTIME(),NOW())")
            ->execute([$sid, "Купил(а) «{$item['name']}» за {$price} 💎"]);

        addNotification($pdo, $sid, 'shop', 'Покупка в магазине', "Вы приобрели «{$item['name']}» за {$price}💎", 'shopping-cart', '#ab00ea');

        $pdo->commit();
        respond(['success'=>true,'data'=>['bought'=>true,'item_name'=>$item['name']]]);
    } catch (Exception $e) {
        $pdo->rollBack();
        respond(['success'=>false,'error'=>$e->getMessage()]);
    }
}

function handleDeleteShopItemImage($pdo, $input) {
    $iid = $input['item_id'] ?? 0;

    $stmt = $pdo->prepare("SELECT image_url, name FROM shop_items WHERE id=?");
    $stmt->execute([$iid]);
    $item = $stmt->fetch();

    if ($item && !empty($item['image_url'])) {
        $fp = __DIR__ . '/../' . ltrim($item['image_url'], '/');
        if (file_exists($fp)) @unlink($fp);
        $pdo->prepare("UPDATE shop_items SET image_url=NULL WHERE id=?")->execute([$iid]);
        logAdminAction($pdo, $input['user_id'] ?? 0, $input['user_login'] ?? '', 'Удаление изображения товара', "Товар: {$item['name']}");
    }
    respond(['success'=>true,'data'=>['deleted'=>true]]);
}