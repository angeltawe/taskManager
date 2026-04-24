import { useState, useEffect } from 'react';
import { ActivityLog } from '../types';
import { activityService } from '../services/activityService';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { format } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';
import { toDate } from '../lib/utils';
import { 
  PlusCircle, 
  CheckCircle2, 
  MessageSquare, 
  UserPlus, 
  Archive, 
  Edit3,
  Activity
} from 'lucide-react';

interface ActivityFeedProps {
  projectId: string;
}

export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!projectId) return;
    const unsub = activityService.subscribeToProjectActivity(projectId, setLogs);
    return () => unsub();
  }, [projectId]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create_task': return <PlusCircle className="h-4 w-4 text-emerald-500" />;
      case 'complete_task': return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case 'add_comment': return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case 'invite_collaborator': return <UserPlus className="h-4 w-4 text-orange-500" />;
      case 'archive_project': return <Archive className="h-4 w-4 text-red-500" />;
      case 'update_task': return <Edit3 className="h-4 w-4 text-amber-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center opacity-40">
        <Activity className="h-10 w-10 mb-3" />
        <p className="text-sm font-medium">No recent activity found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full max-h-[calc(100vh-250px)] sm:max-h-[600px] pr-4">
      <div className="space-y-6">
        {logs.map((log) => (
        <div key={log.id} className="flex gap-4 relative group">
          <Avatar className="h-8 w-8 shrink-0 border-2 border-background ring-1 ring-border shadow-sm">
            <AvatarImage src={log.userPhoto || undefined} />
            <AvatarFallback className="text-[10px] bg-secondary text-primary font-bold">
              {log.userName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{log.userName}</span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50">
                {format(toDate(log.createdAt) || new Date(), 'h:mm a')}
              </span>
            </div>
            
            <div className="flex items-center gap-2 bg-secondary/30 p-2.5 rounded-lg border border-border/40 hover:bg-secondary/50 transition-colors">
              <div className="h-6 w-6 rounded bg-background border border-border/60 flex items-center justify-center shrink-0">
                {getActionIcon(log.action)}
              </div>
              <p className="text-[13px] text-foreground/80 font-medium">
                {log.details}
              </p>
            </div>
          </div>
        </div>
      ))}
      </div>
    </ScrollArea>
  );
}
