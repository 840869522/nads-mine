import { UserRole } from '@/types';

export const defaultPermissions = [
  { key: 'DASHBOARD_VIEW', label: '查看仪表盘', category: '仪表盘' },
  { key: 'LEARN_QUIZ_ACCESS', label: '访问在线测验', category: '人员测试分系统' },
  { key: 'LEARN_CASES_ACCESS', label: '访问课程案例', category: '人员测试分系统' },
  { key: 'LEARN_QUESTION_BANK_MANAGE', label: '管理题库', category: '人员测试分系统' },
  { key: 'SCENARIO_ENVIRONMENTS_CONFIG', label: '配置环境 (拓扑)', category: '环境构建分系统' },
  { key: 'SCENARIO_IMAGES_MANAGE', label: '管理镜像', category: '环境构建分系统' },
  { key: 'SCENARIO_INSTANCES_MANAGE', label: '管理实例', category: '环境构建分系统' },
  { key: 'DRILL_ACCESS', label: '访问安全演练', category: '安全实验分系统' },
  { key: 'ADMIN_USERS_MANAGE', label: '管理用户', category: '基础支撑分系统' },
  { key: 'ADMIN_ROLES_MANAGE', label: '管理角色与权限', category: '基础支撑分系统' },
];

export const defaultRoles: Record<UserRole, { name: string; permissions: string[] }> = {
  [UserRole.ADMIN]: {
    name: '管理员',
    permissions: defaultPermissions.map(p => p.key),
  },
  [UserRole.STUDENT]: {
    name: '学生',
    permissions: [
      'DASHBOARD_VIEW',
      'LEARN_QUIZ_ACCESS',
      'LEARN_CASES_ACCESS',
      'SCENARIO_ENVIRONMENTS_CONFIG',
      'SCENARIO_IMAGES_MANAGE',
      'SCENARIO_INSTANCES_MANAGE',
      'DRILL_ACCESS',
    ],
  },
  [UserRole.ATTACKER]: {
    name: '攻击方 (红队)',
    permissions: ['DASHBOARD_VIEW', 'DRILL_ACCESS'],
  },
  [UserRole.DEFENDER]: {
    name: '防御方 (蓝队)',
    permissions: ['DASHBOARD_VIEW', 'DRILL_ACCESS'],
  },
};

export const sampleQuestions = [
  // id 字段被完全移除
  { text: '无人机中飞行控制器的主要用途是什么？', type: 'short-answer' },
  {
    text: '哪个频段通常用于无人机控制和视频传输？',
    type: 'multiple-choice',
    options: JSON.stringify(['2.4 GHz', '5.8 GHz', '900 MHz', 'A和B两者皆是'])
  },
  {
    text: 'GPS在无人机导航中的作用是什么？',
    type: 'short-answer'
  },
  {
    text: '选择安全起降区域时应考虑哪些因素？',
    type: 'short-answer'
  },
];

export const sampleImages = [
  { id: 'img-docker-001', name: '基础Ubuntu镜像', type: 'docker', version: '22.04', description: '官方Ubuntu 22.04 LTS基础镜像，用于通用容器化应用。', fileName: 'ubuntu-22.04.tar.gz', size: '75 MB', uploadDate: new Date().toISOString() },
  { id: 'img-docker-002', name: 'Nginx服务器镜像', type: 'docker', version: '1.25', description: '预装Nginx的轻量化Web服务镜像。', fileName: 'nginx-1.25.tar.gz', size: '25 MB', uploadDate: new Date().toISOString() },
  { id: 'img-vm-001', name: 'Ubuntu桌面环境', type: 'vm', version: '20.04', description: '带GUI的教学用虚拟机镜像。', fileName: 'ubuntu-desktop-20.04.qcow2', size: '4 GB', uploadDate: new Date().toISOString() },
];

export const sampleCourseCases = [
  { id: 'cc_001', title: '网络协议分析入门', description: '介绍TCP/IP协议栈基础，以及如何使用Wireshark进行网络抓包分析。', category: '网络安全', uploadDate: new Date().toISOString(), files: [ { id: 'f_001', name: '网络协议详解.pdf', format: 'pdf', url: '', size: '2 MB' } ] },
  { id: 'cc_002', title: '无线电频谱管理', description: '阐述无人机常用频段以及频谱干扰应对策略。', category: '通信安全', uploadDate: new Date().toISOString(), files: [ { id: 'f_002', name: '频谱分析报告.docx', format: 'docx', url: '', size: '1 MB' } ] },
];

export const sampleInstances = [
  { id: 'inst-vm-001', name: '数据库服务器', type: 'vm', status: 'running', ports: '22', imageName: 'ubuntu-22.04-psql.qcow2', cpuUsage: '10%', memoryUsage: '1GB/4GB', diskUsage: '20GB/100GB', uptime: '1d', nodeId: null, createdAt: new Date().toISOString() },
  { id: 'inst-docker-001', name: 'Web演示容器', type: 'docker', status: 'stopped', ports: '80->8080', imageName: 'nginx-1.25.tar.gz', cpuUsage: '0%', memoryUsage: '0/512MB', diskUsage: '0/1GB', uptime: '0', nodeId: null, createdAt: new Date().toISOString() },
];
