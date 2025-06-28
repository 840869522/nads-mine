CREATE TABLE IF NOT EXISTS `c_DOCKER_INSTANCE` (
  `instance_id` VARCHAR(64) NOT NULL COMMENT 'docker container id',
  `user_id` VARCHAR(64) NOT NULL COMMENT 'creator user id',
  `name` VARCHAR(255) DEFAULT NULL COMMENT 'container name',
  `image` VARCHAR(255) NOT NULL COMMENT 'image used',
  `cmd` TEXT COMMENT 'command array json',
  `env` TEXT COMMENT 'environment variables json',
  `ports` TEXT COMMENT 'port mappings json',
  `create_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `update_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`instance_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_docker_instance_user` FOREIGN KEY (`user_id`) REFERENCES `c_USERS`(`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
