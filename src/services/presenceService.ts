import { auth } from '../lib/firebase';
import { Presence } from '../types';
import { localService } from './localService';
import { api } from './api';

export const presenceService = {
  async updatePresence(projectId: string, taskId?: string) {
    if (localService.isDemoMode()) return;
    const user = auth.currentUser;
    if (!user) return;

    await api.post('/presence', {
      userId: user.uid,
      userName: user.displayName || user.email,
      userPhoto: user.photoURL,
      projectId,
      taskId: taskId || null,
      lastActive: new Date().toISOString()
    });
  },

  subscribeToProjectPresence(projectId: string, callback: (presence: Presence[]) => void) {
    if (localService.isDemoMode()) {
      const user = localService.getUser();
      callback([{
        id: user.uid,
        userId: user.uid,
        userName: user.displayName || 'Demo User',
        userPhoto: user.photoURL || null,
        projectId,
        taskId: null,
        lastActive: { toMillis: () => Date.now() } as any
      }]);
      return () => {};
    }

    const fetchPresence = async () => {
      try {
        const presence = await api.get('/presence', { projectId });
        const now = Date.now();
        const activePresence = presence.map((p: any) => ({
          ...p,
          id: p._id,
          lastActive: { toMillis: () => new Date(p.lastActive).getTime() }
        })).filter((p: any) => {
          const lastActive = new Date(p.lastActive).getTime();
          return now - lastActive < 120000;
        });
        callback(activePresence);
      } catch (err) {
        console.error('Failed to fetch presence', err);
      }
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 15000);
    return () => clearInterval(interval);
  },

  async clearPresence() {
    if (localService.isDemoMode()) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      await api.delete(`/presence/${user.uid}`);
    } catch (e) {
      console.error("Failed to clear presence", e);
    }
  }
};
