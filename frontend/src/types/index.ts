export type UserRole = 'ADMIN' | 'MEMBER';

export interface Profile {
  id: string;
  avatar: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'INVITED' | 'ACTIVE' | 'INACTIVE';
  is_active?: boolean;
  deactivated_at?: string | null;
  profile?: Profile;
  avatar_url?: string | null;
  pending_tasks_count?: number;
  today_tasks_count?: number;
  completed_tasks_count?: number;
  health_score?: number;
  health_status?: 'excellent' | 'healthy' | 'needs_attention' | 'at_risk' | 'critical';
  pending_tasks?: number;
  today_tasks?: number;
  overdue_tasks?: number;
  completed_this_week?: number;
  completed_this_month?: number;
  on_time_completion_rate?: number;
  late_completions?: number;
  completed?: boolean;
  submission_status?: 'PENDING' | 'OVERDUE' | 'COMPLETED_ON_TIME' | 'LATE';
  late_by_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: User[];
  progress: number | null; // null represents "No tasks yet"
  task_count?: number;
  completed_task_count?: number;
}

export interface SubTask {
  id: string;
  task: string;
  name: string;
  status: 'PENDING' | 'COMPLETED';
  completed_by: string | null;
  completed_by_detail?: User | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project: string | null;
  name: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  status: 'PENDING' | 'COMPLETED';
  created_by: string;
  created_by_detail: User;
  completed_by: string | null;
  completed_by_detail?: User | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  subtasks: SubTask[];
  assignees: User[];
  project_detail?: Project | null;
  date_display: string;
  date_color: 'red' | 'amber' | 'green' | 'gray';
  submission_status?: 'PENDING' | 'OVERDUE' | 'COMPLETED_ON_TIME' | 'LATE';
  late_by_minutes?: number;
  due_datetime?: string;
}

export interface ActivityLog {
  id: string;
  user: string;
  user_detail: User;
  action:
    | 'TASK_CREATED'
    | 'TASK_UPDATED'
    | 'TASK_DELETED'
    | 'TASK_ASSIGNED'
    | 'TASK_COMPLETED'
    | 'TASK_REOPENED'
    | 'SUBTASK_CREATED'
    | 'SUBTASK_COMPLETED'
    | 'PROJECT_CREATED'
    | 'PROJECT_UPDATED'
    | 'PROJECT_DELETED'
    | 'PROFILE_UPDATED';
  entity_type: string;
  entity_id: string;
  description: string;
  created_at: string;
}

export interface TeamWorkloadSummary {
  name: string;
  role: UserRole;
  total_pending: number;
  due_today: number;
  overdue_tasks?: number;
  completed_this_week: number;
  completed_this_month: number;
  health_score?: number;
  health_status?: 'excellent' | 'healthy' | 'needs_attention' | 'at_risk' | 'critical';
  on_time_completion_rate?: number;
  email?: string;
  status?: 'INVITED' | 'ACTIVE' | 'INACTIVE';
  is_active?: boolean;
  deactivated_at?: string | null;
  avatar_url?: string | null;
  late_completions?: number;
}

export interface TeamWorkload {
  summary: TeamWorkloadSummary;
  workload: {
    today: Task[];
    tomorrow: Task[];
    yesterday: Task[];
    pending: Task[];
    upcoming: Task[];
    completed: Task[];
  };
}

export interface GlobalSearchResults {
  tasks: Task[];
  projects: Project[];
}
