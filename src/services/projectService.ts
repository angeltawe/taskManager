import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  serverTimestamp,
  getDocs,
  or,
  and,
  arrayUnion,
  arrayRemove,
  deleteField
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Project } from '../types';
import { userService } from './userService';
import { activityService } from './activityService';

const PROJECTS_COLLECTION = 'projects';

export const projectService = {
  subscribeToUserProjects(callback: (projects: Project[]) => void) {
    const user = auth.currentUser;
    if (!user) return () => {};

    // To avoid complex composite indexes, we combine simple queries in memory
    const ownerQuery = query(
      collection(db, PROJECTS_COLLECTION),
      where('ownerId', '==', user.uid)
    );

    const collaboratorQuery = query(
      collection(db, PROJECTS_COLLECTION),
      where('collaborators', 'array-contains', user.uid)
    );

    let ownerProjects: Project[] = [];
    let collaboratorProjects: Project[] = [];
    const handleUpdate = () => {
      const allProjects = [...ownerProjects, ...collaboratorProjects];
      // De-duplicate by ID
      const uniqueProjects = Array.from(new Map(allProjects.map(p => [p.id, p])).values());
      // Filter archived
      const filtered = uniqueProjects.filter(p => !p.isArchived);
      
      callback(filtered);
    };

    const unsubOwner = onSnapshot(ownerQuery, (snap) => {
      ownerProjects = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      handleUpdate();
    });

    const unsubCollab = onSnapshot(collaboratorQuery, (snap) => {
      collaboratorProjects = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      handleUpdate();
    });

    return () => {
      unsubOwner();
      unsubCollab();
    };
  },

  async createProject(name: string, description?: string) {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthorized');

    await userService.ensureUserProfile();

    const projectData: any = {
      name,
      ownerId: user.uid,
      collaborators: [],
      collaboratorEmails: [],
      createdAt: serverTimestamp()
    };
    
    if (description !== undefined) {
      projectData.description = description;
    }

    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
      ...projectData,
      isArchived: false,
    });

    try {
      await activityService.logActivity(docRef.id, 'create_project', `Created project: ${name}`);
    } catch (err) {
      console.error('Failed to log project creation activity', err);
    }

    return docRef;
  },

  async archiveProject(projectId: string) {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, { isArchived: true });
    await activityService.logActivity(projectId, 'archive_project', `Archived workspace`);
  },

  async deleteProject(projectId: string) {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    
    // In a production environment, you might want to delete associated tasks and activities as well.
    // For now, we perform a direct deletion of the project document.
    await deleteDoc(projectRef);
  },

  async addCollaborator(projectId: string, email: string) {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const normalizedEmail = email.toLowerCase().trim();
    
    // First, try to find if a user with this email already exists
    const user = await userService.getUserByEmail(normalizedEmail);
    
    const updates: any = {
      collaboratorEmails: arrayUnion(normalizedEmail)
    };

    if (user) {
      updates.collaborators = arrayUnion(user.uid);
    }

    const result = await updateDoc(projectRef, updates);

    await activityService.logActivity(projectId, 'invite_collaborator', `Invited ${normalizedEmail} to workspace`);

    return result;
  },

  async removeCollaborator(projectId: string, collaboratorId: string, email?: string) {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const updates: any = {
      collaborators: arrayRemove(collaboratorId)
    };
    
    if (email) {
      updates.collaboratorEmails = arrayRemove(email.toLowerCase().trim());
    }
    
    // Also remove from memberRoles
    if (collaboratorId) {
      updates[`memberRoles.${collaboratorId}`] = deleteField();
    }
    
    return updateDoc(projectRef, updates);
  },

  async updateMemberRole(projectId: string, userId: string, role: string) {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, {
      [`memberRoles.${userId}`]: role
    });
    await activityService.logActivity(projectId, 'update_task', `Updated user role to ${role}`);
  },

  async updateProjectTheme(projectId: string, themeColor?: string, themeBackground?: string) {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const updates: any = {};
    if (themeColor) updates.themeColor = themeColor;
    if (themeBackground) updates.themeBackground = themeBackground;
    
    await updateDoc(projectRef, updates);
  },

  async getProjectById(projectId: string): Promise<Project | null> {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const docSnap = await getDoc(projectRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Project;
  }
};
