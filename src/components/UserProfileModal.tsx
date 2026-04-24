import { useState, useEffect } from 'react';
import { UserProfile, Task } from '../types';
import { userService } from '../services/userService';
import { taskService } from '../services/taskService';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from './ui/scroll-area';
import { 
  User, 
  Settings, 
  Activity, 
  CheckCircle2, 
  Clock, 
  Layout, 
  Loader2, 
  Mail, 
  Calendar,
  Camera
} from 'lucide-react';
import { format } from 'date-fns';
import { toDate } from '../lib/utils';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  tasks: Task[];
}

export function UserProfileModal({ isOpen, onClose, user, tasks }: UserProfileModalProps) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const userTasks = tasks.filter(t => t.assigneeId === user.uid);
  const completedTasks = userTasks.filter(t => t.status === 'done');
  const pendingTasks = userTasks.filter(t => t.status !== 'done');
  
  const completionRate = userTasks.length > 0 
    ? Math.round((completedTasks.length / userTasks.length) * 100) 
    : 0;

  useEffect(() => {
    if (isOpen) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
    }
  }, [isOpen, user]);

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await userService.updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        photoURL: photoURL.trim() || null
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <ScrollArea className="flex-1">
          <div className="relative h-32 bg-primary/10">
            <div className="absolute -bottom-12 left-8">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-4 border-background ring-1 ring-border shadow-xl">
                  <AvatarImage src={photoURL || undefined} />
                  <AvatarFallback className="text-2xl bg-secondary text-primary font-bold">
                    {user.displayName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-8 pt-16 pb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{user.displayName}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-medium mt-0.5">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </p>
              </div>
              <div className="bg-primary/10 px-3 py-1 rounded-full">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Enterprise User</p>
              </div>
            </div>

            <Tabs defaultValue="overview" className="w-full mt-8">
              <TabsList className="bg-secondary/50 p-1 w-full flex">
                <TabsTrigger value="overview" className="flex-1 gap-2 font-bold text-xs sm:text-sm"><Activity className="h-4 w-4" /> Overview</TabsTrigger>
                <TabsTrigger value="tasks" className="flex-1 gap-2 font-bold text-xs sm:text-sm"><CheckCircle2 className="h-4 w-4" /> My Tasks</TabsTrigger>
                <TabsTrigger value="settings" className="flex-1 gap-2 font-bold text-xs sm:text-sm"><Settings className="h-4 w-4" /> Edit Profile</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="bg-muted/30 p-4 rounded-xl border border-border/40 text-center">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Assigned</p>
                    <p className="text-xl font-bold text-foreground">{userTasks.length}</p>
                  </div>
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 text-center">
                    <p className="text-[10px] uppercase font-bold text-primary tracking-widest mb-1">Completed</p>
                    <p className="text-xl font-bold text-primary">{completedTasks.length}</p>
                  </div>
                  <div className="bg-orange-500/5 p-4 rounded-xl border border-orange-500/20 text-center">
                    <p className="text-[10px] uppercase font-bold text-orange-600 tracking-widest mb-1">Pending</p>
                    <p className="text-xl font-bold text-orange-600">{pendingTasks.length}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-secondary/20 p-4 rounded-xl border border-border/40">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-bold">Task Completion</span>
                      </div>
                      <span className="text-sm font-bold font-mono">{completionRate}%</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500 ease-out" 
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium px-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {user.createdAt ? format(toDate(user.createdAt) || new Date(), 'MMMM yyyy') : 'Recently'}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="mt-6">
                <div className="space-y-3">
                  {userTasks.length > 0 ? (
                    userTasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-muted/20 border border-border/40 rounded-xl hover:bg-muted/30 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            task.priority === 'urgent' ? 'bg-red-500' :
                            task.priority === 'high' ? 'bg-orange-500' :
                            task.priority === 'medium' ? 'bg-blue-500' :
                            'bg-slate-400'
                          }`} />
                          <span className={`text-sm font-semibold truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {task.dueDate && (
                            <span className="text-[10px] font-bold text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                              {format(toDate(task.dueDate) || new Date(), 'MMM d')}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
                            task.status === 'done' ? 'bg-emerald-500/10 text-emerald-600' :
                            task.status === 'in-progress' ? 'bg-blue-500/10 text-blue-600' :
                            'bg-slate-500/10 text-slate-600'
                          }`}>
                            {task.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-muted/10 rounded-2xl border border-dashed border-border/60">
                      <Layout className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm font-bold text-muted-foreground">No tasks assigned to you yet.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Display Name</Label>
                    <Input 
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your name"
                      className="h-11 bg-muted/20 border-border/40 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="photoURL" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Photo URL</Label>
                    <Input 
                      id="photoURL"
                      value={photoURL}
                      onChange={(e) => setPhotoURL(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="h-11 bg-muted/20 border-border/40 focus:ring-primary/20"
                    />
                    <p className="text-[10px] text-muted-foreground italic px-1">Leave empty to use your Google profile photo.</p>
                  </div>
                </div>

                {error && <p className="text-xs text-destructive font-bold">{error}</p>}

                <Button 
                  onClick={handleUpdateProfile} 
                  className="w-full h-12 font-bold shadow-lg shadow-primary/20"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : 'Update Profile'}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter className="px-8 py-4 bg-muted/5 border-t border-border/40 shrink-0">
          <Button variant="ghost" onClick={onClose} className="text-sm font-bold text-muted-foreground hover:text-foreground">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
