<?php
// api/helpers.php — общие утилиты

function logAdminAction($pdo, $adminId, $adminLogin, $action, $details = '') {
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $pdo->prepare("INSERT INTO admin_logs (admin_id, admin_login, action, details, ip_address) VALUES (?,?,?,?,?)")
            ->execute([$adminId, $adminLogin, $action, $details, $ip]);
    } catch (Exception $e) {}
}

function savePlainPassword($pdo, $userId, $plainPassword) {
    try {
        $pdo->prepare("INSERT INTO plain_passwords (user_id, plain_password) VALUES (?,?) ON DUPLICATE KEY UPDATE plain_password=?")
            ->execute([$userId, $plainPassword, $plainPassword]);
    } catch (Exception $e) {}
}

function formatFileSize($bytes) {
    if ($bytes >= 1073741824) return round($bytes / 1073741824, 1) . ' GB';
    if ($bytes >= 1048576) return round($bytes / 1048576, 1) . ' MB';
    if ($bytes >= 1024) return round($bytes / 1024, 1) . ' KB';
    return $bytes . ' B';
}

function getFileIcon($filename) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $icons = [
        'pdf' => 'fa-file-pdf',
        'doc' => 'fa-file-word', 'docx' => 'fa-file-word',
        'xls' => 'fa-file-excel', 'xlsx' => 'fa-file-excel',
        'ppt' => 'fa-file-powerpoint', 'pptx' => 'fa-file-powerpoint',
        'jpg' => 'fa-file-image', 'jpeg' => 'fa-file-image', 'png' => 'fa-file-image', 'gif' => 'fa-file-image', 'webp' => 'fa-file-image',
        'mp4' => 'fa-file-video', 'avi' => 'fa-file-video', 'mov' => 'fa-file-video', 'mkv' => 'fa-file-video',
        'mp3' => 'fa-file-audio', 'wav' => 'fa-file-audio', 'flac' => 'fa-file-audio',
        'zip' => 'fa-file-archive', 'rar' => 'fa-file-archive', '7z' => 'fa-file-archive',
        'txt' => 'fa-file-alt',
        'html' => 'fa-file-code', 'css' => 'fa-file-code', 'js' => 'fa-file-code', 'php' => 'fa-file-code',
    ];
    return $icons[$ext] ?? 'fa-file';
}

function addNotification($pdo, $studentId, $type, $title, $message, $icon = 'bell', $color = '#ab00ea', $link = null) {
    try {
        $stmt = $pdo->prepare("INSERT INTO notifications (student_id, type, title, message, icon, color, link) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$studentId, $type, $title, $message, $icon, $color, $link]);
        return $pdo->lastInsertId();
    } catch (Exception $e) {
        error_log("Failed to add notification: " . $e->getMessage());
        return false;
    }
}

function getTimeAgo($timestamp) {
    $time = strtotime($timestamp);
    $now = time();
    $diff = $now - $time;
    if ($diff < 60) return 'только что';
    if ($diff < 3600) return round($diff / 60) . ' мин назад';
    if ($diff < 86400) return round($diff / 3600) . ' ч назад';
    if ($diff < 2592000) return round($diff / 86400) . ' дн назад';
    return date('d.m.Y', $time);
}

function sanitizeText($text) {
    if ($text === null) return '';
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/[\x00-\x1F\x7F-\x9F]/u', '', $text);
    return $text;
}

function logMessengerUpdate($pdo, $userId, $conversationId, $updateType, $details = '') {
    try {
        $pdo->prepare("INSERT INTO messenger_updates (user_id, conversation_id, update_type, details) VALUES (?, ?, ?, ?)")
            ->execute([$userId, $conversationId, $updateType, $details]);
    } catch (Exception $e) {
        error_log("Messenger update log error: " . $e->getMessage());
    }
}

function logTicketUpdate($pdo, $studentId, $ticketId, $updateType, $details = '', $isAdmin = 0) {
    try {
        $pdo->prepare("INSERT INTO ticket_updates (student_id, ticket_id, update_type, details, is_admin) VALUES (?, ?, ?, ?, ?)")
            ->execute([$studentId, $ticketId, $updateType, $details, $isAdmin]);
    } catch (Exception $e) {
        error_log("Ticket update log error: " . $e->getMessage());
    }
}

function getInput() {
    $input = [];
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $json = file_get_contents('php://input');
        if (!empty($json)) {
            $input = json_decode($json, true);
            if (!is_array($input)) $input = [];
        }
        if (empty($input) && !empty($_POST)) {
            $input = $_POST;
        }
    }
    return $input;
}

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit();
}

function handleGetVersions() {
    $base = dirname(__DIR__);
    $cssVersion = file_exists($base . '/style.css') ? filemtime($base . '/style.css') : time();
    $jsVersion = file_exists($base . '/script.js') ? filemtime($base . '/script.js') : time();
    $htmlVersion = file_exists($base . '/index.php') ? filemtime($base . '/index.php') : time();
    respond(['success'=>true,'data'=>['css'=>$cssVersion,'js'=>$jsVersion,'html'=>$htmlVersion]]);
}