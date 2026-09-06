export type UserRole = 'ORG_ADMIN' | 'ADMIN' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
  display_name?: string | null;
  effective_name?: string;
  slug: string;
  logo_url: string | null;
  description?: string | null;
  enable_task_types?: boolean;
  weekly_capacity_hours?: number;
  is_active?: boolean;
  created_at?: string;
  role?: UserRole;
}

export interface OrganizationMembership {
  id: string;
  user: User;
  role: UserRole;
  is_active: boolean;
  joined_at: string;
  created_at: string;
}

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
  health_status?: 'excellent' | 'healthy' | 'needs_attention' | 'at_risk' | 'critical' | 'no_data';
  pending_tasks?: number;
  today_tasks?: number;
  tomorrow_tasks?: number;
  overdue_tasks?: number;
  completed_this_week?: number;
  completed_this_month?: number;
  on_time_completion_rate?: number;
  late_completions?: number;
  workload_percentage?: number;
  workload_status?: string;
  total_allocated_hours?: number;
  completed_allocated_hours?: number;
  capacity_hours?: number;
  completed?: boolean;
  submission_status?: 'PENDING' | 'OVERDUE' | 'COMPLETED_ON_TIME' | 'LATE';
  late_by_minutes?: number;
  created_at: string;
  updated_at: string;
  has_password?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  project_date?: string | null;
  client?: string | null;
  client_name?: string | null;
  client_display_name?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: User[];
  progress: number | null; // null represents "No tasks yet"
  task_count?: number;
  completed_task_count?: number;
}

export interface SubTaskAssignee {
  user: User;
  completed: boolean;
  completed_at: string | null;
  submission_status: 'PENDING' | 'OVERDUE' | 'COMPLETED_ON_TIME' | 'LATE';
  late_by_minutes: number;
}

export interface SubTask {
  id: string;
  task: string;
  name: string;
  status: 'PENDING' | 'COMPLETED';
  due_date: string | null;
  due_time: string | null;
  due_datetime: string | null;
  completed_by: string | null;
  completed_by_detail?: User | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignees: SubTaskAssignee[];
  submission_status: 'PENDING' | 'OVERDUE' | 'COMPLETED_ON_TIME' | 'LATE';
  late_by_minutes: number;
}

export interface TaskType {
  id: string;
  name: string;
  description: string | null;
  allocated_seconds: number;
  allocated_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  enable_task_types: boolean;
  weekly_capacity_hours: number;
}

export interface MemberWorkload {
  member_id: string;
  user: User;
  total_tasks_count: number;
  active_tasks_count: number;
  completed_tasks_count: number;
  total_allocated_seconds: number;
  completed_allocated_seconds: number;
  remaining_allocated_seconds: number;
  total_tracked_seconds: number;
  total_allocated_hours: number;
  completed_allocated_hours: number;
  remaining_allocated_hours: number;
  total_tracked_hours: number;
  unestimated_task_count: number;
  capacity_hours: number;
  workload_percentage: number;
  workload_status: 'Underloaded' | 'Balanced' | 'High' | 'Overloaded';
}

export interface Task {
  id: string;
  project: string | null;
  name: string;
  description: string | null;
  due_date: string;
  dates?: string[];
  due_time: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
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
  overall_status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  is_subtask?: boolean;
  parent_task_id?: string;
  parent_task_name?: string;

