/*
 Navicat Premium Data Transfer

 Source Server         : php-mysql57
 Source Server Type    : MySQL
 Source Server Version : 50744
 Source Host           : 10.12.0.101:3306
 Source Schema         : nads

 Target Server Type    : MySQL
 Target Server Version : 50744
 File Encoding         : 65001

 Date: 25/07/2025 18:28:32
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for c_roles_permissions
-- ----------------------------
DROP TABLE IF EXISTS `c_roles_permissions`;
CREATE TABLE `c_roles_permissions`  (
  `c_role_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `c_permission_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`c_role_id`, `c_permission_id`) USING BTREE,
  INDEX `c_permission_id`(`c_permission_id`) USING BTREE,
  CONSTRAINT `c_roles_permissions_ibfk_1` FOREIGN KEY (`c_role_id`) REFERENCES `c_roles` (`c_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `c_roles_permissions_ibfk_2` FOREIGN KEY (`c_permission_id`) REFERENCES `c_permissions` (`c_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of c_roles_permissions
-- ----------------------------
INSERT INTO `c_roles_permissions` VALUES ('admin', 'ad');
INSERT INTO `c_roles_permissions` VALUES ('test12', 'ad');
INSERT INTO `c_roles_permissions` VALUES ('2', 'ad_test');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'ad_test');
INSERT INTO `c_roles_permissions` VALUES ('attacker', 'ad_test');
INSERT INTO `c_roles_permissions` VALUES ('defender', 'ad_test');
INSERT INTO `c_roles_permissions` VALUES ('student', 'ad_test');
INSERT INTO `c_roles_permissions` VALUES ('test12', 'ad_test');
INSERT INTO `c_roles_permissions` VALUES ('2', 'databoard_view');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'databoard_view');
INSERT INTO `c_roles_permissions` VALUES ('student', 'databoard_view');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'databoard_view');
-- INSERT INTO `c_roles_permissions` VALUES ('admin', 'edit-categories');
-- INSERT INTO `c_roles_permissions` VALUES ('admin', 'edit-courses');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'scene');
-- INSERT INTO `c_roles_permissions` VALUES ('admin', 'scene_image');
-- INSERT INTO `c_roles_permissions` VALUES ('student', 'scene_image');
-- INSERT INTO `c_roles_permissions` VALUES ('admin', 'scene_instance');
-- INSERT INTO `c_roles_permissions` VALUES ('student', 'scene_instance');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'scene_setting');
INSERT INTO `c_roles_permissions` VALUES ('student', 'scene_setting');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'study');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'study');
INSERT INTO `c_roles_permissions` VALUES ('2', 'study_case');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'study_case');
INSERT INTO `c_roles_permissions` VALUES ('attacker', 'study_case');
INSERT INTO `c_roles_permissions` VALUES ('defender', 'study_case');
INSERT INTO `c_roles_permissions` VALUES ('student', 'study_case');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'study_case');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'study_learn');
INSERT INTO `c_roles_permissions` VALUES ('student', 'study_learn');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'study_learn');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'study_paper');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'study_questions');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'study_questions');
INSERT INTO `c_roles_permissions` VALUES ('2', 'study_test');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'study_test');
INSERT INTO `c_roles_permissions` VALUES ('attacker', 'study_test');
INSERT INTO `c_roles_permissions` VALUES ('defender', 'study_test');
INSERT INTO `c_roles_permissions` VALUES ('student', 'study_test');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'study_test');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'support');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'support');
INSERT INTO `c_roles_permissions` VALUES ('test12', 'support');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'support_images_manage');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'support_images_manage');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'support_instances_manage');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'support_instances_manage');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'support_permission');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'support_permission');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'support_role');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'support_role');
INSERT INTO `c_roles_permissions` VALUES ('test12', 'support_role');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'support_scenario_images_manage');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'support_scenario_images_manage');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'support_scenario_instances_manage');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'support_scenario_instances_manage');
INSERT INTO `c_roles_permissions` VALUES ('admin', 'support_user');
INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'support_user');
INSERT INTO `c_roles_permissions` VALUES ('test12', 'support_user');
-- INSERT INTO `c_roles_permissions` VALUES ('admin', 'support_user_get-all-user');
-- INSERT INTO `c_roles_permissions` VALUES ('test_roles_permission', 'support_user_get-all-user');

SET FOREIGN_KEY_CHECKS = 1;
