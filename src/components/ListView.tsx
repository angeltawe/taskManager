import { useState, useEffect } from 'react';
import { Task, UserProfile } from '../types';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { format } from 'date-fns';
import { toDate } from '../lib/utils';
import { Flag, Calendar, Trash2, Archive } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface ListViewProps {
  tasks: Task[];
  projectId: string;
  onTaskClick?: (task: Task) => void;
}

export function ListView({ tasks, projectId, onTaskClick }: ListViewProps) {
  const [projectUsers, setProjectUsers] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    if (projectId) {
      loadProjectUsers();
    }
  }, [projectId]);

  const loadProjectUsers = async () => {
    try {
      const project = await projectService.getProjectById(projectId);
      if (!project) return;
      
      const uids = [project.ownerId, ...(project.collaborators || [])];
      const users = await userService.getUsersByIds(uids);
      
      const userMap: Record<string, UserProfile> = {};
      users.forEach(u => userMap[u.uid] = u);
      setProjectUsers(userMap);
    } catch (err) {
      console.error('Failed to load project users', err);
    }
  };

  const toggleStatus = (task: Task) => {
    taskService.toggleTaskStatus(task);
  };

  const priorityColors = {
    urgent: 'text-red-600 bg-red-50',
    high: 'text-red-600 bg-red-50',
    medium: 'text-blue-600 bg-blue-50',
    low: 'text-green-600 bg-green-50'
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="overflow-x-auto w-full">
        <Table className="w-full">
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-b border-border/60">
              <TableHead className="w-14 pl-6"></TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 py-4">Task Name</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 py-4">Status</TableHead>
              <TableHead className="hidden sm:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 py-4">Assignee</TableHead>
              <TableHead className="hidden lg:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 py-4">Priority</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 py-4">Due Date</TableHead>
              <TableHead className="text-right pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} className="group hover:bg-secondary/20 transition-colors border-b border-border/40">
                <TableCell className="pl-6">
                  <Checkbox 
                    checked={task.status === 'done'} 
                    onCheckedChange={() => toggleStatus(task)}
                    className="h-4.5 w-4.5 rounded-[4px] border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex flex-col gap-0.5" onClick={() => onTaskClick?.(task)}>
                    <div className="flex items-center gap-2">
                      <div 
                        className={`lg:hidden w-1.5 h-6 rounded-full shrink-0 ${
                          task.priority === 'urgent' ? 'bg-red-500' : 
                          task.priority === 'high' ? 'bg-orange-500' : 
                          task.priority === 'medium' ? 'bg-blue-500' : 
                          'bg-emerald-500'
                        }`}
                        title={task.priority}
                      />
                      <span className={`text-[14px] font-semibold tracking-tight transition-colors ${task.status === 'done' ? 'line-through text-muted-foreground/50' : 'text-foreground hover:text-primary cursor-pointer'}`}>
                        {task.title}
                      </span>
                    </div>
                    {task.description && (
                      <span className="text-[12px] text-muted-foreground/70 line-clamp-1 font-medium lg:ml-0 md:ml-3.5 sm:ml-3.5 ml-3.5">{task.description}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant={task.status === 'done' ? 'outline' : 'secondary'} className={`capitalize text-[10px] h-5 px-2 font-bold tracking-wide rounded-md ${task.status === 'done' ? 'bg-muted/20 text-muted-foreground' : 'bg-primary/5 text-primary border-none'}`}>
                    {task.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {task.assigneeId && projectUsers[task.assigneeId] ? (
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-6 w-6 border-2 border-background ring-1 ring-border shadow-sm">
                        <AvatarImage src={projectUsers[task.assigneeId].photoURL || undefined} />
                        <AvatarFallback className="text-[7px] bg-secondary text-primary font-bold">
                          {projectUsers[task.assigneeId].displayName?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold text-foreground/80">{projectUsers[task.assigneeId].displayName || 'Team Member'}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/40 font-medium italic">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge 
                    variant="secondary" 
                    className={`text-[9px] h-4.5 px-2 border-none uppercase font-bold tracking-wide rounded-md
                      ${task.priority === 'urgent' ? 'text-red-600 bg-red-500/10' : 
                        task.priority === 'high' ? 'text-orange-600 bg-orange-500/10' : 
                        task.priority === 'medium' ? 'text-blue-600 bg-blue-500/10' : 
                        'text-emerald-600 bg-emerald-500/10'}`}
                  >
                    {task.priority}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {task.dueDate ? (
                    <div className={`flex items-center gap-2 text-[12px] font-semibold ${(toDate(task.dueDate) || new Date()) < new Date() && task.status !== 'done' ? 'text-red-500' : 'text-muted-foreground/70'}`}>
                      <Calendar className="h-3.5 w-3.5 opacity-60" />
                      {format(toDate(task.dueDate) || new Date(), 'MMM d, yyyy')}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/30 font-medium">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex justify-end gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100" 
                      onClick={() => taskService.archiveTask(task.id, projectId)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100" 
                      onClick={() => taskService.deleteTask(task.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground/60 font-medium italic">
                  Complete your workspace by adding your first task.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
