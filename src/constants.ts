
import { UserRole, Question, DroneNode, DockerContainer, TeamColor, DeviceType, NodeConfig, EdgeConfig, ManagedImage, CourseCase, CourseCaseFileFormat, RunningInstance, InstanceStatus,AppPermission } from './types';

export const APP_NAME = "网络安全实验平台";



export const BACK_IP_PORT = "http://localhost:8000";
export const SCENARIO_FALLBACK_TARGETS = [
  {
    name: "备用节点1",
    host: "10.12.0.101",
    port: "13000",
  },
];

export const APP_PERMISSIONS_CATEGORY = {
  "support": "基础支撑分系统",
  "scene": "环境构建分系统",
  "study": "人员测试分系统",
  "ad": "安全实验分系统",
  "databoard": "仪表盘"
}

export const APP_PERMISSIONS: AppPermission[] = [
  // Dashboard
  { key: 'databoard_view', label: '查看仪表盘' },


  // Personnel Testing System (人员测试分系统)
  {
    key: "study",
    label: "人员测试分系统",
    children: [
      { key: 'study_test', label: '访问在线测验', },
      { key: 'study_case', label: '课程管理', },
      { key: 'study_learn', label: "课程学习" },
      { key: 'study_questions', label: '管理题库', },
    ]
  },

  // Environment Construction System (环境构建分系统)
  {
    key: "scene",
    label: "环境构建分系统",
    children: [
      { key: 'scene_setting', label: '配置环境 (拓扑)' },
      { key: 'scene_image', label: '管理镜像' },
      { key: 'scene_instance', label: '管理实例' },
    ]
  },


  // Security Usage System (安全实验分系统)
  {
    key: "ad",
    label: "安全实验分系统",
    children: [
      { key: 'ad_test', label: '访问安全演练' },
    ]
  },

  // Admin / Base Support System (基础支撑分系统)
  {
    key: "support",
    label: "基础支撑分系统",
    children: [
      {
        key: 'support_user',
        label: '管理用户',
        children: [
          { key: "support_user_get-all-user", label: "查看所有的用户" }
        ]
      },
      { key: 'support_role', label: '管理角色' },
      {key: "support_permission", label: "管理权限"},

      { label: "容器镜像管理", key: 'support_images_manage' }, // Moved here and renamed
      { label: "容器实例管理", key: 'support_instances_manage' }, // Moved here and renamed
      { label: "虚拟机镜像管理", key: 'support_scenario_images_manage' },
      { label: "虚拟机实例管理", key: 'support_scenario_instances_manage' },
      { label: "系统资源详情", key: 'support_system_resources' }
    ]
  }
];


export const USER_ROLES_CONFIG: Record<UserRole, { name: string; permissions: string[] }> = {
  [UserRole.ADMIN]: {
    name: "管理员",
    permissions: APP_PERMISSIONS.map(p => p.key) // Admin gets all permissions by default
  },
  [UserRole.STUDENT]: {
    name: "学生",
    permissions: [
      'DASHBOARD_VIEW',
      'LEARN_QUIZ_ACCESS',
      'LEARN_CASES_ACCESS',
      'SCENARIO_ENVIRONMENTS_CONFIG', // Assuming students can view/configure some environments
      'SCENARIO_IMAGES_MANAGE',       // Assuming students can view images
      'SCENARIO_INSTANCES_MANAGE',    // Assuming students can view their instances
      'DRILL_ACCESS'
    ]
  },
  [UserRole.ATTACKER]: {
    name: "攻击方 (红队)",
    permissions: [
      'DASHBOARD_VIEW',
      'DRILL_ACCESS'
    ]
  },
  [UserRole.DEFENDER]: {
    name: "防御方 (蓝队)",
    permissions: [
      'DASHBOARD_VIEW',
      'DRILL_ACCESS'
    ]
  },
};


