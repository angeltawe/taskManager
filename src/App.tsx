/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { Project, Task, TaskStatus, UserProfile } from './types';
import { projectService } from './services/projectService';
import { taskService } from './services/taskService';
import { userService } from './services/userService';
import { notificationService } from './services/notificationService';
import { localService } from './services/localService';
import { Sidebar } from './components/Sidebar';
import { KanbanBoard } from './components/KanbanBoard';
import { ListView } from './components/ListView';
import { Analytics } from './components/Analytics';
import { ActivityFeed } from './components/ActivityFeed';
import { TaskModal } from './components/TaskModal';
import { UserProfileModal } from './components/UserProfileModal';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Layout, CheckCircle2, LayoutDashboard, ListTodo, Calendar as CalendarIcon, Loader2, LogOut, Download, LayoutGrid, Menu, Activity, Zap } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';
import { Badge } from './components/ui/badge';
import { useIsMobile } from './hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet';
import { ThemeToggle } from './components/ThemeToggle';
import { TooltipProvider } from './components/ui/tooltip';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'kanban' | 'list' | 'analytics' | 'activity'>('kanban');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [targetStatus, setTargetStatus] = useState<TaskStatus>('todo');
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(localService.isDemoMode());
  const isMobile = useIsMobile();

  const toggleDemoMode = () => {
    const next = !isDemoMode;
    localService.setDemoMode(next);
    setIsDemoMode(next);
    // Reload to reset all subscriptions and state
    window.location.reload();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ALT + N: Switch view or similar logic? 
      // Let's do simple shortcuts
      if (e.altKey && (e.key === 't' || e.key === 'b')) {
        setView('kanban');
      }
      if (e.altKey && e.key === 'l') {
        setView('list');
      }
      if (e.altKey && e.key === 'a') {
        setView('analytics');
      }
      if (e.altKey && e.key === 'v') {
        setView('activity');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user && !isDemoMode) return;
    const unsub = projectService.subscribeToUserProjects((projs) => {
      setProjects(projs);
      // Sync current project with live data
      if (projs.length > 0) {
        if (!currentProject) {
          const lastProjectId = localStorage.getItem('cleantask_last_project');
          const lastProject = projs.find(p => p.id === lastProjectId) || projs[0];
          setCurrentProject(lastProject);
        } else {
          const updated = projs.find(p => p.id === currentProject.id);
          if (updated) {
            // Use a shallow check of essential fields to avoid loops with complex objects
            if (updated.name !== currentProject.name || 
                updated.isArchived !== currentProject.isArchived ||
                updated.collaborators?.length !== currentProject.collaborators?.length ||
                updated.collaboratorEmails?.length !== currentProject.collaboratorEmails?.length) {
              setCurrentProject(updated);
            }
          } else {
            // Project might have been deleted or archived by someone else
            setCurrentProject(projs[0]);
          }
        }
      } else {
        setCurrentProject(null);
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!currentProject) {
      setTasks([]);
      return;
    }
    localStorage.setItem('cleantask_last_project', currentProject.id);
    const unsub = taskService.subscribeToProjectTasks(currentProject.id, (tks) => {
      setTasks(tks);
    });
    return () => unsub();
  }, [currentProject]);

  useEffect(() => {
    if (isDemoMode) {
      setUserProfile(localService.getUser());
      return;
    }
    if (user) {
      userService.ensureUserProfile();
      userService.getUserProfile(user.uid).then(profile => {
        setUserProfile(profile);
      });
    } else {
      setUserProfile(null);
    }
  }, [user, isDemoMode]);

  useEffect(() => {
    if (tasks.length > 0 && currentProject) {
      notificationService.checkDueDates(tasks, currentProject);
    }
  }, [tasks, currentProject]);

  useEffect(() => {
    if (currentProject?.themeColor) {
      document.documentElement.style.setProperty('--primary', currentProject.themeColor);
      document.documentElement.style.setProperty('--sidebar-primary', currentProject.themeColor);
    } else {
      // Reset to defaults if no theme color or no project
      const isDark = document.documentElement.classList.contains('dark');
      document.documentElement.style.setProperty('--primary', isDark ? '#FAFAFA' : '#18181B');
      document.documentElement.style.setProperty('--sidebar-primary', isDark ? '#FAFAFA' : '#18181B');
    }
  }, [currentProject]);

  const filteredTasks = tasks.filter(task => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.tags?.some(tag => tag.toLowerCase().includes(query))
    );
    const matchesMyTasks = !showOnlyMyTasks || task.assigneeId === (user?.uid || userProfile?.uid);
    return matchesSearch && matchesMyTasks;
  });

  const handleTaskClick = (task: Task) => {
    setEditingTask(task);
    setTargetStatus(task.status);
    setIsTaskModalOpen(true);
  };

  const handleAddTask = (status: TaskStatus = 'todo') => {
    setEditingTask(null);
    setTargetStatus(status);
    setIsTaskModalOpen(true);
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => auth.signOut();

  if (loading && !isDemoMode) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !isDemoMode) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full border-none shadow-2xl">
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">CleanTask</CardTitle>
            <CardDescription className="text-base">
              Enterprise workflow orchestration. Synchronize your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLogin} className="w-full h-12 text-lg font-medium shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl" size="lg">
              Sign in with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-bold tracking-widest">Or</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={toggleDemoMode} 
              className="w-full h-12 font-bold border-border/60 hover:bg-secondary/40 transition-all rounded-xl gap-2"
            >
              <Zap className="h-4 w-4 fill-primary text-primary" />
              Continue as Guest (Offline)
            </Button>

            <p className="text-center text-xs text-muted-foreground italic pt-2">
              Experience focused productivity today.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex bg-background h-screen overflow-hidden">
      {!isMobile && (
        <Sidebar 
          projects={projects} 
          currentProject={currentProject} 
          onSelectProject={setCurrentProject}
          user={userProfile}
          onLogout={handleLogout}
          onViewChange={(v) => { setView(v as any); setShowOnlyMyTasks(false); }}
          onMyTasksToggle={() => setShowOnlyMyTasks(true)}
          onProfileOpen={() => setIsProfileModalOpen(true)}
          onDemoModeToggle={toggleDemoMode}
          isDemoMode={isDemoMode}
          currentView={view}
          showOnlyMyTasks={showOnlyMyTasks}
        />
      )}
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-[60px] border-b flex items-center justify-between px-3 md:px-6 lg:px-8 shrink-0 bg-background sticky top-0 z-10">
          <div className="flex items-center gap-1.5 md:gap-6">
            {isMobile && (
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger nativeButton={true} render={
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                } />
                <SheetContent side="left" className="p-0 border-none w-64 bg-sidebar" showCloseButton={false}>
                  <Sidebar 
                    projects={projects} 
                    currentProject={currentProject} 
                    onSelectProject={setCurrentProject}
                    user={userProfile}
                    onLogout={handleLogout}
                    onClose={() => setIsMobileMenuOpen(false)}
                    onViewChange={(v) => { setView(v as any); setShowOnlyMyTasks(false); }}
                    onMyTasksToggle={() => setShowOnlyMyTasks(true)}
                    onProfileOpen={() => {
                      setIsProfileModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    currentView={view}
                    showOnlyMyTasks={showOnlyMyTasks}
                  />
                </SheetContent>
              </Sheet>
            )}
            <div className="relative group hidden sm:block">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <LayoutGrid className="h-4 w-4 text-muted-foreground/40" />
              </div>
              <input 
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-secondary/40 hover:bg-secondary/60 transition-colors rounded-full pl-10 pr-4 py-2 w-[150px] md:w-[220px] lg:w-[280px] xl:w-[320px] text-[13px] text-foreground font-medium border-none focus:outline-none focus:ring-1 focus:ring-ring/20 placeholder:text-muted-foreground/50"
              />
            </div>
            {isMobile && <span className="font-extrabold text-sm uppercase tracking-tighter text-primary ml-1">CleanTask.</span>}
          </div>
          
          <div className="flex items-center gap-2 lg:gap-4">
            <ThemeToggle />
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-sm font-semibold text-foreground leading-tight truncate max-w-[120px] lg:max-w-[180px]">
                {userProfile?.displayName || 'Demo User'}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] font-bold opacity-60">
                {isDemoMode ? 'Offline Workspace' : 'Workspace Owner'}
              </span>
            </div>
            <Avatar 
              className="h-8 w-8 lg:h-9 lg:w-9 border border-border shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              onClick={() => setIsProfileModalOpen(true)}
            >
              <AvatarImage src={userProfile?.photoURL || undefined} />
              <AvatarFallback className="text-xs bg-secondary text-primary font-bold">
                {userProfile?.displayName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <div 
          className="flex-1 overflow-auto bg-background/95 p-4 lg:p-8 relative"
          style={currentProject?.themeBackground ? {
            backgroundImage: `linear-gradient(rgba(var(--background-rgb, 255, 255, 255), 0.95), rgba(var(--background-rgb, 255, 255, 255), 0.95)), url(${currentProject.themeBackground})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          } : {}}
        >
          {!currentProject ? (
            <div className="flex h-full items-center justify-center flex-col text-center opacity-40">
              <Layout className="h-12 w-12 mb-3 text-muted-foreground" />
              <h2 className="text-lg font-bold tracking-tight">Project Workspace</h2>
              <p className="text-xs text-muted-foreground">Select a workspace from the sidebar to begin.</p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground truncate">
                      {showOnlyMyTasks ? 'My Tasks' : currentProject.name}
                    </h1>
                    {showOnlyMyTasks && (
                      <Badge variant="secondary" className="w-fit bg-primary/10 text-primary border-none text-[10px] font-bold uppercase tracking-wider h-5 lg:ml-2">
                        Personal View
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 font-medium">
                    <Activity className="h-4 w-4" />
                    {showOnlyMyTasks ? 'Showing tasks assigned to you' : 'Real-time workspace synchronization enabled'}
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  <div className="w-full sm:hidden">
                    <div className="relative group w-full">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <LayoutGrid className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      <input 
                        type="text"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-secondary/40 hover:bg-secondary/60 transition-colors rounded-xl pl-10 pr-4 py-2.5 w-full text-[13px] text-foreground font-medium border-none focus:outline-none focus:ring-1 focus:ring-ring/20 placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  <Tabs value={view} onValueChange={(v) => { setView(v as any); setShowOnlyMyTasks(false); }} className="bg-muted/50 border rounded-lg p-1 h-11 w-full lg:w-auto">
                    <TabsList className="bg-transparent h-full p-0 gap-1 w-full lg:w-auto flex">
                      <TabsTrigger value="kanban" className="flex-1 lg:flex-none text-xs font-semibold h-full px-4 lg:px-6 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm border-none rounded-md transition-all">
                        Board
                      </TabsTrigger>
                      <TabsTrigger value="list" className="flex-1 lg:flex-none text-xs font-semibold h-full px-4 lg:px-6 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm border-none rounded-md transition-all">
                        List
                      </TabsTrigger>
                      <TabsTrigger value="analytics" className="hidden sm:flex flex-1 lg:flex-none text-xs font-semibold h-full px-4 lg:px-6 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm border-none rounded-md transition-all">
                        Insights
                      </TabsTrigger>
                      <TabsTrigger value="activity" className="hidden sm:flex flex-1 lg:flex-none text-xs font-semibold h-full px-4 lg:px-6 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm border-none rounded-md transition-all">
                        Activity
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  
                  <div className="hidden lg:block h-6 w-px bg-border mx-1" />

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => taskService.exportToICal(filteredTasks, currentProject?.name || 'CleanTask')}
                    className="hidden sm:flex items-center justify-center gap-2 text-xs font-semibold h-11 border-border bg-background hover:bg-secondary px-5 transition-colors"
                    disabled={!currentProject || filteredTasks.length === 0}
                  >
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </div>
              </div>

              <div className="bg-transparent min-h-0 overflow-visible">
                {view === 'kanban' && <KanbanBoard 
                  tasks={filteredTasks} 
                  projectId={currentProject.id} 
                  onTaskClick={handleTaskClick}
                  onAddTask={handleAddTask}
                />}
                {view === 'list' && <ListView 
                  tasks={filteredTasks} 
                  projectId={currentProject.id} 
                  onTaskClick={handleTaskClick}
                />}
                {view === 'analytics' && <Analytics tasks={filteredTasks} />}
                {view === 'activity' && <ActivityFeed projectId={currentProject.id} />}
              </div>

              <TaskModal 
                isOpen={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                task={editingTask}
                projectId={currentProject.id}
                defaultStatus={targetStatus}
              />

              {userProfile && (
                <UserProfileModal 
                  isOpen={isProfileModalOpen}
                  onClose={() => setIsProfileModalOpen(false)}
                  user={userProfile}
                  tasks={tasks}
                />
              )}
            </div>
          )}
        </div>
      </main>
      </div>
    </TooltipProvider>
  );
}

