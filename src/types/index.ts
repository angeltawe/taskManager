export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface UserProfile {
  id: string;
  uid: string;
  displayName: string | null;
  email: string;
  photoURL: string | null;
  createdAt: any;
}

export type ActivityAction = 'create_task' | 'update_task' | 'delete_task' | 'complete_task' | 'add_comment' | 'invite_collaborator' | 'archive_project' | 'create_project' | 'remove_collaborator';

export interface ActivityLog {
  id: string;
  projectId: string;
  taskId?: string | null;
  userId: string;
  userName: string;
  userPhoto?: string | null;
  action: ActivityAction;
  details: string;
  createdAt: any;
}

export type ProjectRole = 'admin' | 'member' | 'viewer';

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  collaborators: string[];
  collaboratorEmails?: string[];
  memberRoles?: Record<string, ProjectRole>;
  themeColor?: string;
  themeBackground?: string;
  isArchived?: boolean;
  createdAt: any;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: any;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: any;
  projectId: string;
  creatorId: string;
  assigneeId?: string;
  parentId?: string;
  dependencies?: string[];
  order: number;
  recurrence?: string;
  isArchived?: boolean;
  completedAt?: any;
  dueNotificationSent?: boolean;
  createdAt: any;
  subtasks?: Subtask[];
  tags?: string[];
  attachments?: Attachment[];
}

export interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName?: string;
  authorPhoto?: string;
  createdAt: any;
}

export type NotificationType = 'mention' | 'assigned' | 'updated' | 'due_soon';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  projectId: string;
  taskId?: string;
  authorId: string;
  authorName: string;
  isRead: boolean;
  createdAt: any;
}

export interface Presence {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  projectId: string;
  taskId?: string;
  lastActive: any;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: any;
}