export const GetUserRole = (data: []) => {
  const role_data = data?.map(item => item === "admin" && USER_ROLES_CONFIG[UserRole.ADMIN] || null).filter(Boolean);
  return role_data;
}

export const MOCK_QUESTIONS: Question[] = [
  { id: 'q1', text: '无人机中飞行控制器的主要用途是什么？', type: 'short-answer' },
  { id: 'q2', text: '哪个频段通常用于无人机控制和视频传输？', type: 'multiple-choice', options: ['2.4 GHz', '5.8 GHz', '900 MHz', 'A和B两者皆是'] },
  { id: 'q3', text: '在无人机安全背景下解释“GPS欺骗”的概念。', type: 'short-answer' },
  { id: 'q4', text: '在无人机操作中，“BVLOS”代表什么？', type: 'short-answer' },
  { id: 'q5', text: '无人机中另一个飞行控制器的主要用途是什么？', type: 'short-answer' },
  { id: 'q6', text: '哪个是备用频段通常用于无人机控制和视频传输？', type: 'multiple-choice', options: ['2.4 GHz', '5.8 GHz', '900 MHz', 'A和B两者皆是'] },
  { id: 'q7', text: '在无人机安全背景下重新解释“GPS欺骗”的概念。', type: 'short-answer' },
  { id: 'q8', text: '在无人机操作中，“BVLOS”到底代表什么？', type: 'short-answer' },
  { id: 'q9', text: '无人机中飞行控制器的附加用途是什么？', type: 'short-answer' },
  { id: 'q10', text: '还有哪个频段通常用于无人机控制和视频传输？', type: 'multiple-choice', options: ['2.4 GHz', '5.8 GHz', '900 MHz', 'A和B两者皆是'] },
  { id: 'q11', text: '在无人机安全背景下详细解释“GPS欺骗”的概念。', type: 'short-answer' },
  { id: 'q12', text: '在无人机操作中，“BVLOS”究竟代表什么？', type: 'short-answer' },
];

export const INITIAL_DRONE_NODES: DroneNode[] = [
  { id: 'node-001', name: '阿尔法基地', status: 'online', ipAddress: '192.168.1.10' },
  { id: 'node-002', name: '布拉沃中继', status: 'offline', ipAddress: '192.168.1.11' },
  { id: 'node-003', name: '查理点', status: 'online', ipAddress: '192.168.1.12' },
  { id: 'node-004', name: '德尔塔哨所', status: 'online', ipAddress: '192.168.1.13' },
];

export const INITIAL_DOCKER_CONTAINERS: DockerContainer[] = [
  { id: 'container-a1', nodeId: 'node-001', name: '防火墙服务', image: 'firewall:latest', status: 'running' },
  { id: 'container-a2', nodeId: 'node-001', name: '通信中继', image: 'comms:v2', status: 'running' },
  { id: 'container-c1', nodeId: 'node-003', name: '传感器阵列API', image: 'sensors:stable', status: 'stopped' },
];

export const INITIAL_MANAGED_IMAGES: ManagedImage[] = [
  {
    id: 'img-docker-001',
    name: '基础Ubuntu镜像',
    type: 'docker',
    version: '22.04',
    description: '官方Ubuntu 22.04 LTS基础镜像，用于通用容器化应用。',
    fileName: 'ubuntu-22.04.tar.gz',
    size: '75 MB',
    uploadDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
  },
  {
    id: 'img-vm-001',
    name: 'Windows Server 2019',
    type: 'vm',
    version: '1903',
    description: '标准版Windows Server 2019虚拟机镜像，包含IIS。',
    fileName: 'win-server-2019.qcow2',
    size: '12.5 GB',
    uploadDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
  },
  {
    id: 'img-docker-002',
    name: 'Nginx Web服务器',
    type: 'docker',
    version: '1.21-alpine',
    description: '轻量级Nginx服务器，基于Alpine Linux。',
    fileName: 'nginx-alpine.tar',
    size: '22 MB',
    uploadDate: new Date().toISOString(),
  },
];

