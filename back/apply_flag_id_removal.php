<?php

echo "=== 数据库迁移：删除 c_flag_id 字段 ===\n";

// 检查数据库连接配置
$config = [
    'host' => 'localhost',
    'port' => '3306', 
    'database' => 'nads',
    'username' => 'root',
    'password' => 'root'
];

echo "数据库配置:\n";
echo "Host: {$config['host']}:{$config['port']}\n";
echo "Database: {$config['database']}\n";
echo "Username: {$config['username']}\n\n";

try {
    // 创建数据库连接
    $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['database']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    
    echo "✅ 数据库连接成功\n\n";
    
    // 1. 检查 c_flag_submission 表是否存在
    $stmt = $pdo->query("SHOW TABLES LIKE 'c_flag_submission'");
    if ($stmt->rowCount() === 0) {
        echo "❌ 错误：c_flag_submission 表不存在\n";
        exit(1);
    }
    
    echo "✅ c_flag_submission 表存在\n";
    
    // 2. 检查 c_flag_id 字段是否存在
    $stmt = $pdo->query("SHOW COLUMNS FROM c_flag_submission LIKE 'c_flag_id'");
    if ($stmt->rowCount() === 0) {
        echo "⚠️  c_flag_id 字段不存在，无需删除\n";
        exit(0);
    }
    
    echo "✅ c_flag_id 字段存在，准备删除...\n";
    
    // 3. 查看字段信息
    $stmt = $pdo->query("DESCRIBE c_flag_submission");
    $columns = $stmt->fetchAll();
    
    echo "\n📋 当前表结构:\n";
    foreach ($columns as $column) {
        $marker = ($column['Field'] === 'c_flag_id') ? ' 👈 [即将删除]' : '';
        echo "  - {$column['Field']} ({$column['Type']}){$marker}\n";
    }
    
    // 4. 检查外键约束
    $stmt = $pdo->query("
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = '{$config['database']}' 
        AND TABLE_NAME = 'c_flag_submission' 
        AND COLUMN_NAME = 'c_flag_id' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    ");
    $foreignKeys = $stmt->fetchAll();
    
    echo "\n🔗 检查外键约束:\n";
    if (empty($foreignKeys)) {
        echo "  - 无外键约束\n";
    } else {
        foreach ($foreignKeys as $fk) {
            echo "  - 找到外键: {$fk['CONSTRAINT_NAME']}\n";
        }
    }
    
    // 5. 执行删除操作
    echo "\n🔧 开始删除操作...\n";
    
    $pdo->beginTransaction();
    
    try {
        // 删除外键约束（如果存在）
        if (!empty($foreignKeys)) {
            foreach ($foreignKeys as $fk) {
                $constraintName = $fk['CONSTRAINT_NAME'];
                echo "  删除外键约束: $constraintName\n";
                $pdo->exec("ALTER TABLE c_flag_submission DROP FOREIGN KEY `$constraintName`");
            }
        }
        
        // 删除字段
        echo "  删除 c_flag_id 字段\n";
        $pdo->exec("ALTER TABLE c_flag_submission DROP COLUMN c_flag_id");
        
        $pdo->commit();
        
        echo "✅ 删除操作完成！\n";
        
    } catch (Exception $e) {
        $pdo->rollback();
        throw $e;
    }
    
    // 6. 验证删除结果
    $stmt = $pdo->query("SHOW COLUMNS FROM c_flag_submission LIKE 'c_flag_id'");
    if ($stmt->rowCount() === 0) {
        echo "✅ 验证通过：c_flag_id 字段已成功删除\n";
    } else {
        echo "❌ 验证失败：c_flag_id 字段仍然存在\n";
        exit(1);
    }
    
    // 7. 显示最终表结构
    $stmt = $pdo->query("DESCRIBE c_flag_submission");
    $columns = $stmt->fetchAll();
    
    echo "\n📋 更新后的表结构:\n";
    foreach ($columns as $column) {
        echo "  - {$column['Field']} ({$column['Type']})\n";
    }
    
    // 8. 记录迁移到 Laravel migrations 表（如果存在）
    $stmt = $pdo->query("SHOW TABLES LIKE 'migrations'");
    if ($stmt->rowCount() > 0) {
        $migrationName = '2025_09_13_033000_remove_c_flag_id_from_flag_submission_table';
        $stmt = $pdo->prepare("SELECT * FROM migrations WHERE migration = ?");
        $stmt->execute([$migrationName]);
        
        if ($stmt->rowCount() === 0) {
            echo "\n📝 记录迁移历史...\n";
            $pdo->prepare("INSERT INTO migrations (migration, batch) VALUES (?, 1)")
                ->execute([$migrationName]);
            echo "✅ 迁移历史已记录\n";
        }
    }
    
    echo "\n🎉 迁移完成！\n";
    echo "总结：\n";
    echo "- 已删除 c_flag_id 字段\n";
    echo "- 已删除相关的外键约束\n";
    echo "- 数据表结构更新完成\n";
    echo "- 现在可以正常使用更新后的 FlagSubmissionController\n";
    
} catch (PDOException $e) {
    echo "❌ 数据库错误：" . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "❌ 执行错误：" . $e->getMessage() . "\n";
    exit(1);
}
?>