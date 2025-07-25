/*
 Navicat Premium Data Transfer

 Source Server         : test
 Source Server Type    : SQLite
 Source Server Version : 3035005
 Source Schema         : main

 Target Server Type    : SQLite
 Target Server Version : 3035005
 File Encoding         : 65001

 Date: 25/07/2025 15:52:38
*/

PRAGMA foreign_keys = false;

-- ----------------------------
-- Table structure for c_permissions
-- ----------------------------
DROP TABLE IF EXISTS "c_permissions";
CREATE TABLE "c_permissions" (
  "c_id" varchar NOT NULL,
  "c_des" varchar(50) NOT NULL,
  "c_api_src" varchar NOT NULL,
  "c_pid" varchar NOT NULL,
  "c_src" varchar NOT NULL,
  "c_is_menu" integer NOT NULL DEFAULT 0,
  "c_label" varchar NOT NULL,
  "c_icon" varchar NOT NULL,
  "c_status" integer NOT NULL DEFAULT 1,
  PRIMARY KEY ("c_id")
);

-- ----------------------------
-- Records of c_permissions
-- ----------------------------
INSERT INTO "c_permissions" VALUES ('databoard_view', '仪表盘', ' ', '0', '/', 1, '仪表盘', 'ChartPieIcon', 1);
INSERT INTO "c_permissions" VALUES ('support', '基础支撑分系统', ' ', '0', ' ', 1, '基础支撑分系统', 'Cog6ToothIcon', 1);
INSERT INTO "c_permissions" VALUES ('support_user', '用户管理', ' ', 'support', '/admin/users', 1, '用户管理', 'UserGroupIcon', 1);
INSERT INTO "c_permissions" VALUES ('support_role', '角色管理', ' ', 'support', '/admin/roles', 1, '角色管理', 'KeyIcon', 1);
INSERT INTO "c_permissions" VALUES ('support_permission', '权限管理', ' ', 'support', '/admin/permissions', 1, '权限管理', 'ArrowLeftEndOnRectangleIcon', 1);
INSERT INTO "c_permissions" VALUES ('support_images_manage', '容器镜像管理', ' ', 'support', '/scenario/images', 1, '容器镜像管理', 'ArchiveBoxIconHero', 1);
INSERT INTO "c_permissions" VALUES ('support_instances_manage', '容器实例管理', ' ', 'support', '/scenario/instances', 1, '容器实例管理', 'CommandLineIcon', 1);
INSERT INTO "c_permissions" VALUES ('support_scenario_images_manage', '虚拟机镜像管理', ' ', 'support', '/scenario/vm-images', 1, '虚拟机镜像管理', 'ArchiveBoxIconHero', 1);
INSERT INTO "c_permissions" VALUES ('support_scenario_instances_manage', '虚拟机实例管理', ' ', 'support', '/scenario/vm-instances', 1, '虚拟机实例管理', 'ComputerDesktopIconHero', 1);
INSERT INTO "c_permissions" VALUES ('10', '环境构建分系统', ' ', '0', ' ', 1, '环境构建分系统', 'AdjustmentsHorizontalIcon', 1);
INSERT INTO "c_permissions" VALUES ('11', '交换机实例', ' ', '10', '/scenario/sceneinstances/all-switches', 1, '交换机实例', 'CubeTransparentIcon', 1);
INSERT INTO "c_permissions" VALUES ('12', '场景实例管理', ' ', '10', '/scenario/sceneinstances', 1, '场景实例管理', 'CubeTransparentIcon', 1);
INSERT INTO "c_permissions" VALUES ('scene_setting', '场景管理', ' ', '10', '/scenario/manage', 1, '场景管理', 'CubeTransparentIcon', 1);
INSERT INTO "c_permissions" VALUES ('14', '安全实验分系统', ' ', '0', ' ', 1, '安全实验分系统', 'ShieldCheckIcon', 1);
INSERT INTO "c_permissions" VALUES ('ad_test', '攻防演练', ' ', '14', '/ad', 1, '攻防演练', 'ShieldCheckIcon', 1);
INSERT INTO "c_permissions" VALUES ('ad', '队伍管理', ' ', '14', '/ad/team', 1, '队伍管理', 'ShieldCheckIcon', 1);
INSERT INTO "c_permissions" VALUES ('study', '人员测试分系统', ' ', '0', ' ', 1, '人员测试分系统', 'AcademicCapIcon', 1);
INSERT INTO "c_permissions" VALUES ('study_test', '在线测验', ' ', 'study', '/learn/quiz', 1, '在线测验', ' QuestionMarkCircleIcon', 1);
INSERT INTO "c_permissions" VALUES ('study_case', '课程案例', ' ', 'study', '/learn/cases', 1, '课程案例', 'FolderOpenIconHero', 1);
INSERT INTO "c_permissions" VALUES ('study_learn', '课程学习', ' ', 'study', '/learn/learn', 1, '课程学习', 'DocumentTextIcon', 1);
INSERT INTO "c_permissions" VALUES ('study_questions', '题库管理', ' ', 'study', '/learn/docs', 1, '题库管理', 'DocumentTextIcon', 1);
INSERT INTO "c_permissions" VALUES ('study_paper', '试卷管理', ' ', 'study', '/learn/paper', 1, '试卷管理', 'DocumentTextIcon', 1);
INSERT INTO "c_permissions" VALUES ('support_user-edit-user', '用户管理-编辑用户', '/api/supoort/user/update', 'support_user', ' ', 0, '修改用户信息', ' ', 1);
INSERT INTO "c_permissions" VALUES ('support_user-reset-password', '用户管理-重置用户密码', '/api/support/user/update_pwd', 'support_user', ' ', 0, '重置用户密码', ' ', 1);
INSERT INTO "c_permissions" VALUES ('support_role-edit-role', '角色管理-修改角色', '/api/support/role/update', 'support-role', ' ', 0, '编辑角色', ' ', 1);

PRAGMA foreign_keys = true;
