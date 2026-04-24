import { auth } from '../lib/firebase';
import { ActivityLog, ActivityAction } from '../types';
import { localService } from './localService';
import { api } from './api';

export const activityService = {
  subscribeToProjectActivity(projectId: string, callback: (activities: ActivityLog[]) => void) {
    if (localService.isDemoMode()) {
      const getLogs = () => {
        return localService.getData<ActivityLog>('kanban_activities')
          .filter(a => a.projectId === projectId)
          .sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 50);
      };
      callback(getLogs());
      const interval = setInterval(() => callback(getLogs()), 5000);
      return () => clearInterval(interval);
    }

    const fetchActivities = async () => {
      try {
        const logs = await api.get('/activities', { projectId });
        const mapped = logs.map((l: any) => ({ ...l, id: l._id }));
        callback(mapped);
      } catch (err) {
        console.error('Failed to fetch activities', err);
      }
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 10000);
    return () => clearInterval(interval);
  },

  async logActivity(
    projectId: string, 
    action: ActivityAction, 
    details: string, 
    taskId?: string
  ) {
    const user = auth.currentUser;
    const userId = user?.uid || 'local-user-1';
    const userName = user?.displayName || user?.email || 'Demo User';
    const userPhoto = user?.photoURL || null;

    if (localService.isDemoMode()) {
      const newActivity: ActivityLog = {
        id: `local-act-${Date.now()}`,
        projectId,
        taskId: taskId || null,
        userId,
        userName,
        userPhoto,
        action,
        details,
        createdAt: new Date().toISOString() as any
      };
      const logs = localService.getData<ActivityLog>('kanban_activities');
      logs.push(newActivity);
      localService.setData('kanban_activities', logs);
      return;
    }

    await api.post('/activities', {
      projectId,
      taskId: taskId || null,
      userId,
      userName,
      userPhoto,
      action,
      details,
      createdAt: new Date().toISOString()
    });
  }
};
