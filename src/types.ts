
export interface User {
  c_id: string;
  c_username: string;
  role: string[];
}

export enum UserRole {
  ADMIN = 'admin',
  STUDENT = 'student',
  ATTACKER = 'attacker',
  DEFENDER = 'defender',
}

export interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'short-answer';
  options?: string[];
}

export interface GeminiEvaluationResult {
  score: number;
  explanation: string;
  feedback: string;
}

export interface DroneNode {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'compromised' | 'under-attack';
  ipAddress: string;
  assignedTeam?: TeamColor;
}

export interface DockerContainer {
  id: string;
  name: string;
  nodeId: string;
  image: string;
  status: 'running' | 'stopped' | 'error';
}

export enum TeamColor {
  RED = 'Red',
  BLUE = 'Blue',
}

export interface Team {
  color: TeamColor;
  members: User[];
  nodes: DroneNode[];
}

export interface AttackLogEntry {
  id: string;
  timestamp: Date;
  team: TeamColor;
  action: string;
  target?: string;
  result?: 'success' | 'failure' | 'pending';
}

export type DeviceType =
  | 'container'
  | 'switch'
  | 'virtual_machine'
  | 'nat_bridge'
  | 'router';

// 1. 定义 Iptables 规则接口
export interface IptablesRule {
  hostPort: string;
  instanceName: string;
  instancePort: string;
}

//场景node编辑
export interface TeamAssignment {
  id: number | string;
  name: string;
}

export interface NodeConfig {
  deviceName: string;
  Image?: string;
  portMappings?: string;
  env?: string;
  isTarget?: boolean;
  iptablesRules?: IptablesRule[]; // 用于存储iptables规则
  // 虚拟机资源配置
  memory?: string; // 内存大小 (MB)
  cpu?: string; // CPU核心数
  diskSize?: string; // 磁盘大小 (GB)
  teamId?: string;
  teamAssignment?: TeamAssignment;
}
export interface TopologyNode {
  id: string;
  type: DeviceType;
  label: string;
  x: number;
  y: number;
  config: NodeConfig;
}

export interface EdgeConfig {
  sourceInterface: string;
  sourceIp: string;
  targetInterface: string;
  targetIp: string;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  config: EdgeConfig;
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export type TopologyActionType =
  | 'ADD_NODE'
  | 'DELETE_NODE'
  | 'MOVE_NODE'
  | 'UPDATE_NODE_CONFIG'
  | 'ADD_EDGE'
  | 'DELETE_EDGE'
  | 'UPDATE_EDGE_CONFIG'
  | 'BATCH_DELETE'
  | 'SELECT_ELEMENT'
  | 'CLEAR_SELECTION'
  | 'START_LINKING'
  | 'LOAD_TOPOLOGY';

export interface TopologyAction {
  type: TopologyActionType;
  payload: any;
}

export interface ManagedImage {
  id: string;
  name: string;
  type: 'docker' | 'vm';
  version: string;
  description: string;
  fileName?: string;
  size?: string; // e.g., "1.2 GB", "500 MB" (simulated)
  uploadDate: string; // ISO string date
}

export interface CourseCase {
  c_course_id: string;
  c_course_name: string;
  c_description: string;
  c_category_id: string;
  c_category_name: string;
  resources: CourseCaseResource[];
  experiments?: Experiment[];
  created_at: string;
  c_status?: 'draft' | 'published';
  highlightedTitle?: string;
  highlightedDescription?: string;
}

export interface CourseCaseResource {
  c_resource_id: string;
  c_resource_name: string;
  c_type: CourseCaseResourceFormat;
  c_resource_path: string;
  c_size?: string;
  fileObject?: File;
  isExperimentResource?: boolean; // 新增标志，区分课程资源和实验资源
}
export interface Category {
  c_category_id: string;
  c_category_name: string;
}
export type CourseCaseResourceFormat = 'pdf' | 'mp4' | 'avi' | 'pptx' | 'docx' | 'other' | 'png' | 'jpeg' | 'jpg' | 'doc';
export interface Experiment {
  c_experiment_id: string;
  c_experiment_name: string;
  c_description?: string;
  c_config_id: number;
  c_name?: string;
  c_scene_config_id?: number; // 新增：用于场景分系统的 scenario_id
  status?: InstanceStatus; // 新增：实验的运行状态
  resources: CourseCaseResource[];
  created_at: string;
}
// New type for Running Instances
export type InstanceStatus = 'running' | 'paused' | 'stopped' | 'error' | 'starting' | 'stopping' | 'deleting';

export interface RunningInstance {
  id: string;
  name: string;
  type: string; // <-- 这里被修改，以支持 '虚拟机', '容器', '交换机' 等多种类型
  /** 实例的 IP 地址 */
  ipAddress?: string;
  /** 关联的场景实例 ID */
  scene_instance_id?: string;
  /** 关联场景的名称 */
  scene_name?: string;
  status: InstanceStatus;
  /** 端口映射，如 "80->8080" */
  ports?: string;
  imageName: string;
  cpuUsage: string;
  memoryUsage: string;
  diskUsage?: string;
  uptime: string;
  nodeId?: string;
  createdAt: string;
}


export interface AppPermission {
  key: string;
  label: string;
  children?: AppPermission[] | null;
}

export interface NavItemType {
  to?: string;
  label: string;
  icon: React.ElementType;
  children?: NavItemType[];
  requiredPermission?: string; // New: specific permission key required
}