export const INITIAL_RUNNING_INSTANCES: RunningInstance[] = [
  {
    id: 'inst-container-001',
    name: 'Web服务器 (nginx-alpha)',
    type: 'container',
    status: 'running',
    ipAddress: '10.1.0.5',
    imageName: 'nginx:1.21-alpine',
    cpuUsage: '5%',
    memoryUsage: '64MB / 512MB',
    diskUsage: '500MB / 2GB',
    uptime: '2h 30m 15s',
    nodeId: 'node-001', // Example link to a drone node
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2.5).toISOString(),
  },
  {
    id: 'inst-vm-001',
    name: '数据库服务器 (PostgreSQL)',
    type: 'vm',
    status: 'running',
    ipAddress: '10.1.0.10',
    imageName: 'ubuntu-22.04-psql.qcow2',
    cpuUsage: '15%',
    memoryUsage: '1.2GB / 4GB',
    diskUsage: '25GB / 100GB',
    uptime: '5d 4h 10m',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5 - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'inst-container-002',
    name: 'API网关 (api-gateway-prod)',
    type: 'container',
    status: 'running',
    ipAddress: '10.1.0.6',
    imageName: 'custom-gateway:v2.3',
    cpuUsage: '22%',
    memoryUsage: '256MB / 1GB',
    diskUsage: '1GB / 5GB',
    uptime: '10h 5m 30s',
    nodeId: 'node-003',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
  },
  {
    id: 'inst-vm-002',
    name: '开发环境 (Win10-Dev)',
    type: 'vm',
    status: 'stopped',
    ipAddress: '10.1.0.11',
    imageName: 'windows-10-dev.vdi',
    cpuUsage: '0%',
    memoryUsage: '0MB / 8GB',
    diskUsage: '40GB / 150GB',
    uptime: '0s',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: 'inst-container-003',
    name: '数据处理Worker (worker-beta)',
    type: 'container',
    status: 'error',
    ipAddress: '10.1.0.7',
    imageName: 'data-processor:0.9-buggy',
    cpuUsage: '1%',
    memoryUsage: '32MB / 256MB',
    diskUsage: '100MB / 1GB',
    uptime: '1m 5s (before error)',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];


export const STATUS_TRANSLATIONS: Record<DroneNode['status'] | DockerContainer['status'] | InstanceStatus, string> = {
  'online': "在线",
  'offline': "离线",
  'compromised': "被入侵",
  'under-attack': "受攻击",
  'running': "运行中",
  'stopped': "已停止",
  'paused': "已暂停",
  'error': "错误",
  'starting': "启动中",
  'stopping': "停止中",
  'deleting': "删除中",
};

export const TEAM_COLOR_TRANSLATIONS: Record<TeamColor, string> = {
  [TeamColor.RED]: "红队",
  [TeamColor.BLUE]: "蓝队"
};

export const TOPOLOGY_DEVICE_TYPES: { type: DeviceType, name: string }[] = [
  { type: 'container', name: '容器' },
  { type: 'switch', name: '交换机' },
  { type: 'virtual_machine', name: '虚拟机' },
  { type: 'nat_bridge', name: 'NAT网桥' },
  { type: 'router', name: '路由器' },
];

export const DEFAULT_NODE_CONFIG: Record<DeviceType, NodeConfig> = {
  container: {
    deviceName: '容器',
    Image: '',
    // portMappings: '80:80',
    env: 'ELASTICSEARCH_HOST=10.100.88.88,ELASTICSEARCH_PORT=9200,TZ=Asia/Shanghai,ZEEK_ENABLED=1,SYSDIG_ENABLED=1'
  },
  switch: {
    deviceName: '交换机',
    Image: 'switch-os:latest',
    portMappings: ''
  },
  virtual_machine: {
    deviceName: '虚拟机',
    Image: '',
    portMappings: '',
    env: 'ELASTICSEARCH_HOST=10.100.88.88,ELASTICSEARCH_PORT=9200,TZ=Asia/Shanghai,ZEEK_ENABLED=1,SYSDIG_ENABLED=1'
  },
  nat_bridge: {
    deviceName: 'NAT网桥',
    Image: 'nat-bridge:latest',
    portMappings: ''
  },
  router: {
    deviceName: '路由器',
    Image: 'router-os:latest',
    portMappings: ''
  }
};

