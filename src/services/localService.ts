import { Project, Task, UserProfile, ActivityLog, Notification } from '../types';

const STORAGE_KEYS = {
  PROJECTS: 'kanban_projects',
  TASKS: 'kanban_tasks',
  USER: 'kanban_user',
  ACTIVITIES: 'kanban_activities',
  NOTIFICATIONS: 'kanban_notifications',
  MODE: 'kanban_demo_mode'
};

const INITIAL_USER: UserProfile = {
  id: 'local-user-1',
  uid: 'local-user-1',
  email: 'demo@example.com',
  displayName: 'Demo User',
  photoURL: null,
  createdAt: new Date().toISOString() as any
};

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'demo-project-1',
    name: '🚀 Project Launch',
    description: 'A local demo project for testing features offline.',
    ownerId: 'local-user-1',
    collaborators: [],
    createdAt: new Date().toISOString() as any
  }
];

const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    projectId: 'demo-project-1',
    title: 'Explore Kanban Board',
    description: 'Try dragging tasks between columns.',
    status: 'todo',
    priority: 'medium',
    assigneeId: 'local-user-1',
    creatorId: 'local-user-1',
    order: 0,
    createdAt: new Date().toISOString() as any
  },
  {
    id: 'task-2',
    projectId: 'demo-project-1',
    title: 'Complete your first task',
    description: 'Change the status to done.',
    status: 'in-progress',
    priority: 'high',
    assigneeId: 'local-user-1',
    creatorId: 'local-user-1',
    order: 1,
    createdAt: new Date().toISOString() as any
  }
];

export class localService {
  static isDemoMode(): boolean {
    return localStorage.getItem(STORAGE_KEYS.MODE) === 'true';
  }

  static setDemoMode(enabled: boolean) {
    localStorage.setItem(STORAGE_KEYS.MODE, String(enabled));
    if (enabled && !localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
      this.initDemoData();
    }
  }

  static initDemoData() {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(INITIAL_USER));
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  }

  // Generic Getters/Setters
  static getData<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  static setData<T>(key: string, data: T[]) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // Projects
  static getProjects(): Project[] { return this.getData<Project>(STORAGE_KEYS.PROJECTS); }
  static saveProject(project: Project) {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) projects[index] = project;
    else projects.push(project);
    this.setData(STORAGE_KEYS.PROJECTS, projects);
  }

  // Tasks
  static getTasks(projectId: string): Task[] {
    return this.getData<Task>(STORAGE_KEYS.TASKS).filter(t => t.projectId === projectId);
  }
  static saveTask(task: Task) {
    const tasks = this.getData<Task>(STORAGE_KEYS.TASKS);
    const index = tasks.findIndex(t => t.id === task.id);
    if (index >= 0) tasks[index] = task;
    else tasks.push(task);
    this.setData(STORAGE_KEYS.TASKS, tasks);
  }
  static deleteTask(taskId: string) {
    const tasks = this.getData<Task>(STORAGE_KEYS.TASKS).filter(t => t.id !== taskId);
    this.setData(STORAGE_KEYS.TASKS, tasks);
  }

  // User
  static getUser(): UserProfile {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : INITIAL_USER;
  }
  static updateUser(data: Partial<UserProfile>) {
    const user = { ...this.getUser(), ...data };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }
}
