import { doc, setDoc, onSnapshot, collection, query, where, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Presence } from '../types';

const PRESENCE_COLLECTION = 'presence';

export const presenceService = {
  async updatePresence(projectId: string, taskId?: string) {
    const user = auth.currentUser;
    if (!user) return;

    const presenceRef = doc(db, PRESENCE_COLLECTION, user.uid);
    await setDoc(presenceRef, {
      userId: user.uid,
      userName: user.displayName || user.email,
      userPhoto: user.photoURL,
      projectId,
      taskId: taskId || null,
      lastActive: serverTimestamp()
    }, { merge: true });
  },

  subscribeToProjectPresence(projectId: string, callback: (presence: Presence[]) => void) {
    const q = query(
      collection(db, PRESENCE_COLLECTION),
      where('projectId', '==', projectId)
    );

    return onSnapshot(q, (snapshot) => {
      const presence = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Presence[];
      
      // Filter out stale presence (older than 2 minutes)
      const now = Date.now();
      const activePresence = presence.filter(p => {
        const lastActive = p.lastActive?.toMillis ? p.lastActive.toMillis() : now;
        return now - lastActive < 120000;
      });
      
      callback(activePresence);
    });
  },

  async clearPresence() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, PRESENCE_COLLECTION, user.uid));
    } catch (e) {
      console.error("Failed to clear presence", e);
    }
  }
};
