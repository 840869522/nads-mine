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

 Date: 25/07/2025 18:29:01
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for c_permissions
-- ----------------------------
DROP TABLE IF EXISTS `c_permissions`;
CREATE TABLE `c_permissions`  (
  `c_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `c_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`c_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of c_permissions
-- ----------------------------
INSERT INTO `c_permissions` VALUES ('ad', '安全演练分系统');
INSERT INTO `c_permissions` VALUES ('ad_test', '安全演练');
INSERT INTO `c_permissions` VALUES ('databoard_view', '查看仪表盘');
INSERT INTO `c_permissions` VALUES ('edit-categories', 'edit-categories');
INSERT INTO `c_permissions` VALUES ('edit-courses', 'edit-courses');
INSERT INTO `c_permissions` VALUES ('scene', '环境构建分系统');
INSERT INTO `c_permissions` VALUES ('scene_image', '管理镜像');
INSERT INTO `c_permissions` VALUES ('scene_instance', '管理实例');
INSERT INTO `c_permissions` VALUES ('scene_setting', '配置环境');
INSERT INTO `c_permissions` VALUES ('study', '人员测试分系统');
INSERT INTO `c_permissions` VALUES ('study_case', '课程案例');
INSERT INTO `c_permissions` VALUES ('study_learn', '课程学习');
INSERT INTO `c_permissions` VALUES ('study_paper', '人员测试分系统的试卷管理');
INSERT INTO `c_permissions` VALUES ('study_questions', '题库管理');
INSERT INTO `c_permissions` VALUES ('study_test', '在线测试');
INSERT INTO `c_permissions` VALUES ('support', '基础支撑分系统');
INSERT INTO `c_permissions` VALUES ('support_images_manage', '容器镜像管理');
INSERT INTO `c_permissions` VALUES ('support_instances_manage', '容器实例管理');
INSERT INTO `c_permissions` VALUES ('support_permission', '基础支撑权限管理');
INSERT INTO `c_permissions` VALUES ('support_role', '基础支撑角色管理');
INSERT INTO `c_permissions` VALUES ('support_scenario_images_manage', '虚拟机镜像管理');
INSERT INTO `c_permissions` VALUES ('support_scenario_instances_manage', '虚拟机实例管理');
INSERT INTO `c_permissions` VALUES ('support_user', '基础支撑人员管理');
INSERT INTO `c_permissions` VALUES ('support_user_edit-permission', 'edit-permissions');
INSERT INTO `c_permissions` VALUES ('support_user_edit-role', 'edit-roles');
INSERT INTO `c_permissions` VALUES ('support_user_edit-user', 'edit-users');
INSERT INTO `c_permissions` VALUES ('support_user_get-all-permission', 'get-all-permissions');
INSERT INTO `c_permissions` VALUES ('support_user_get-all-role', 'get-all-roles');
INSERT INTO `c_permissions` VALUES ('support_user_get-all-user', 'get-all-users');
INSERT INTO `c_permissions` VALUES ('测', '测额额额额');

SET FOREIGN_KEY_CHECKS = 1;
