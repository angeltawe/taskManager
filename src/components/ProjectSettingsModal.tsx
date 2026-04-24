import { useState, useEffect } from 'react';
import { Project, UserProfile, ProjectRole } from '../types';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { localService } from '../services/localService';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { X, UserPlus, Loader2, UserMinus, Palette, Users as UsersIcon, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export function ProjectSettingsModal({ isOpen, onClose, project }: ProjectSettingsModalProps) {
  const [email, setEmail] = useState('');
  const [owner, setOwner] = useState<UserProfile | null>(null);
  const [collaborators, setCollaborators] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [themeColor, setThemeColor] = useState(project?.themeColor || '#7c3aed');
  const [themeBackground, setThemeBackground] = useState(project?.themeBackground || '');

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (project && isOpen) {
      loadProjectData();
      setThemeColor(project.themeColor || '#7c3aed');
      setThemeBackground(project.themeBackground || '');
    }
  }, [project, isOpen]);

  const loadProjectData = async () => {
    if (!project) return;
    try {
      const ownerProfile = await userService.getUserProfile(project.ownerId);
      setOwner(ownerProfile);

      if (project.collaborators?.length) {
        const users = await userService.getUsersByIds(project.collaborators);
        setCollaborators(users);
      } else {
        setCollaborators([]);
      }
    } catch (err) {
      console.error('Failed to load project members', err);
    }
  };

  const handleUpdateRole = async (userId: string, role: ProjectRole) => {
    if (!project) return;
    try {
      await projectService.updateMemberRole(project.id, userId, role);
    } catch (err) {
      console.error('Failed to update role', err);
    }
  };

  const handleUpdateTheme = async () => {
    if (!project) return;
    setLoading(true);
    try {
      await projectService.updateProjectTheme(project.id, themeColor, themeBackground);
    } catch (err) {
      console.error('Failed to update theme', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!project || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await projectService.addCollaborator(project.id, email.trim());
      setEmail('');
      await loadProjectData();
    } catch (err: any) {
      setError(err.message || 'Failed to add collaborator');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCollaborator = async (email: string) => {
    if (!project) return;
    try {
      const collabUid = collaborators.find(c => c.email.toLowerCase() === email.toLowerCase())?.uid || '';
      await projectService.removeCollaborator(project.id, collabUid, email);
      await loadProjectData();
    } catch (err) {
      console.error('Failed to remove collaborator', err);
    }
  };

  const handleArchiveProject = async () => {
    if (!project) return;
    if (confirm('Archive this workspace? This will remove it from your active list.')) {
      try {
        await projectService.archiveProject(project.id);
        onClose();
      } catch (err) {
        console.error('Failed to archive project', err);
      }
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (confirm('PERMANENTLY DELETE this workspace? This action cannot be undone and all associated data will be lost.')) {
      try {
        await projectService.deleteProject(project.id);
        onClose();
      } catch (err) {
        console.error('Failed to delete project', err);
      }
    }
  };

  const isDemo = localService.isDemoMode();
  const effectiveUid = currentUser?.uid || (isDemo ? 'local-user-1' : '');
  const isOwner = project?.ownerId === effectiveUid;
  const userRole = project && (currentUser || isDemo) ? (project.memberRoles?.[effectiveUid] || (isOwner ? 'admin' : 'member')) : 'viewer';
  const canManage = userRole === 'admin';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl border-none shadow-2xl p-0">
        <div className="p-6">
          <DialogHeader className="space-y-1.5 px-0 pt-0 pb-4 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <UsersIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight">Workspace Management</DialogTitle>
                  <p className="text-sm text-muted-foreground font-medium">Configure roles and workspace identity.</p>
                </div>
              </div>
              <div className="flex gap-2">
                {canManage && (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleArchiveProject} className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 h-8">
                      Archive
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDeleteProject} className="text-[10px] uppercase font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8">
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="members" className="w-full mt-6">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50 p-1">
              <TabsTrigger value="members" className="gap-2 font-bold"><UsersIcon className="h-4 w-4" /> Members</TabsTrigger>
              <TabsTrigger value="theme" className="gap-2 font-bold"><Palette className="h-4 w-4" /> Appearance</TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Active Members</h4>
                  <span className="text-[11px] font-mono bg-secondary px-2 py-0.5 rounded border border-border">{collaborators.length + 1}</span>
                </div>
                
                <div className="space-y-1 bg-muted/20 rounded-xl border border-border/40 overflow-hidden divide-y divide-border/40">
                  {/* Owner */}
                  <div className="flex items-center justify-between px-4 py-3 bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                        <AvatarImage src={owner?.photoURL || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground font-bold">{owner?.displayName?.charAt(0) || 'O'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold leading-none">{owner?.displayName || owner?.email}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Workspace Admin {owner?.uid === currentUser?.uid ? '(You)' : ''}</p>
                      </div>
                    </div>
                  </div>

                  {project?.collaboratorEmails?.map((email) => {
                    const user = collaborators.find(c => c.email.toLowerCase() === email.toLowerCase());
                    const currentRole = project.memberRoles?.[user?.uid || ''] || 'member';
                    
                    return (
                      <div key={email} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors group">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 ring-1 ring-border shadow-sm">
                            <AvatarImage src={user?.photoURL || undefined} />
                            <AvatarFallback className="bg-secondary text-primary font-bold">
                              {user?.displayName?.charAt(0) || email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold leading-none">{user?.displayName || 'Pending'}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {canManage && user && (
                            <Select 
                              defaultValue={currentRole} 
                              onValueChange={(val) => handleUpdateRole(user.uid, val as ProjectRole)}
                            >
                              <SelectTrigger className="h-8 text-[11px] w-[100px] font-bold uppercase bg-transparent border-border/40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {canManage && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveCollaborator(email)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {canManage && !isDemo && (
                <div className="space-y-4 pt-4 border-t border-border/40 bg-muted/10 p-4 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4 text-primary/60" />
                    <Label htmlFor="email" className="text-sm font-bold">Invite New Member</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      id="email" 
                      placeholder="teammate@company.com" 
                      value={email}
                      className="h-10 bg-background"
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCollaborator()}
                    />
                    <Button onClick={handleAddCollaborator} disabled={loading || !email.trim()} className="h-10 px-5 font-bold">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Invite'}
                    </Button>
                  </div>
                  {error && <p className="text-[11px] text-destructive font-semibold">{error}</p>}
                </div>
              )}
              {isDemo && (
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                   <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest text-center">Collaboration is disabled in Offline Mode</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="theme" className="space-y-6 mt-0 pb-4">
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Brand Colors</Label>
                  <div className="flex flex-wrap gap-3">
                    {['#7c3aed', '#f97316', '#06b6d4', '#10b981', '#ef4444', '#ec4899', '#64748b'].map(color => (
                      <button
                        key={color}
                        onClick={() => setThemeColor(color)}
                        className={`h-10 w-10 rounded-full border-2 transition-all ${themeColor === color ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <div className="h-10 w-10 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                      <Input 
                        type="color" 
                        value={themeColor} 
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="opacity-0 absolute h-10 w-10 cursor-pointer"
                      />
                      <Palette className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border/40">
                  <Label htmlFor="bg-url" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Custom Background URL</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="bg-url"
                      placeholder="https://images.unsplash.com/..."
                      value={themeBackground}
                      onChange={(e) => setThemeBackground(e.target.value)}
                      className="h-10 bg-muted/20"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Add a high-quality image URL to personalize this workspace.</p>
                </div>

                <div className="pt-6">
                  <Button onClick={handleUpdateTheme} disabled={loading} className="w-full h-11 font-bold">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/5">
          <Button variant="ghost" onClick={onClose} className="text-sm font-semibold h-9">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
