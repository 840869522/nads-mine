
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

//场景node编辑
export interface NodeConfig {
  deviceName: string;
  dockerImage: string;
  portMappings: string;
  env?: string; // <--- 新增此行，设为可选
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

// New types for Course Cases
export type CourseCaseFileFormat = 'pdf' | 'pptx' | 'docx' | 'mp4' | 'avi' | 'other';

export interface CourseCaseFile {
  id: string;
  name: string;
  format: CourseCaseFileFormat;
  url: string; // For local preview: URL.createObjectURL(file), for storage: actual file path/URL
  size?: string; // e.g., "1.2 MB"
  fileObject?: File; // Temporary storage of the actual file object for upload
}

export interface CourseCase {
  id: string;
  title: string;
  description: string;
  category: string; // Matches one of COURSE_CASE_CATEGORIES
  uploadDate: string; // ISO string date
  files: CourseCaseFile[];
}

// New type for Running Instances
export type InstanceStatus = 'running' | 'paused' | 'stopped' | 'error' | 'starting' | 'stopping' | 'deleting';

export interface RunningInstance {
  id: string;
  name: string;
  type: string; // <-- 这里被修改，以支持 '虚拟机', '容器', '交换机' 等多种类型
  ipAddress: string;
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
