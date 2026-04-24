import { auth } from '../lib/firebase';
import { UserProfile } from '../types';
import { localService } from './localService';
import { api } from './api';

export const userService = {
  async ensureUserProfile() {
    if (localService.isDemoMode()) return;
    const user = auth.currentUser;
    if (!user) return;

    try {
      await api.post('/users', {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email?.toLowerCase().trim() || '',
        photoURL: user.photoURL,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to ensure user profile', err);
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (localService.isDemoMode()) {
      return localService.getUser();
    }
    try {
      const user = await api.get(`/users/${uid}`);
      return user ? { ...user, id: user._id } : null;
    } catch (err) {
      console.error('Failed to get user profile', err);
      return null;
    }
  },

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    if (localService.isDemoMode()) return null;
    try {
      const user = await api.get('/users/search', { email: email.toLowerCase().trim() });
      return user ? { ...user, id: user._id } : null;
    } catch (err) {
      console.error('Failed to get user by email', err);
      return null;
    }
  },

  async getUsersByIds(uids: string[]): Promise<UserProfile[]> {
    if (localService.isDemoMode()) {
      return [localService.getUser()];
    }
    if (uids.length === 0) return [];
    
    try {
      const users = await api.get('/users/search', { uids: uids.join(',') });
      return users.map((u: any) => ({ ...u, id: u._id }));
    } catch (err) {
      console.error('Failed to get users by IDs', err);
      return [];
    }
  },

  async updateUserProfile(uid: string, data: Partial<UserProfile>) {
    if (localService.isDemoMode()) {
      localService.updateUser(data);
      return;
    }
    await api.post('/users', { ...data, uid });
  }
};