export const DEFAULT_EDGE_CONFIG: EdgeConfig = {
  sourceInterface: 'eth0',
  sourceIp: '10.0.0.1/24',
  targetInterface: 'eth0',
  targetIp: '10.0.0.2/24'
};

// 流量模拟和镜像相关镜像名称
export const TRAFFIC_SIMULATION_IMAGES = {
  SURICATA: 'suricata:v2',
  IPERF: 'iperf-docker:v1'
} as const;

// 流量镜像相关镜像名称
export const TRAFFIC_MIRRORING_IMAGES = {
  SURICATA: 'suricata:v2'
} as const;

// 特殊镜像列表 - 这些镜像的容器可以连接任何节点
export const SPECIAL_IMAGES = [
  '*',
  'routertar2:v1',
  'router:v1.1',
  'frr-ubuntu20:latest',
  'px4-mitm-f:latest',
  'ntop/ntopng:latest',
  'web:latest',
  'px4-temp1:latest',
  'px4-temp2:latest',
  'px4-temp3:latest',
  'px4-temp4:latest',

  // 可以在这里添加更多特殊镜像
] as const;

export const NODE_SIZE = 60;
export const NODE_ICON_SIZE = 30;

// For Course Cases
export const COURSE_CASE_CATEGORIES: string[] = [
  "信息科学技术基础",
  "信息安全基础",
  "密码学",
  "计算机信息系统安全",
  "移动终端安全",
  "软件安全",
  "网络安全",
  "信息内容安全",
  "CTF 安全攻防",
  "训练靶场"
];

export const MOCK_COURSE_CASES: CourseCase[] = [
  {
    id: 'cc_001',
    title: '网络协议分析入门',
    description: '介绍TCP/IP协议栈基础，以及如何使用Wireshark进行网络抓包分析。适合初学者了解网络通信原理。',
    category: '网络安全',
    uploadDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
    files: [
      { id: 'f_001_01', name: '网络协议详解.pdf', format: 'pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', size: '2.5 MB' },
      { id: 'f_001_02', name: 'Wireshark入门教程.mp4', format: 'mp4', url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4', size: '1.0 MB' }, // Adjusted size for example
    ],
  },
  {
    id: 'cc_002',
    title: 'Android应用安全基础',
    description: '探讨Android应用常见的安全漏洞，如权限滥用、数据泄露等，并介绍基本的防护措施。',
    category: '移动终端安全',
    uploadDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
    files: [
      { id: 'f_002_01', name: 'Android安全开发指南.docx', format: 'docx', url: '', size: '0.8 MB' },
    ],
  },
  {
    id: 'cc_003',
    title: '密码学原理与实践',
    description: '深入讲解对称加密、非对称加密、哈希函数等核心密码学概念及其在现代安全系统中的应用。',
    category: '密码学',
    uploadDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
    files: [
      { id: 'f_003_01', name: '现代密码学导论.pdf', format: 'pdf', url: '', size: '4.1 MB' },
      { id: 'f_003_02', name: 'RSA算法演示.pptx', format: 'pptx', url: '', size: '1.2 MB' },
    ],
  },
];

export const SUPPORTED_COURSE_RESOURCE_FORMATS: Record<CourseCaseFileFormat, string> = {
  pdf: '.pdf',
  mp4: '.mp4',
  avi: '.avi',
  pptx: '.pptx',
  docx: '.docx',
  doc: '.doc',
  jpg: '.jpg',
  jpeg: '.jpeg',
  png: '.png',
  other: '*/*'
};
