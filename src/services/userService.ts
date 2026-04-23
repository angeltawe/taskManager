import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc,
  doc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile } from '../types';

const USERS_COLLECTION = 'users';

export const userService = {
  async ensureUserProfile() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userRef = doc(db, USERS_COLLECTION, user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email?.toLowerCase().trim() || '',
        photoURL: user.photoURL,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('Failed to ensure user profile', err);
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as UserProfile;
  },

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('email', '==', email.toLowerCase().trim())
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as UserProfile;
  },

  async getUsersByIds(uids: string[]): Promise<UserProfile[]> {
    if (uids.length === 0) return [];
    
    // Firestore 'in' query supports up to 30 elements
    const chunks = [];
    for (let i = 0; i < uids.length; i += 30) {
      chunks.push(uids.slice(i, i + 30));
    }
    
    const results: UserProfile[] = [];
    for (const chunk of chunks) {
      const q = query(
        collection(db, USERS_COLLECTION),
        where('uid', 'in', chunk)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
    }
    return results;
  },

  async updateUserProfile(uid: string, data: Partial<UserProfile>) {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await setDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
};
