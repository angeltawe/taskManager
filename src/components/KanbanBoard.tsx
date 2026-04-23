import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Task, TaskStatus, UserProfile, Presence, Project } from '../types';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { presenceService } from '../services/presenceService';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { 
  Plus, MoreVertical, Calendar, Flag, MessageSquare, 
  CheckSquare, Repeat, Paperclip, Users as UsersIcon,
  Circle
} from 'lucide-react';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
  onTaskClick?: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
}

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];

export function KanbanBoard({ tasks, projectId, onTaskClick, onAddTask }: KanbanBoardProps) {
  const [projectUsers, setProjectUsers] = useState<Record<string, UserProfile>>({});
  const [presence, setPresence] = useState<Presence[]>([]);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (projectId) {
      loadProjectData();
      presenceService.updatePresence(projectId);
      const unsub = presenceService.subscribeToProjectPresence(projectId, setPresence);
      const interval = setInterval(() => presenceService.updatePresence(projectId), 60000); // 1 min heartbeats
      
      return () => {
        unsub();
        clearInterval(interval);
      };
    }
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      const p = await projectService.getProjectById(projectId);
      if (!p) return;
      setProject(p);
      
      const uids = [p.ownerId, ...(p.collaborators || [])];
      const users = await userService.getUsersByIds(uids);
      
      const userMap: Record<string, UserProfile> = {};
      users.forEach(u => userMap[u.uid] = u);
      setProjectUsers(userMap);
    } catch (err) {
      console.error('Failed to load project users', err);
    }
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;

    if (task.status !== destination.droppableId) {
      await taskService.updateTaskStatus(task.id, destination.droppableId as TaskStatus, task);
    }
  };

  const getUrgencyColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-500/10';
      case 'high': return 'text-orange-600 bg-orange-500/10';
      case 'medium': return 'text-blue-600 bg-blue-500/10';
      default: return 'text-emerald-600 bg-emerald-500/10';
    }
  };

  const themeStyle = project?.themeBackground ? {
    backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.94)), url(${project.themeBackground})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed'
  } : {};

  return (
    <div className="h-full flex flex-col transition-all duration-700" style={themeStyle}>
      {/* Presence Header */}
      <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-500 delay-150">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Live Collaborators</span>
        </div>
        <div className="flex -space-x-2 overlap-avatars">
          <TooltipProvider>
            {presence.map((p) => (
              <Tooltip key={p.userId}>
                <TooltipTrigger>
                  <Avatar className="h-8 w-8 ring-4 ring-background border-2 border-primary/20 shadow-lg cursor-help transition-transform hover:-translate-y-1">
                    <AvatarImage src={p.userPhoto || undefined} />
                    <AvatarFallback className="bg-secondary text-primary text-[10px] font-bold">
                      {p.userName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent className="border-none shadow-xl bg-slate-900 text-white font-bold text-[11px] px-3 py-1.5">
                  {p.userName} {p.taskId ? `is viewing task...` : 'is active on board'}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-8 h-full overflow-x-auto pb-8 scrollbar-hide">
          {COLUMNS.map((column, colIdx) => (
            <div key={column.id} className="w-[300px] shrink-0 flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${colIdx * 100}ms` }}>
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-[12px] font-bold tracking-[0.15em] uppercase text-foreground/70">{column.label}</h3>
                  <Badge variant="secondary" className="h-5 px-1.5 font-mono text-[9px] border border-border/50">
                    {tasks.filter(t => t.status === column.id).length}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-40 hover:opacity-100 hover:bg-primary/5 hover:text-primary transition-all" onClick={() => onAddTask?.(column.id)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 min-h-[500px] rounded-[20px] p-2 transition-all duration-300 ${snapshot.isDraggingOver ? 'bg-primary/[0.03] ring-1 ring-inset ring-primary/10 shadow-inner' : 'bg-transparent border border-dashed border-border/40'}`}
                  >
                    <div className="flex flex-col gap-4">
                      {tasks
                        .filter(t => t.status === column.id)
                        .map((task, index) => {
                          const hasAttachments = task.attachments && task.attachments.length > 0;
                          const hasComments = task.id; // Usually count comments but we'll show icon if task exists
                          const taskPresence = presence.filter(p => p.taskId === task.id);

                          return (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => onTaskClick?.(task)}
                                  className={`group relative select-none rounded-2xl border border-border/60 bg-card p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-all hover:shadow-xl hover:border-primary/30 hover:-translate-y-0.5 ${snapshot.isDragging ? 'rotate-2 scale-[1.03] shadow-2xl border-primary ring-4 ring-primary/10 z-50' : ''}`}
                                  style={{
                                    ...provided.draggableProps.style,
                                    borderTopColor: project?.themeColor && column.id === 'in-progress' ? project.themeColor : undefined,
                                    borderTopWidth: project?.themeColor && column.id === 'in-progress' ? '3px' : undefined
                                  }}
                                >
                                  {/* Task Presence Indicators */}
                                  {taskPresence.length > 0 && (
                                    <div className="absolute -top-2 -right-1 flex -space-x-1">
                                      {taskPresence.map(p => (
                                        <div key={p.userId} className="h-4 w-4 rounded-full border-2 border-background ring-2 ring-emerald-500/20 bg-emerald-500 animate-pulse shrink-0" />
                                      ))}
                                    </div>
                                  )}

                                  <div className="space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex flex-wrap gap-2">
                                        <Badge 
                                          variant="secondary" 
                                          className={`text-[9px] h-5 px-2 border-none uppercase font-bold tracking-tight rounded-md ${getUrgencyColor(task.priority)}`}
                                        >
                                          {task.priority}
                                        </Badge>
                                        {task.recurrence && task.recurrence !== 'none' && (
                                          <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-border/50 text-muted-foreground uppercase font-bold tracking-wide rounded-md">
                                            <Repeat className="h-3 w-3 mr-1" />
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex -space-x-2">
                                        {task.assigneeId && projectUsers[task.assigneeId] ? (
                                          <Avatar className="h-7 w-7 border-2 border-card ring-1 ring-border shadow-sm">
                                            <AvatarImage src={projectUsers[task.assigneeId].photoURL || undefined} />
                                            <AvatarFallback className="text-[8px] bg-secondary text-primary font-bold">{projectUsers[task.assigneeId].displayName?.charAt(0) || '?'}</AvatarFallback>
                                          </Avatar>
                                        ) : (
                                          <div className="h-7 w-7 rounded-full border border-dashed border-border/60 flex items-center justify-center text-muted-foreground/20">
                                            <Plus className="h-2.5 w-2.5" />
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <h4 className="font-bold text-sm tracking-tight text-foreground leading-[1.3] group-hover:text-primary transition-colors">{task.title}</h4>
                                      {task.description && (
                                        <p className="text-[12px] text-muted-foreground/60 line-clamp-2 leading-relaxed font-medium">{task.description}</p>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/30">
                                      <div className="flex items-center gap-3">
                                        {hasAttachments && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger className="flex items-center gap-1 text-muted-foreground/40 hover:text-primary transition-colors">
                                                <Paperclip className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-mono leading-none">{task.attachments?.length}</span>
                                              </TooltipTrigger>
                                              <TooltipContent className="text-[10px] font-bold">{task.attachments?.length} File Attachments</TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                        {task.subtasks && task.subtasks.length > 0 && (
                                          <div className="flex items-center gap-1 text-muted-foreground/40">
                                            <CheckSquare className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-mono leading-none">
                                              {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {task.dueDate && (
                                        <div className={`flex items-center gap-1.5 text-[10px] font-bold tracking-tight px-2 py-0.5 rounded-full ${new Date(task.dueDate.toDate ? task.dueDate.toDate() : task.dueDate) < new Date() && task.status !== 'done' ? 'text-red-500 bg-red-50' : 'text-muted-foreground/60 bg-muted/30'}`}>
                                          <Calendar className="h-3 w-3" />
                                          {format(task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate), 'MMM d')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
