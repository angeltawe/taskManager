import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, serverTimestamp, getDocs, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Notification, NotificationType, Task, Project } from '../types';

const NOTIFICATIONS_COLLECTION = 'notifications';
const TASKS_COLLECTION = 'tasks';

export const notificationService = {
  async sendNotification(userId: string, type: NotificationType, message: string, projectId: string, taskId?: string) {
    const currentUser = auth.currentUser;
    // We allow system notifications (no currentUser if triggered by automation, but here currentUser is mostly for author props)
    const authorId = currentUser?.uid || 'system';
    const authorName = currentUser?.displayName || currentUser?.email || 'System';

    await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
      userId,
      type,
      message,
      projectId,
      taskId: taskId || null,
      authorId,
      authorName,
      isRead: false,
      createdAt: serverTimestamp()
    });
  },

  async checkDueDates(tasks: Task[], project: Project) {
    const user = auth.currentUser;
    if (!user) return;

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    for (const task of tasks) {
      if (!task.dueDate || task.status === 'done' || task.dueNotificationSent || task.isArchived) continue;

      const dueDate = task.dueDate instanceof Timestamp 
        ? task.dueDate.toDate() 
        : new Date(task.dueDate);

      // If due in less than 24 hours AND not already past due or just checked
      if (dueDate <= twentyFourHoursFromNow && dueDate > now) {
        const recipients = new Set<string>();
        
        // Add assignee
        if (task.assigneeId) {
          recipients.add(task.assigneeId);
        }

        // Add collaborators and owner
        if (project.collaborators) {
          project.collaborators.forEach(uid => recipients.add(uid));
        }
        recipients.add(project.ownerId);

        // Send notifications
        const message = `Task "${task.title}" is due in less than 24 hours!`;
        for (const recipientId of recipients) {
          // Optional: don't notify the person who triggered the check if it was synchronous?
          // But here it's cleaner to notify all relevant parties.
          await this.sendNotification(
            recipientId,
            'due_soon',
            message,
            task.projectId,
            task.id
          );
        }

        // Mark as sent in task
        const taskRef = doc(db, TASKS_COLLECTION, task.id);
        await updateDoc(taskRef, {
          dueNotificationSent: true
        });
      }
    }
  },

  subscribeToNotifications(callback: (notifications: Notification[]) => void) {
    const user = auth.currentUser;
    if (!user) return () => {};

    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      callback(notifications);
    });
  },

  async markAsRead(notificationId: string) {
    const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await updateDoc(notificationRef, { isRead: true });
  },

  async deleteNotification(notificationId: string) {
    const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await deleteDoc(notificationRef);
  },

  async markAllAsRead() {
    // This would typically be a batch operation or a clouded function.
    // For now, it's safer to do via notifications list in the component
  }
};
