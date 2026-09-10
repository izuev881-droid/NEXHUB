<?php
// api/database.php — подключение и инициализация БД
require_once __DIR__ . '/config.php';

global $pdo;

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec("SET NAMES utf8mb4");

    initializeDatabase($pdo);
    ensureFounderExists($pdo);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Ошибка подключения к БД: ' . $e->getMessage()]);
    exit();
}

function initializeDatabase($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `shop_items` (`id` INT AUTO_INCREMENT PRIMARY KEY, `name` VARCHAR(255) NOT NULL, `price` INT NOT NULL DEFAULT 0, `stock` INT NOT NULL DEFAULT -1, `image_url` VARCHAR(500) NULL DEFAULT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `users` (`id` INT AUTO_INCREMENT PRIMARY KEY, `login` VARCHAR(100) NOT NULL UNIQUE, `password` VARCHAR(255) NOT NULL, `role` VARCHAR(20) NOT NULL DEFAULT 'student', `student_id` INT NULL DEFAULT 0, `session_token` VARCHAR(255) NULL DEFAULT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `students` (`id` INT AUTO_INCREMENT PRIMARY KEY, `name` VARCHAR(255) NOT NULL, `group_id` INT NULL DEFAULT NULL, `balance` INT NOT NULL DEFAULT 0, `total_earned` INT NOT NULL DEFAULT 0, `infinite_balance` TINYINT NOT NULL DEFAULT 0, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `groups` (`id` INT AUTO_INCREMENT PRIMARY KEY, `name` VARCHAR(100) NOT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `schedule` (`id` INT AUTO_INCREMENT PRIMARY KEY, `pair_id` VARCHAR(50) NOT NULL, `group_id` INT NOT NULL, `day_index` INT NOT NULL DEFAULT 0, `time` VARCHAR(20) NOT NULL, `name` VARCHAR(255) NOT NULL, `teacher` VARCHAR(255) DEFAULT '', `room` VARCHAR(50) DEFAULT '', `reward` INT DEFAULT 50, `reward_exp` INT DEFAULT 25, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `attendance` (`id` INT AUTO_INCREMENT PRIMARY KEY, `student_id` INT NOT NULL, `pair_id` VARCHAR(50) NOT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY `unique_attendance` (`student_id`, `pair_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `history` (`id` INT AUTO_INCREMENT PRIMARY KEY, `student_id` INT NOT NULL, `action` VARCHAR(100) NOT NULL, `details` TEXT, `time` VARCHAR(10) DEFAULT '', `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `purchases` (`id` INT AUTO_INCREMENT PRIMARY KEY, `student_id` INT NOT NULL, `item_id` INT NOT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `events` (`id` INT AUTO_INCREMENT PRIMARY KEY, `title` VARCHAR(255) NOT NULL, `date` DATE NOT NULL, `time` VARCHAR(10) DEFAULT '', `location` VARCHAR(255) DEFAULT '', `description` TEXT, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `promocodes` (`id` INT AUTO_INCREMENT PRIMARY KEY, `code` VARCHAR(50) NOT NULL UNIQUE, `reward_crystals` INT NOT NULL DEFAULT 0, `reward_exp` INT NOT NULL DEFAULT 0, `max_uses` INT NOT NULL DEFAULT 1, `used_count` INT NOT NULL DEFAULT 0, `active` TINYINT NOT NULL DEFAULT 1, `title_id` INT NULL DEFAULT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `used_promocodes` (`id` INT AUTO_INCREMENT PRIMARY KEY, `student_id` INT NOT NULL, `code` VARCHAR(50) NOT NULL, `used_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY `unique_use` (`student_id`, `code`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `support_tickets` (`id` INT AUTO_INCREMENT PRIMARY KEY, `ticket_id` VARCHAR(50) NOT NULL, `student_id` INT NOT NULL, `text` TEXT NOT NULL, `is_anonymous` TINYINT DEFAULT 0, `answer` TEXT NULL, `answer_date` DATETIME NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `support_replies` (`id` INT AUTO_INCREMENT PRIMARY KEY, `reply_id` VARCHAR(50) NOT NULL, `ticket_id` VARCHAR(50) NOT NULL, `text` TEXT NOT NULL, `is_admin_reply` TINYINT DEFAULT 0, `admin_name` VARCHAR(100) DEFAULT '', `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `common_chat` (`id` INT AUTO_INCREMENT PRIMARY KEY, `message_id` VARCHAR(50) NOT NULL, `author_id` VARCHAR(50) NOT NULL, `author_name` VARCHAR(255) NOT NULL, `author_group` VARCHAR(100) DEFAULT '', `text` TEXT NOT NULL, `is_pinned` TINYINT DEFAULT 0, `is_deleted` TINYINT DEFAULT 0, `read_by` TEXT NULL DEFAULT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `plain_passwords` (`user_id` INT PRIMARY KEY, `plain_password` VARCHAR(255) NOT NULL, `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `system_settings` (`setting_key` VARCHAR(100) PRIMARY KEY, `setting_value` TEXT, `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `admin_logs` (`id` INT AUTO_INCREMENT PRIMARY KEY, `admin_id` INT NOT NULL, `admin_login` VARCHAR(100) NOT NULL, `action` VARCHAR(255) NOT NULL, `details` TEXT, `ip_address` VARCHAR(45), `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `titles` (`id` INT AUTO_INCREMENT PRIMARY KEY, `name` VARCHAR(100) NOT NULL, `description` VARCHAR(255) DEFAULT '', `rarity` VARCHAR(50) DEFAULT 'common', `color` VARCHAR(20) DEFAULT '#ab00ea', `text_color` VARCHAR(20) DEFAULT '#ffffff', `price` INT NOT NULL DEFAULT 0, `icon` VARCHAR(50) DEFAULT '⭐', `purchasable` TINYINT NOT NULL DEFAULT 1, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `user_titles` (`id` INT AUTO_INCREMENT PRIMARY KEY, `student_id` INT NOT NULL, `title_id` INT NOT NULL, `acquired_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY `unique_user_title` (`student_id`, `title_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `active_titles` (`id` INT AUTO_INCREMENT PRIMARY KEY, `student_id` INT NOT NULL UNIQUE, `title_id` INT NOT NULL, `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `title_updates` (`id` INT AUTO_INCREMENT PRIMARY KEY, `student_id` INT NOT NULL, `title_id` INT NULL, `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("DELETE FROM title_updates WHERE updated_at < DATE_SUB(NOW(), INTERVAL 1 MINUTE)");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_conversations` (`id` INT AUTO_INCREMENT PRIMARY KEY, `type` ENUM('private', 'group') NOT NULL DEFAULT 'private', `name` VARCHAR(255) NULL, `avatar_url` VARCHAR(500) NULL, `created_by` INT NOT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_participants` (`id` INT AUTO_INCREMENT PRIMARY KEY, `conversation_id` INT NOT NULL, `student_id` INT NOT NULL, `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, `last_read_id` INT NULL DEFAULT NULL, `last_read_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY `unique_participant` (`conversation_id`, `student_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_messages` (`id` INT AUTO_INCREMENT PRIMARY KEY, `conversation_id` INT NOT NULL, `student_id` INT NOT NULL, `student_name` VARCHAR(255) NOT NULL, `text` TEXT NOT NULL, `file_url` VARCHAR(500) NULL DEFAULT NULL, `file_name` VARCHAR(255) NULL DEFAULT NULL, `file_size` INT NULL DEFAULT NULL, `file_type` VARCHAR(100) NULL DEFAULT NULL, `is_deleted` TINYINT DEFAULT 0, `is_edited` TINYINT DEFAULT 0, `edited_at` TIMESTAMP NULL DEFAULT NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `notifications` (`id` INT AUTO_INCREMENT PRIMARY KEY, `student_id` INT NOT NULL, `type` VARCHAR(50) NOT NULL, `title` VARCHAR(255) NOT NULL, `message` TEXT NOT NULL, `icon` VARCHAR(50) DEFAULT 'bell', `color` VARCHAR(20) DEFAULT '#ab00ea', `link` VARCHAR(500) DEFAULT NULL, `is_read` TINYINT DEFAULT 0, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_student_id (student_id), INDEX idx_is_read (is_read), INDEX idx_created_at (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `messenger_updates` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `user_id` INT NOT NULL,
        `conversation_id` INT NOT NULL,
        `update_type` VARCHAR(50) NOT NULL,
        `details` TEXT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_conversation (conversation_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `ticket_updates` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `student_id` INT NOT NULL,
        `ticket_id` VARCHAR(50) NOT NULL,
        `update_type` VARCHAR(50) NOT NULL,
        `details` TEXT NULL,
        `is_admin` TINYINT DEFAULT 0,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_student_id (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `user_seasons` (
        `student_id` INT PRIMARY KEY,
        `season` VARCHAR(50) NOT NULL DEFAULT 'default',
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // === Миграции ===
    try { $pdo->exec("ALTER TABLE common_chat ADD COLUMN file_url VARCHAR(500) NULL DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE common_chat ADD COLUMN file_name VARCHAR(255) NULL DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE common_chat ADD COLUMN file_size INT NULL DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE common_chat ADD COLUMN file_type VARCHAR(100) NULL DEFAULT NULL"); } catch (Exception $e) {}

    try { $pdo->exec("ALTER TABLE chat_messages ADD COLUMN is_forwarded TINYINT DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE chat_messages ADD COLUMN original_author VARCHAR(255) NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE chat_messages ADD COLUMN original_author_id INT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE chat_messages ADD COLUMN original_message_id INT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("CREATE INDEX idx_original_message_id ON chat_messages(original_message_id)"); } catch (Exception $e) {}

    try { $pdo->exec("CREATE INDEX idx_messages_conversation_id ON chat_messages(conversation_id, id)"); } catch (Exception $e) {}
    try { $pdo->exec("CREATE INDEX idx_messages_created_at ON chat_messages(created_at)"); } catch (Exception $e) {}
    try { $pdo->exec("CREATE INDEX idx_participants_conversation ON chat_participants(conversation_id, student_id)"); } catch (Exception $e) {}
    try { $pdo->exec("CREATE INDEX idx_participants_student ON chat_participants(student_id)"); } catch (Exception $e) {}
    try { $pdo->exec("CREATE INDEX idx_conversations_created_at ON chat_conversations(created_at)"); } catch (Exception $e) {}

    try { $pdo->exec("ALTER TABLE titles MODIFY COLUMN rarity VARCHAR(50) NOT NULL DEFAULT 'common'"); } catch (Exception $e) {}
}

function ensureFounderExists($pdo) {
    $stmt = $pdo->prepare("SELECT id FROM users WHERE login = ?");
    $stmt->execute(['SHub']);
    if ($stmt->fetch()) return;

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO users (login, password, role, student_id) VALUES (?, MD5(?), 'founder', 0)");
        $stmt->execute(['SHub', '4321']);
        $userId = $pdo->lastInsertId();
        $negativeId = -$userId;

        $stmt = $pdo->prepare("INSERT INTO students (id, name, group_id, balance, total_earned, infinite_balance) VALUES (?, ?, 0, 0, 0, 1)");
        $stmt->execute([$negativeId, 'SHub']);

        $stmt = $pdo->prepare("UPDATE users SET student_id = ? WHERE id = ?");
        $stmt->execute([$negativeId, $userId]);

        $stmt = $pdo->prepare("INSERT INTO plain_passwords (user_id, plain_password) VALUES (?, ?)");
        $stmt->execute([$userId, '4321']);

        $stmt = $pdo->prepare("SELECT id FROM titles WHERE name = 'Admin'");
        $stmt->execute();
        $adminTitle = $stmt->fetch();
        if ($adminTitle) {
            $stmt = $pdo->prepare("INSERT INTO user_titles (student_id, title_id) VALUES (?, ?)");
            $stmt->execute([$negativeId, $adminTitle['id']]);
            $stmt = $pdo->prepare("INSERT INTO active_titles (student_id, title_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE title_id = ?");
            $stmt->execute([$negativeId, $adminTitle['id'], $adminTitle['id']]);
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Failed to create founder: " . $e->getMessage());
    }
}