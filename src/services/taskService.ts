import { auth } from '../lib/firebase';
import { Task, TaskStatus, Comment } from '../types';
import { activityService } from './activityService';
import { notificationService } from './notificationService';
import { localService } from './localService';
import { api } from './api';
import { toDate } from '../lib/utils';

const TASKS_COLLECTION = 'tasks';
const COMMENTS_COLLECTION = 'comments';

export const taskService = {
  subscribeToProjectTasks(projectId: string, callback: (tasks: Task[]) => void) {
    if (localService.isDemoMode()) {
      const getFiltered = () => {
        return localService.getData<Task>('kanban_tasks')
          .filter(t => t.projectId === projectId && !t.isArchived)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
      };
      
      callback(getFiltered());
      const interval = setInterval(() => callback(getFiltered()), 2000);
      return () => clearInterval(interval);
    }

    const fetchTasks = async () => {
      try {
        const tasks = await api.get('/tasks', { projectId });
        const mapped = tasks.map((t: any) => ({ ...t, id: t._id }));
        const filtered = mapped
          .filter((t: any) => !t.isArchived)
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        callback(filtered);
      } catch (err) {
        console.error('Failed to fetch tasks', err);
      }
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  },

  async createTask(task: Partial<Task>) {
    if (localService.isDemoMode()) {
      const newTask: Task = {
        id: `local-task-${Date.now()}`,
        projectId: task.projectId!,
        title: task.title || 'Untitled Task',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        creatorId: 'local-user-1',
        assigneeId: task.assigneeId || null,
        order: task.order !== undefined ? task.order : Date.now(),
        isArchived: false,
        createdAt: new Date().toISOString() as any,
        tags: task.tags || [],
        subtasks: task.subtasks || [],
        dueDate: task.dueDate || null
      };
      localService.saveTask(newTask);
      return { id: newTask.id };
    }

    const user = auth.currentUser;
    if (!user) throw new Error('Unauthorized');

    const taskData = {
      ...task,
      creatorId: user.uid,
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      order: task.order !== undefined ? task.order : Date.now(),
      isArchived: false,
      createdAt: new Date().toISOString()
    };

    const result = await api.post('/tasks', taskData);
    const taskId = result._id;

    if (task.projectId) {
      await activityService.logActivity(task.projectId, 'create_task', `Created task: ${task.title}`, taskId);
    }

    return { id: taskId };
  },

  async updateTask(taskId: string, updates: Partial<Task>) {
    if (localService.isDemoMode()) {
      const tasks = localService.getData<Task>('kanban_tasks');
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx >= 0) {
        tasks[idx] = { ...tasks[idx], ...updates };
        localService.setData('kanban_tasks', tasks);
      }
      return;
    }
    
    const result = await api.patch(`/tasks/${taskId}`, updates);

    if (updates.projectId) {
      const details = updates.status === 'done' ? `Completed task: ${updates.title || 'Untitled'}` : `Updated task: ${updates.title || 'Untitled'}`;
      const action = updates.status === 'done' ? 'complete_task' : 'update_task';
      await activityService.logActivity(updates.projectId, action, details, taskId);
    }

    return result;
  },

  async archiveTask(taskId: string, projectId: string) {
    if (localService.isDemoMode()) {
      return this.updateTask(taskId, { isArchived: true } as any);
    }
    await api.patch(`/tasks/${taskId}`, { isArchived: true });
    await activityService.logActivity(projectId, 'update_task', `Archived task`, taskId);
  },

  async deleteTask(taskId: string) {
    if (localService.isDemoMode()) {
      localService.deleteTask(taskId);
      return;
    }
    await api.delete(`/tasks/${taskId}`);
  },

  async updateTaskStatus(taskId: string, newStatus: TaskStatus, task?: Task) {
    const updates: any = { 
      status: newStatus,
      completedAt: newStatus === 'done' ? new Date().toISOString() : null
    };

    if (newStatus === 'done' && task?.recurrence && task.recurrence !== 'none') {
      await this.handleRecurrence(task);
    }

    return this.updateTask(taskId, updates);
  },

  async toggleTaskStatus(task: Task) {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    return this.updateTaskStatus(task.id, newStatus, task);
  },

  async handleRecurrence(task: Task) {
    const baseDate = toDate(task.dueDate) || new Date();
    
    const nextDueDate = new Date(baseDate);
    if (task.recurrence === 'daily') nextDueDate.setDate(nextDueDate.getDate() + 1);
    if (task.recurrence === 'weekly') nextDueDate.setDate(nextDueDate.getDate() + 7);
    if (task.recurrence === 'monthly') nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    // Create a new copy of the task for the next occurrence
    const { id, completedAt, status, ...rest } = task;
    return this.createTask({
      ...rest,
      status: 'todo',
      dueDate: nextDueDate,
      order: (task.order || 0) + 1
    });
  },

  exportToICal(tasks: Task[], projectName: string) {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CleanTask//Enterprise//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ].join('\r\n');

    tasks.forEach(task => {
      if (!task.dueDate) return;
      const start = toDate(task.dueDate) || new Date();
      const end = new Date(start);
      end.setHours(end.getHours() + 1);

      const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      icsContent += '\r\n' + [
        'BEGIN:VEVENT',
        `UID:${task.id}@cleantask.app`,
        `DTSTAMP:${formatDate(new Date())}`,
        `DTSTART:${formatDate(start)}`,
        `DTEND:${formatDate(end)}`,
        `SUMMARY:${task.title}`,
        `DESCRIPTION:${task.description || ''}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      ].join('\r\n');
    });

    icsContent += '\r\nEND:VCALENDAR';

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${projectName.replace(/\s+/g, '_')}_tasks.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  subscribeToComments(taskId: string, callback: (comments: Comment[]) => void) {
    if (localService.isDemoMode()) {
      const getComments = () => {
        return localService.getData<Comment>(`comments_${taskId}`)
          .sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });
      };
      callback(getComments());
      const interval = setInterval(() => callback(getComments()), 2000);
      return () => clearInterval(interval);
    }

    const fetchComments = async () => {
      try {
        const comments = await api.get(`/tasks/${taskId}/comments`);
        callback(comments.map((c: any) => ({ ...c, id: c._id })));
      } catch (err) {
        console.error('Failed to fetch comments', err);
      }
    };

    fetchComments();
    const interval = setInterval(fetchComments, 5000);
    return () => clearInterval(interval);
  },

  async addComment(taskId: string, text: string, projectId: string, mentionedUserIds: string[] = []) {
    const user = auth.currentUser;
    const authorId = user?.uid || 'local-user-1';
    const authorName = user?.displayName || user?.email || 'Demo User';
    const authorPhoto = user?.photoURL || null;

    if (localService.isDemoMode()) {
       const newComment: Comment = {
        id: `local-comment-${Date.now()}`,
        text,
        authorId,
        authorName,
        authorPhoto,
        createdAt: new Date().toISOString() as any
      };
      const comments = localService.getData<Comment>(`comments_${taskId}`);
      comments.push(newComment);
      localService.setData(`comments_${taskId}`, comments);
      await activityService.logActivity(projectId, 'add_comment', `Commented on task`, taskId);
      return { id: newComment.id };
    }

    const commentData = {
      text,
      authorId,
      authorName,
      authorPhoto,
      createdAt: new Date().toISOString()
    };

    const result = await api.post(`/tasks/${taskId}/comments`, commentData);
    await activityService.logActivity(projectId, 'add_comment', `Commented on task`, taskId);

    for (const uid of mentionedUserIds) {
      if (uid !== authorId) {
        await notificationService.sendNotification(
          uid,
          'mention',
          `${authorName} mentioned you in a comment`,
          projectId,
          taskId
        );
      }
    }

    return result;
  },

  async deleteComment(taskId: string, commentId: string) {
    if (localService.isDemoMode()) {
      const comments = localService.getData<Comment>(`comments_${taskId}`)
        .filter(c => c.id !== commentId);
      localService.setData(`comments_${taskId}`, comments);
      return;
    }
    // Note: Delete comment endpoint needed in server if adding more full functionality
  }
};
