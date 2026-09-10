<?php
// api/config.php — конфигурация и заголовки

error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('upload_max_filesize', '25M');
ini_set('post_max_size', '25M');
ini_set('max_file_uploads', '10');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// === База данных ===
define('DB_HOST', 'localhost');
define('DB_NAME', 'a1261886_nexhub');
define('DB_USER', 'a1261886_nexhub');
define('DB_PASS', 'Zuev2008@');

// === Директории загрузок (на уровень выше api/) ===
define('UPLOAD_DIR_SHOP',        __DIR__ . '/../uploads/shop/');
define('UPLOAD_DIR_CHAT',        __DIR__ . '/../uploads/chat/');
define('UPLOAD_DIR_COMMON_CHAT', __DIR__ . '/../uploads/common_chat/');
define('UPLOAD_DIR_FILES',       __DIR__ . '/../uploads/files/');

foreach ([UPLOAD_DIR_SHOP, UPLOAD_DIR_CHAT, UPLOAD_DIR_COMMON_CHAT, UPLOAD_DIR_FILES] as $dir) {
    if (!file_exists($dir)) mkdir($dir, 0777, true);
}