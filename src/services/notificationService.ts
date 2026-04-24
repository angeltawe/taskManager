import { auth } from '../lib/firebase';
import { Notification, NotificationType, Task, Project } from '../types';
import { localService } from './localService';
import { api } from './api';

export const notificationService = {
  async sendNotification(userId: string, type: NotificationType, message: string, projectId: string, taskId?: string) {
    if (localService.isDemoMode()) {
       const user = localService.getUser();
       const newNotification: Notification = {
         id: `local-notif-${Date.now()}`,
         userId,
         type,
         message,
         projectId,
         taskId: taskId || null,
         authorId: user.uid!,
         authorName: user.displayName || 'System',
         isRead: false,
         createdAt: new Date().toISOString() as any
       };
       const notifs = localService.getData<Notification>('kanban_notifications');
       notifs.push(newNotification);
       localService.setData('kanban_notifications', notifs);
       return;
    }
    const currentUser = auth.currentUser;
    const authorId = currentUser?.uid || 'system';
    const authorName = currentUser?.displayName || currentUser?.email || 'System';

    await api.post('/notifications', {
      userId,
      type,
      message,
      projectId,
      taskId: taskId || null,
      authorId,
      authorName,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  },

  async checkDueDates(tasks: Task[], project: Project) {
    if (localService.isDemoMode()) return;
    const user = auth.currentUser;
    if (!user) return;

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    for (const task of tasks) {
      if (!task.dueDate || task.status === 'done' || task.dueNotificationSent || task.isArchived) continue;

      const dueDate = new Date(task.dueDate);

      if (dueDate <= twentyFourHoursFromNow && dueDate > now) {
        const recipients = new Set<string>();
        if (task.assigneeId) recipients.add(task.assigneeId);
        if (project.collaborators) project.collaborators.forEach(uid => recipients.add(uid));
        recipients.add(project.ownerId);

        const message = `Task "${task.title}" is due in less than 24 hours!`;
        for (const recipientId of recipients) {
          await this.sendNotification(recipientId, 'mention' as any, message, task.projectId, task.id);
        }

        await api.patch(`/tasks/${task.id}`, { dueNotificationSent: true });
      }
    }
  },

  subscribeToNotifications(callback: (notifications: Notification[]) => void) {
    if (localService.isDemoMode()) {
      const getNotifs = () => {
        return localService.getData<Notification>('kanban_notifications')
          .filter(n => n.userId === 'local-user-1')
          .sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });
      };
      callback(getNotifs());
      const interval = setInterval(() => callback(getNotifs()), 5000);
      return () => clearInterval(interval);
    }
    const user = auth.currentUser;
    if (!user) return () => {};

    const fetchNotifications = async () => {
      try {
        const notifications = await api.get('/notifications', { userId: user.uid });
        callback(notifications.map((n: any) => ({ ...n, id: n._id })));
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  },

  async markAsRead(notificationId: string) {
    if (localService.isDemoMode()) {
       const notifs = localService.getData<Notification>('kanban_notifications');
       const idx = notifs.findIndex(n => n.id === notificationId);
       if (idx >= 0) {
         notifs[idx].isRead = true;
         localService.setData('kanban_notifications', notifs);
       }
       return;
    }
    await api.patch(`/notifications/${notificationId}`, { isRead: true });
  },

  async deleteNotification(notificationId: string) {
    if (localService.isDemoMode()) {
      const notifs = localService.getData<Notification>('kanban_notifications').filter(n => n.id !== notificationId);
      localService.setData('kanban_notifications', notifs);
      return;
    }
    await api.delete(`/notifications/${notificationId}`);
  },

  async markAllAsRead() {
    // Implement on server ideally
  }
};
