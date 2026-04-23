import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ActivityLog, ActivityAction } from '../types';

const ACTIVITIES_COLLECTION = 'activities';

export const activityService = {
  subscribeToProjectActivity(projectId: string, callback: (activities: ActivityLog[]) => void) {
    const q = query(
      collection(db, ACTIVITIES_COLLECTION),
      where('projectId', '==', projectId),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];

      // Sort in memory to avoid composite index
      const sorted = logs.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
        return dateB.getTime() - dateA.getTime();
      });

      callback(sorted);
    });
  },

  async logActivity(
    projectId: string, 
    action: ActivityAction, 
    details: string, 
    taskId?: string
  ) {
    const user = auth.currentUser;
    if (!user) return;

    return addDoc(collection(db, ACTIVITIES_COLLECTION), {
      projectId,
      taskId: taskId || null,
      userId: user.uid,
      userName: user.displayName || user.email,
      userPhoto: user.photoURL,
      action,
      details,
      createdAt: serverTimestamp()
    });
  }
};
