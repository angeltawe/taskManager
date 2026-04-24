import { auth } from '../lib/firebase';
import { Project } from '../types';
import { userService } from './userService';
import { activityService } from './activityService';
import { localService } from './localService';
import { api } from './api';

export const projectService = {
  subscribeToUserProjects(callback: (projects: Project[]) => void) {
    if (localService.isDemoMode()) {
      const projects = localService.getProjects().filter(p => !p.isArchived);
      callback(projects);
      const interval = setInterval(() => {
        const current = localService.getProjects().filter(p => !p.isArchived);
        callback(current);
      }, 2000);
      return () => clearInterval(interval);
    }

    const user = auth.currentUser;
    if (!user) return () => {};

    const fetchProjects = async () => {
      try {
        const projects = await api.get('/projects', { userId: user.uid });
        callback(projects.map((p: any) => ({ ...p, id: p._id })).filter((p: any) => !p.isArchived));
      } catch (err) {
        console.error('Failed to fetch projects', err);
      }
    };

    fetchProjects();
    const interval = setInterval(fetchProjects, 5000);
    return () => clearInterval(interval);
  },

  async createProject(name: string, description?: string) {
    if (localService.isDemoMode()) {
      const newProject: Project = {
        id: `local-project-${Date.now()}`,
        name,
        description: description || '',
        ownerId: 'local-user-1',
        collaborators: [],
        isArchived: false,
        createdAt: new Date().toISOString() as any
      };
      localService.saveProject(newProject);
      return { id: newProject.id };
    }

    const user = auth.currentUser;
    if (!user) throw new Error('Unauthorized');

    await userService.ensureUserProfile();

    const projectData: any = {
      name,
      ownerId: user.uid,
      description: description || '',
      collaborators: [],
      collaboratorEmails: [],
      isArchived: false,
      createdAt: new Date().toISOString()
    };
    
    const result = await api.post('/projects', projectData);
    const projectId = result._id;

    try {
      await activityService.logActivity(projectId, 'create_project', `Created project: ${name}`);
    } catch (err) {
      console.error('Failed to log project creation activity', err);
    }

    return { id: projectId };
  },

  async archiveProject(projectId: string) {
    if (localService.isDemoMode()) {
      const projects = localService.getProjects();
      const p = projects.find(proj => proj.id === projectId);
      if (p) {
        p.isArchived = true;
        localService.saveProject(p);
      }
      return;
    }
    await api.patch(`/projects/${projectId}`, { isArchived: true });
    await activityService.logActivity(projectId, 'archive_project', `Archived workspace`);
  },

  async deleteProject(projectId: string) {
    if (localService.isDemoMode()) {
      const projects = localService.getProjects().filter(p => p.id !== projectId);
      localService.setData('kanban_projects', projects);
      return;
    }
    await api.delete(`/projects/${projectId}`);
  },

  async addCollaborator(projectId: string, email: string) {
    if (localService.isDemoMode()) return;
    const normalizedEmail = email.toLowerCase().trim();
    
    const project = await this.getProjectById(projectId);
    if (!project) return;

    const existingEmails = project.collaboratorEmails || [];
    const emails = Array.from(new Set([...existingEmails, normalizedEmail]));
    
    const updates: any = { collaboratorEmails: emails };

    // Try to find user to add UID
    try {
      const user = await userService.getUserByEmail(normalizedEmail);
      if (user) {
        const uids = Array.from(new Set([...(project.collaborators || []), user.uid]));
        updates.collaborators = uids;
      }
    } catch (e) {
      console.error('Failed to resolve user by email', e);
    }

    await api.patch(`/projects/${projectId}`, updates);
    await activityService.logActivity(projectId, 'invite_collaborator', `Invited ${normalizedEmail} to workspace`);
  },

  async removeCollaborator(projectId: string, collaboratorId: string, email?: string) {
    if (localService.isDemoMode()) return;
    const project = await this.getProjectById(projectId);
    if (!project) return;

    const collaborators = (project.collaborators || []).filter(id => id !== collaboratorId);
    const emails = email 
      ? (project.collaboratorEmails || []).filter(e => e.toLowerCase().trim() !== email.toLowerCase().trim())
      : project.collaboratorEmails;

    await api.patch(`/projects/${projectId}`, { 
      collaborators, 
      collaboratorEmails: emails 
    });
  },

  async updateMemberRole(projectId: string, userId: string, role: string) {
    if (localService.isDemoMode()) return;
    const project = await this.getProjectById(projectId);
    if (!project) return;

    const memberRoles = project.memberRoles || {};
    memberRoles[userId] = role;

    await api.patch(`/projects/${projectId}`, { memberRoles });
    await activityService.logActivity(projectId, 'update_task', `Updated user role to ${role}`);
  },

  async updateProjectTheme(projectId: string, themeColor?: string, themeBackground?: string) {
    if (localService.isDemoMode()) {
      const projects = localService.getProjects();
      const p = projects.find(proj => proj.id === projectId);
      if (p) {
        if (themeColor) p.themeColor = themeColor;
        if (themeBackground) p.themeBackground = themeBackground;
        localService.saveProject(p);
      }
      return;
    }
    const updates: any = {};
    if (themeColor) updates.themeColor = themeColor;
    if (themeBackground) updates.themeBackground = themeBackground;
    
    await api.patch(`/projects/${projectId}`, updates);
  },

  async getProjectById(projectId: string): Promise<Project | null> {
    if (localService.isDemoMode()) {
      return localService.getProjects().find(p => p.id === projectId) || null;
    }
    try {
      const project = await api.get(`/projects/${projectId}`);
      return project ? { ...project, id: project._id } : null;
    } catch (err) {
      return null;
    }
  }
};
