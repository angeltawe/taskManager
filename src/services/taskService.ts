import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Task, TaskStatus, Priority, Comment } from '../types';
import { activityService } from './activityService';
import { notificationService } from './notificationService';

const TASKS_COLLECTION = 'tasks';
const COMMENTS_COLLECTION = 'comments';

export const taskService = {
  subscribeToProjectTasks(projectId: string, callback: (tasks: Task[]) => void) {
    const q = query(
      collection(db, TASKS_COLLECTION),
      where('projectId', '==', projectId)
    );

    return onSnapshot(q, 
      (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Task[];
        
        // Filter and sort in memory to avoid complex index requirements
        const filtered = tasks
          .filter(t => !t.isArchived)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        
        callback(filtered);
      },
      (error) => {
        console.error(`Error subscribing to project tasks (${projectId}):`, error);
      }
    );
  },

  async createTask(task: Partial<Task>) {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthorized');

    // Remove undefined values
    const cleanTask = Object.fromEntries(
      Object.entries(task).filter(([_, v]) => v !== undefined)
    );

    const docRef = await addDoc(collection(db, TASKS_COLLECTION), {
      ...cleanTask,
      creatorId: user.uid,
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      order: task.order !== undefined ? task.order : Date.now(),
      isArchived: false,
      createdAt: serverTimestamp(),
    });

    try {
      if (task.projectId) {
        await activityService.logActivity(task.projectId, 'create_task', `Created task: ${task.title}`, docRef.id);
      }
    } catch (err) {
      console.error('Failed to log task creation activity', err);
    }

    return docRef;
  },

  async updateTask(taskId: string, updates: Partial<Task>) {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    
    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    const result = await updateDoc(taskRef, {
      ...cleanUpdates,
      updatedAt: serverTimestamp()
    });

    if (updates.projectId) {
      const details = updates.status === 'done' ? `Completed task: ${updates.title || 'Untitled'}` : `Updated task: ${updates.title || 'Untitled'}`;
      const action = updates.status === 'done' ? 'complete_task' : 'update_task';
      await activityService.logActivity(updates.projectId, action, details, taskId);
    }

    return result;
  },

  async archiveTask(taskId: string, projectId: string) {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    await updateDoc(taskRef, { isArchived: true });
    await activityService.logActivity(projectId, 'update_task', `Archived task`, taskId);
  },

  async deleteTask(taskId: string) {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    return deleteDoc(taskRef);
  },

  async updateTaskStatus(taskId: string, newStatus: TaskStatus, task?: Task) {
    const updates: any = { 
      status: newStatus,
      completedAt: newStatus === 'done' ? serverTimestamp() : null
    };

    // Handle recurrence if we have the full task object and it's being marked as done
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
    const baseDate = task.dueDate 
      ? (task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate))
      : new Date();
    
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
      const start = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
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
    const q = query(
      collection(db, TASKS_COLLECTION, taskId, COMMENTS_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, 
      (snapshot) => {
        const comments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Comment[];
        callback(comments);
      },
      (error) => {
        console.error(`Error subscribing to comments for task (${taskId}):`, error);
      }
    );
  },

  async addComment(taskId: string, text: string, projectId: string, mentionedUserIds: string[] = []) {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthorized');

    const docRef = await addDoc(collection(db, TASKS_COLLECTION, taskId, COMMENTS_COLLECTION), {
      text,
      authorId: user.uid,
      authorName: user.displayName || user.email,
      authorPhoto: user.photoURL,
      createdAt: serverTimestamp()
    });

    await activityService.logActivity(projectId, 'add_comment', `Commented on task`, taskId);

    // Send notifications to mentioned users
    for (const uid of mentionedUserIds) {
      if (uid !== user.uid) { // Don't notify self
        await notificationService.sendNotification(
          uid,
          'mention',
          `${user.displayName || user.email} mentioned you in a comment`,
          projectId,
          taskId
        );
      }
    }

    return docRef;
  },

  async deleteComment(taskId: string, commentId: string) {
    const commentRef = doc(db, TASKS_COLLECTION, taskId, COMMENTS_COLLECTION, commentId);
    return deleteDoc(commentRef);
  }
};
