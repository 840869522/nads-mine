// src/features/flag-submission/types.ts (或直接放在 FlagSubmissionPage.tsx 顶部)

// 通用API响应结构
interface GlobalResponse<T> {
    code: number;
    message: string;
    data: T;
}

// GET /api/scene-instances 响应的数据结构
interface SceneInstance {
    c_scene_instances_id: string;
}

// GET /api/target-instances 响应的数据结构
interface ContainerTargetInstance {
    c_container_id: string;
    type: 'docker';
}

interface VmTargetInstance {
    c_vm_id: number;
    type: 'vm';
}

type TargetInstance = ContainerTargetInstance | VmTargetInstance;

// POST /api/submit-flag 响应的数据结构
interface SubmitFlagResult {
    is_correct: boolean;
    points_earned: number;
    message: string;
}

// GET /api/submission-history 响应中的单条记录数据结构
interface SubmissionHistoryRecord {
    c_submission_id: string;
    c_username: string;
    scene_instance_id: string;
    instance_id: string; // 可能是 c_container_id 或 c_vm_id
    instance_type: 'docker' | 'vm';
    c_submitted_at: string;
    c_submitted_flag: string;
    c_is_correct: 0 | 1;
    c_attempt_count: number;
    c_points_earned: number;
}

// GET /api/scene-instances 和 GET /api/target-instances 响应中的data.data结构
interface PaginatedData<T> {
    data: T[];
    count?: number; // 某些API响应中可能包含总数
}