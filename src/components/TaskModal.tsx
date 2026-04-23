import { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Priority, UserProfile, Attachment, ProjectRole } from '../types';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { attachmentService } from '../services/attachmentService';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { 
  CalendarIcon, Trash2, Archive, Repeat, CheckSquare, Plus, X, 
  Sparkles, Brain, Loader2, Send, MessageSquare, Hash, 
  Paperclip, FileText, Download, User as UserIcon
} from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { geminiService } from '../services/geminiService';
import { ActivityFeed } from './ActivityFeed';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import { Comment } from '../types';
import { auth } from '../lib/firebase';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  projectId: string;
  defaultStatus?: TaskStatus;
}

export function TaskModal({ isOpen, onClose, task, projectId, defaultStatus }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [recurrence, setRecurrence] = useState<string>('none');
  const [subtasks, setSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [collaborators, setCollaborators] = useState<UserProfile[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [isAiSubtaskLoading, setIsAiSubtaskLoading] = useState(false);
  const [isAiPriorityLoading, setIsAiPriorityLoading] = useState(false);
  const [isPreviewingMarkdown, setIsPreviewingMarkdown] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userRole, setUserRole] = useState<ProjectRole>('viewer');
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (task && isOpen) {
      const unsub = taskService.subscribeToComments(task.id, setComments);
      return () => unsub();
    } else {
      setComments([]);
    }
  }, [task, isOpen]);

  useEffect(() => {
    if (isOpen && projectId) {
      loadProjectInfo();
    }
  }, [isOpen, projectId]);

  const loadProjectInfo = async () => {
    try {
      const project = await projectService.getProjectById(projectId);
      if (!project) return;
      
      const uids = [project.ownerId, ...(project.collaborators || [])];
      const users = await userService.getUsersByIds(uids);
      setCollaborators(users);

      if (currentUser) {
        const role = project.memberRoles?.[currentUser.uid] || (project.ownerId === currentUser.uid ? 'admin' : 'member');
        setUserRole(role as ProjectRole);
      }
    } catch (err) {
      console.error('Failed to load project info', err);
    }
  };

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate?.toDate ? task.dueDate.toDate() : task.dueDate ? new Date(task.dueDate) : undefined);
      setRecurrence(task.recurrence || 'none');
      setSubtasks(task.subtasks || []);
      setTags(task.tags || []);
      setAssigneeId(task.assigneeId);
      setAttachments(task.attachments || []);
    } else {
      setTitle('');
      setDescription('');
      setStatus(defaultStatus || 'todo');
      setPriority('medium');
      setDueDate(undefined);
      setRecurrence('none');
      setSubtasks([]);
      setTags([]);
      setAssigneeId(undefined);
      setAttachments([]);
    }
  }, [task, isOpen, defaultStatus]);

  const canEdit = userRole === 'admin' || userRole === 'member';

  const handleSave = async () => {
    if (!title.trim() || !canEdit) return;

    const data = {
      title,
      description,
      status,
      priority,
      dueDate: dueDate || null,
      recurrence,
      projectId,
      subtasks,
      tags,
      assigneeId: assigneeId || null,
      attachments
    };

    try {
      if (task) {
        await taskService.updateTask(task.id, data);
      } else {
        await taskService.createTask(data);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save task', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task || !canEdit) return;

    setIsUploading(true);
    try {
      const attachment = await attachmentService.uploadAttachment(task.id, file);
      setAttachments([...attachments, attachment]);
    } catch (error) {
      console.error('Failed to upload attachment', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    if (!task || !canEdit) return;
    try {
      await attachmentService.deleteAttachment(task.id, attachment);
      setAttachments(attachments.filter(a => a.id !== attachment.id));
    } catch (error) {
      console.error('Failed to delete attachment', error);
    }
  };

  const addSubtask = () => {
    if (!newSubtask.trim() || !canEdit) return;
    setSubtasks([...subtasks, { id: Math.random().toString(36).substr(2, 9), title: newSubtask, completed: false }]);
    setNewSubtask('');
  };

  const toggleSubtask = (id: string) => {
    if (!canEdit) return;
    setSubtasks(subtasks.map(sh => sh.id === id ? { ...sh, completed: !sh.completed } : sh));
  };

  const removeSubtask = (id: string) => {
    if (!canEdit) return;
    setSubtasks(subtasks.filter(sh => sh.id !== id));
  };

  const addTag = () => {
    if (!newTag.trim() || tags.includes(newTag.trim()) || !canEdit) return;
    setTags([...tags, newTag.trim()]);
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    if (!canEdit) return;
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleAiSubtasks = async () => {
    if (!title.trim() || !canEdit) return;
    setIsAiSubtaskLoading(true);
    try {
      const suggested = await geminiService.generateSubtasks(title, description);
      const newSubtasks = suggested.map((s: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        title: s.title,
        completed: false
      }));
      setSubtasks([...subtasks, ...newSubtasks]);
    } finally {
      setIsAiSubtaskLoading(false);
    }
  };

  const handleAiPriority = async () => {
    if (!title.trim() || !canEdit) return;
    setIsAiPriorityLoading(true);
    try {
      const suggested = await geminiService.suggestPriority(title, description);
      setPriority(suggested);
    } finally {
      setIsAiPriorityLoading(false);
    }
  };

  const [projectMembers, setProjectMembers] = useState<UserProfile[]>([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [isMentionPopoverOpen, setIsMentionPopoverOpen] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProjectMembers();
    }
  }, [projectId]);

  const loadProjectMembers = async () => {
    try {
      const p = await projectService.getProjectById(projectId);
      if (!p) return;
      const uids = [p.ownerId, ...(p.collaborators || [])];
      const users = await userService.getUsersByIds(uids);
      setProjectMembers(users);
    } catch (err) {
      console.error('Failed to load project members for mentions', err);
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);

    // Detect mention trigger
    const words = value.split(' ');
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@')) {
      setMentionSearch(lastWord.slice(1));
      setIsMentionPopoverOpen(true);
    } else {
      setIsMentionPopoverOpen(false);
    }
  };

  const insertMention = (member: UserProfile) => {
    const words = newComment.split(' ');
    words.pop(); // Remove the partial @tag
    const newValue = [...words, `@${member.displayName || member.email}`].join(' ') + ' ';
    setNewComment(newValue);
    setIsMentionPopoverOpen(false);
  };

  const handleAddComment = async () => {
    if (!task || !newComment.trim() || !canEdit) return;
    try {
      // Find UIDs of mentioned users in the text
      const mentionedUIDs = projectMembers
        .filter(m => newComment.includes(`@${m.displayName || m.email}`))
        .map(m => m.uid);

      await taskService.addComment(task.id, newComment.trim(), projectId, mentionedUIDs);
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment', error);
    }
  };

  const handleArchive = async () => {
    if (!task || !canEdit) return;
    await taskService.archiveTask(task.id, projectId);
    onClose();
  };

  const handleDelete = async () => {
    if (!task || userRole !== 'admin') return;
    if (confirm('Are you sure you want to delete this task?')) {
      await taskService.deleteTask(task.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[95vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
                {task ? (canEdit ? 'Edit Task' : 'View Task') : 'Create New Task'}
              </DialogTitle>
              {!canEdit && (
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground border-border px-2">
                  Read Only
                </Badge>
              )}
            </div>
            {task && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] font-bold tracking-wider uppercase">
                ID: {task.id.slice(0, 8)}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 border-b border-border/40">
            <TabsList className="w-fit bg-transparent gap-6 h-12 p-0">
              <TabsTrigger value="details" className="relative h-full px-1 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary font-bold text-sm transition-all rounded-none">
                Details
              </TabsTrigger>
              <TabsTrigger value="comments" disabled={!task} className="relative h-full px-1 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary font-bold text-sm transition-all rounded-none">
                Comments {comments.length > 0 && <span className="ml-2 text-[11px] font-mono bg-secondary px-1.5 py-0.5 rounded border border-border">{comments.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="attachments" disabled={!task} className="relative h-full px-1 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary font-bold text-sm transition-all rounded-none">
                Files {attachments.length > 0 && <span className="ml-2 text-[11px] font-mono bg-secondary px-1.5 py-0.5 rounded border border-border">{attachments.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="history" disabled={!task} className="relative h-full px-1 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary font-bold text-sm transition-all rounded-none">
                History
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            <TabsContent value="details" className="space-y-8 mt-0 focus-visible:ring-0">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Task Title</Label>
                  <Input 
                    id="title" 
                    value={title} 
                    disabled={!canEdit}
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="Enter task title..."
                    className="text-xl font-bold h-14 border-border/60 bg-muted/20 focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                  />
                </div>
              
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Configuration</Label>
                    <div className="grid grid-cols-1 gap-4 bg-muted/20 p-4 rounded-xl border border-border/40">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-muted-foreground/80">Status</p>
                        <Select disabled={!canEdit} value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                          <SelectTrigger className="h-9 border-border/40 bg-zinc-50 dark:bg-zinc-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-muted-foreground/80">Priority</p>
                          {canEdit && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-5 px-1.5 text-[9px] uppercase font-bold text-primary gap-1 hover:bg-primary/5"
                              onClick={handleAiPriority}
                              disabled={isAiPriorityLoading}
                            >
                              {isAiPriorityLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                              Suggest
                            </Button>
                          )}
                        </div>
                        <Select disabled={!canEdit} value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                          <SelectTrigger className="h-9 border-border/40 bg-zinc-50 dark:bg-zinc-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Team & Schedule</Label>
                    <div className="grid grid-cols-1 gap-4 bg-muted/20 p-4 rounded-xl border border-border/40">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-muted-foreground/80">Assignee</p>
                        <Select disabled={!canEdit} value={assigneeId || 'unassigned'} onValueChange={(v) => setAssigneeId(v === 'unassigned' ? undefined : v)}>
                          <SelectTrigger className="h-9 border-border/40 bg-zinc-50 dark:bg-zinc-900">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {collaborators.map(user => (
                              <SelectItem key={user.uid} value={user.uid}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-4 w-4 border border-border/60">
                                    <AvatarImage src={user.photoURL || undefined} />
                                    <AvatarFallback className="text-[6px] bg-secondary text-primary font-bold">{user.displayName?.charAt(0) || '?'}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-medium">{user.displayName || user.email}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-muted-foreground/80">Deadline</p>
                        <Popover>
                          <PopoverTrigger asChild disabled={!canEdit}>
                            <Button variant="outline" className="w-full justify-start text-xs font-semibold h-9 border-border/40 bg-zinc-50 dark:bg-zinc-900 px-3">
                              <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-60" />
                              {dueDate ? format(dueDate, 'PP') : <span>Set due date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 border-none shadow-2xl">
                            <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="rounded-xl border border-border shadow-sm" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Description</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-[10px] uppercase font-bold text-muted-foreground hover:bg-secondary/60"
                      onClick={() => setIsPreviewingMarkdown(!isPreviewingMarkdown)}
                    >
                      {isPreviewingMarkdown ? 'Switch to Edit' : 'Markdown Preview'}
                    </Button>
                  </div>
                  {isPreviewingMarkdown ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none p-5 border border-border/60 rounded-xl bg-muted/10 min-h-[140px] shadow-inner">
                      <ReactMarkdown>{description || '*No description provided for this task.*'}</ReactMarkdown>
                    </div>
                  ) : (
                    <Textarea 
                      id="description" 
                      value={description} 
                      disabled={!canEdit}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter detailed documentation, requirements, or notes (Markdown supported)..."
                      className="resize-none min-h-[140px] border-border/60 bg-muted/20 focus-visible:ring-primary/20 p-5 rounded-xl text-sm leading-relaxed"
                    />
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Subtasks</Label>
                    {canEdit && (
                      <div className="bg-primary/5 rounded-lg border border-primary/20 px-2 py-1 flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-5 p-0 text-[10px] uppercase font-bold text-primary hover:bg-transparent"
                          onClick={handleAiSubtasks}
                          disabled={isAiSubtaskLoading}
                        >
                          {isAiSubtaskLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate with AI'}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 bg-muted/20 p-4 rounded-xl border border-border/40">
                    {subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-3 p-3 border border-border/40 rounded-lg bg-card/60 group hover:border-primary/20 transition-all shadow-sm">
                        <Checkbox 
                          checked={st.completed} 
                          disabled={!canEdit}
                          onCheckedChange={() => toggleSubtask(st.id)}
                          className="h-4.5 w-4.5 rounded-[4px] border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <span className={`flex-1 text-sm font-medium transition-colors ${st.completed ? 'line-through text-muted-foreground/50' : 'text-foreground/90'}`}>
                          {st.title}
                        </span>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => removeSubtask(st.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {canEdit && (
                      <div className="flex gap-2 pt-2">
                        <Input 
                          placeholder="Add a milestone or subtask..." 
                          value={newSubtask} 
                          onChange={(e) => setNewSubtask(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                          className="h-10 border-border/40 bg-zinc-50 dark:bg-zinc-900 px-4 text-sm font-medium focus-visible:ring-primary/20"
                        />
                        <Button size="icon" onClick={addSubtask} variant="secondary" className="h-10 w-10 shrink-0 bg-secondary hover:bg-secondary/80 rounded-lg">
                          <Plus className="h-5 w-5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>

          <TabsContent value="comments" className="flex-1 flex flex-col p-6 mt-0 focus-visible:ring-0 min-h-0">
            <div className="flex flex-col h-full gap-6">
              <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-30 text-center py-20">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <MessageSquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-base font-bold text-foreground">No discussions yet</p>
                    <p className="text-sm text-muted-foreground mt-1 px-10">Start the conversation with your team members below.</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-4 group">
                      <Avatar className="h-9 w-9 shrink-0 border-2 border-background ring-1 ring-border shadow-sm">
                        <AvatarImage src={comment.authorPhoto} />
                        <AvatarFallback className="text-[10px] bg-secondary text-primary font-bold">{comment.authorName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground tracking-tight">{comment.authorName}</span>
                          <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest leading-none">
                            {format(comment.createdAt?.toDate ? comment.createdAt.toDate() : new Date(), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <div className="bg-secondary/40 p-3 rounded-2xl rounded-tl-none border border-border/40 shadow-sm">
                          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                            {comment.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {canEdit && (
                <div className="flex gap-3 pt-6 border-t border-border/40 relative">
                  <div className="flex-1 relative">
                    <Popover open={isMentionPopoverOpen} onOpenChange={setIsMentionPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Input 
                          placeholder="Share your thoughts or updates (type @ to mention)..." 
                          value={newComment} 
                          onChange={handleCommentChange}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} 
                          className="h-11 border-border/60 bg-muted/20 focus-visible:ring-primary/20 px-4 font-medium transition-all"
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-[240px] p-0 border-border/60 shadow-2xl rounded-xl" align="start" side="top">
                        <div className="p-2 border-b border-border/40 bg-muted/20">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2">Mention Collaborator</p>
                        </div>
                        <ScrollArea className="h-[200px]">
                          {projectMembers
                            .filter(m => (m.displayName || m.email)?.toLowerCase().includes(mentionSearch.toLowerCase()))
                            .map((member) => (
                              <button
                                key={member.uid}
                                className="w-full flex items-center gap-3 p-2.5 hover:bg-muted transition-colors text-left group"
                                onClick={() => insertMention(member)}
                              >
                                <Avatar className="h-7 w-7 border border-border/60">
                                  <AvatarImage src={member.photoURL || undefined} />
                                  <AvatarFallback className="text-[9px] bg-secondary text-primary font-bold">{member.displayName?.charAt(0) || '?'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold truncate text-foreground group-hover:text-primary transition-colors">{member.displayName || 'Unknown User'}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                                </div>
                              </button>
                            ))}
                          {projectMembers.length === 0 && (
                            <div className="p-4 text-center text-xs text-muted-foreground italic">No collaborators found to mention</div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button size="icon" onClick={handleAddComment} disabled={!newComment.trim()} className="h-11 w-11 shrink-0 shadow-lg shadow-primary/20 transition-all active:scale-95">
                    <Send className="h-4.5 w-4.5" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="attachments" className="flex-1 flex flex-col p-6 mt-0 focus-visible:ring-0 min-h-0">
            <div className="flex flex-col h-full gap-6">
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
                {attachments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-30 text-center py-20">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Paperclip className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-base font-bold text-foreground">No files attached</p>
                    <p className="text-sm text-muted-foreground mt-1">Upload relevant documents, images, or PDFs for this task.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {attachments.map((file) => (
                      <div key={file.id} className="relative group p-4 border border-border/40 rounded-xl bg-card hover:border-primary/20 transition-all shadow-sm flex items-start gap-4">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/5 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-foreground truncate">{file.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">{(file.size / 1024 / 1024).toFixed(2)} MB • {file.type.split('/')[1]}</p>
                        </div>
                        <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noreferrer noopener"
                            className="h-7 w-7 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center justify-center transition-colors shadow-sm"
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          {canEdit && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteAttachment(file)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="pt-6 border-t border-border/40">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isUploading}
                    variant="outline" 
                    className="w-full h-14 border-dashed border-2 hover:border-primary/40 hover:bg-primary/5 gap-3"
                  >
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Paperclip className="h-5 w-5 text-primary" />
                    )}
                    <div className="text-left">
                      <p className="text-sm font-bold">Click to upload attachment</p>
                      <p className="text-[11px] text-muted-foreground">PDFs, images, or documents up to 50MB</p>
                    </div>
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="flex-1 flex flex-col p-6 mt-0 focus-visible:ring-0 min-h-0">
             <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
                <ActivityFeed projectId={projectId} />
             </div>
          </TabsContent>
        </Tabs>
        <DialogFooter className="p-6 border-t border-border/40 flex justify-between items-center sm:justify-between">
          <div className="flex gap-1.5">
            {task && canEdit && (
              <>
                <Button variant="ghost" size="icon" onClick={handleArchive} title="Archive Task" className="h-10 w-10 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all rounded-lg">
                  <Archive className="h-5 w-5" />
                </Button>
                {userRole === 'admin' && (
                  <Button variant="ghost" size="icon" onClick={handleDelete} title="Delete Task" className="h-10 w-10 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all rounded-lg">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={onClose} className="h-11 px-6 text-sm font-bold text-muted-foreground hover:text-foreground">Cancel</Button>
            {canEdit && (
              <Button onClick={handleSave} className="h-11 px-10 text-sm font-bold shadow-xl shadow-primary/20 transition-all active:scale-95">
                {task ? 'Update Changes' : 'Create Task'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