  // Task Type & Timer fields
  task_type?: string | null;
  task_type_detail?: TaskType | null;
  allocated_seconds?: number | null;
  elapsed_seconds?: number;
  timer_started_at?: string | null;
  timer_status?: 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  actual_duration_seconds?: number | null;
  current_elapsed_seconds?: number;
  remaining_seconds?: number;
  is_overtime?: boolean;
  overtime_seconds?: number;
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
  pending_tasks?: number;
  today_tasks?: number;
  tomorrow_tasks?: number;
  total_pending: number;
  due_today: number;
  due_tomorrow?: number;
  overdue_tasks?: number;
  completed_this_week: number;
  completed_this_month: number;
  health_score?: number;
  health_status?: 'excellent' | 'healthy' | 'needs_attention' | 'at_risk' | 'critical' | 'no_data';
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

export interface TaskComment {
  id: string;
  task: string;
  subtask: string | null;
  author: string;
  author_detail: User;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task: string;
  subtask: string | null;
  file: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_by: string;
  uploaded_by_detail: User;
  download_url: string;
  created_at: string;
  updated_at: string;
}

export type KeepItemType = 'FOLDER' | 'DOCUMENT' | 'NOTE' | 'SPREADSHEET' | 'FILE';
export type KeepAccessLevel = 'ONLY_ME' | 'YOU_AND_ADMINS' | 'EVERYONE' | 'SPECIFIC';
export type KeepRole = 'VIEW' | 'EDIT';

export interface KeepCellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  color?: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  type?: 'text' | 'number' | 'currency' | 'percentage' | 'date';
}

export interface KeepCellData {
  value: string;
  formula?: string;
  format?: KeepCellFormat;
}

export interface KeepSheet {
  id: string;
  name: string;
  frozenRows?: number;
  frozenCols?: number;
  cells: Record<string, KeepCellData>;
  rowHeights?: Record<number, number>;
  colWidths?: Record<number, number>;
}

export interface KeepSpreadsheetData {
  sheets: KeepSheet[];
}

export interface KeepItem {
  id: string;
  item_type: KeepItemType;
  name: string;
  version: number;
  owner: string;
  owner_name?: string;
  organization?: string | null;
  parent_folder?: string | null;
  document_content?: string;
  spreadsheet_data?: KeepSpreadsheetData;
  file?: string | null;
  file_url?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  original_filename?: string | null;
  original_import_filename?: string | null;
  original_import_format?: string | null;
  imported_by?: string | null;
  imported_at?: string | null;
  import_warnings?: string[];
  is_deleted: boolean;
  deleted_at?: string | null;
  created_by: string;
  created_by_name?: string;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
}

export interface KeepPermission {
  id: string;
  item: string;
  user?: string | null;
  user_email?: string;
  user_name?: string;
  access_level: KeepAccessLevel;
  role: KeepRole;
  created_at: string;
}

export interface KeepShareLink {
  id: string;
  item: string;
  token: string;
  permission: KeepRole;
  is_active: boolean;
  expires_at?: string | null;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  revoked_at?: string | null;
}

export interface KeepVersionHistory {
  id: string;
  item: string;
  author?: string | null;
  author_name?: string;
  version_number: number;
  content_snapshot?: string;
  spreadsheet_snapshot?: KeepSpreadsheetData;
  created_at: string;
}

export interface KeepAuditLog {
  id: string;
  item?: string | null;
  item_name?: string;
  user?: string | null;
  user_name?: string;
  action: string;
  description: string;
  timestamp: string;
}

export type ClientStatus = 'ACTIVE' | 'INACTIVE';

export type AssetType =
  | 'BRAND_GUIDELINES'
  | 'LOGO'
  | 'LOGO_VARIATION'
  | 'TYPOGRAPHY'
  | 'COLOR_GUIDELINES'
  | 'BRAND_BOOK'
  | 'OTHER';

export interface Client {
  id: string;
  organization?: string;
  name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  description?: string | null;
  notes?: string | null;
  status: ClientStatus;
  created_by?: string | null;
  created_by_name?: string;
  updated_by?: string | null;
  updated_by_name?: string;
  created_at: string;
  updated_at: string;
  projects_count: number;
  brand_assets_count: number;
}

export interface ClientBrandAssetFolder {
  id: string;
  client: string;
  organization?: string;
  name: string;
  parent?: string | null;
  parent_name?: string | null;
  created_by?: string | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientBrandAsset {
  id: string;
  client: string;
  organization?: string;
  folder?: string | null;
  folder_name?: string | null;
  name: string;
  file: string;
  file_url?: string | null;
  asset_type: AssetType;
  description?: string | null;
  file_size: number;
  file_type: string;
  uploaded_by?: string | null;
  uploaded_by_name?: string;
  created_at: string;
  updated_at: string;
}


