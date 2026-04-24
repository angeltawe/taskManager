import { useState } from 'react';
import { Project, UserProfile } from '../types';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Plus, Hash, Settings, LayoutGrid, LogOut, CheckSquare } from 'lucide-react';
import { projectService } from '../services/projectService';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { NotificationCenter } from './NotificationCenter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

import { Database, ShieldOff, Zap } from 'lucide-react';

interface SidebarProps {
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (project: Project) => void;
  user: UserProfile | null;
  onLogout: () => void;
  onClose?: () => void;
  onViewChange?: (view: string) => void;
  onMyTasksToggle?: () => void;
  onProfileOpen?: () => void;
  onDemoModeToggle?: () => void;
  isDemoMode?: boolean;
  currentView?: string;
  showOnlyMyTasks?: boolean;
}

export function Sidebar({ 
  projects, 
  currentProject, 
  onSelectProject, 
  user, 
  onLogout, 
  onClose,
  onViewChange,
  onMyTasksToggle,
  onProfileOpen,
  onDemoModeToggle,
  isDemoMode,
  currentView,
  showOnlyMyTasks
}: SidebarProps) {
  const [newProjectName, setNewProjectName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

  const handleProjectSelect = (project: Project) => {
    onSelectProject(project);
    if (onClose) onClose();
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      await projectService.createProject(newProjectName);
      setNewProjectName('');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to create project', error);
    }
  };

  const openSettings = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToEdit(project);
    setIsSettingsOpen(true);
  };

  return (
    <aside className="w-full h-full lg:w-64 border-r border-border/60 bg-sidebar flex flex-col shrink-0 overflow-hidden relative">
      <div className="p-6 flex items-center justify-between border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <CheckSquare className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">CleanTask</span>
        </div>
        <NotificationCenter onViewActivity={() => onViewChange?.('activity')} />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="py-6 space-y-6">
          <nav className="space-y-1.5 px-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2 mb-3">Menu</h3>
            <Button 
              variant="ghost" 
              className={`w-full justify-start gap-3 h-10 text-sm font-semibold rounded-lg group transition-all ${currentView === 'kanban' && !showOnlyMyTasks ? 'text-primary bg-secondary/80' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
              onClick={() => {
                onViewChange?.('kanban');
                if (onClose) onClose();
              }}
            >
              <LayoutGrid className={`h-4.5 w-4.5 ${currentView === 'kanban' && !showOnlyMyTasks ? 'text-primary' : 'opacity-60 group-hover:opacity-100'}`} /> Dashboard
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start gap-3 h-10 text-sm font-medium rounded-lg group transition-all ${showOnlyMyTasks ? 'text-primary bg-secondary/80' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
              onClick={() => {
                onMyTasksToggle?.();
                if (onClose) onClose();
              }}
            >
              <CheckSquare className={`h-4.5 w-4.5 ${showOnlyMyTasks ? 'text-primary' : 'opacity-60 group-hover:opacity-100'}`} /> My Tasks
            </Button>
          </nav>
          
          <div className="px-4 space-y-1.5">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2 mb-3">System</h3>
            <Button 
                variant="ghost" 
                className={`w-full justify-start gap-3 h-10 text-sm font-semibold rounded-lg group transition-all ${isDemoMode ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                onClick={onDemoModeToggle}
              >
              {isDemoMode ? <Zap className="h-4.5 w-4.5 fill-current" /> : <Database className="h-4.5 w-4.5" />}
              {isDemoMode ? 'Offline Mode' : 'Cloud Sync'}
            </Button>
          </div>

          <div className="px-4">
            <div className="flex items-center justify-between px-2 mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Workspaces</h3>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild nativeButton={true}>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-secondary/60">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Workspace</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Workspace Name</Label>
                      <Input 
                        id="name" 
                        placeholder="e.g. Engineering" 
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateProject}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-1">
              {projects.map((project) => (
                <div key={project.id} className="relative group px-1">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 h-10 text-sm font-medium rounded-lg px-3 pr-8 transition-all ${currentProject?.id === project.id ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                    onClick={() => handleProjectSelect(project)}
                  >
                    <Hash className={`h-4 w-4 shrink-0 transition-opacity ${currentProject?.id === project.id ? 'opacity-100' : 'opacity-40'}`} />
                    <span className="truncate flex-1 text-left">{project.name}</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-all ${currentProject?.id === project.id ? 'text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10' : 'text-muted-foreground/60 hover:text-foreground hover:bg-secondary'}`}
                    onClick={(e) => openSettings(e, project)}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {projects.length === 0 && (
                <p className="text-[10px] text-muted-foreground px-3 py-2 italic">No workspaces created.</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border/40 bg-muted/5 shrink-0">
        <div 
          className="flex items-center gap-3 mb-4 px-2 cursor-pointer hover:bg-secondary/40 p-2 rounded-xl transition-all group"
          onClick={onProfileOpen}
        >
          <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border border-border/60 group-hover:ring-2 group-hover:ring-primary/20">
            <AvatarImage src={user?.photoURL || undefined} />
            <AvatarFallback className="text-[10px] bg-secondary text-primary font-bold">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors">{user?.displayName || 'User'}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate font-medium">{user?.email || 'Demo'}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start gap-3 h-10 text-sm font-semibold border-border/60 hover:bg-secondary/80 rounded-lg group transition-all" onClick={onLogout}>
          <LogOut className="h-4 w-4 text-muted-foreground group-hover:text-foreground" /> Sign Out
        </Button>
      </div>

      <ProjectSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        project={projectToEdit}
      />
    </aside>
  );
}
