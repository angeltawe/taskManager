import { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { Notification } from '../types';
import { Button } from './ui/button';
import { Bell, Check, Trash2, Mail, Users, MessageSquare, Clock } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { ScrollArea } from './ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from './ui/badge';
import { toDate } from '../lib/utils';

export function NotificationCenter({ onViewActivity }: { onViewActivity?: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsub = notificationService.subscribeToNotifications(setNotifications);
    return () => unsub();
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
  };

  const handleDelete = async (id: string) => {
    await notificationService.deleteNotification(id);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'mention': return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'invite': return <Users className="h-4 w-4 text-emerald-500" />;
      case 'due_soon': return <Clock className="h-4 w-4 text-orange-500" />;
      default: return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild nativeButton={true}>
        <Button variant="ghost" size="icon" className="h-10 w-10 relative rounded-lg hover:bg-secondary/40 transition-all group">
          <Bell className={`h-5 w-5 transition-transform group-hover:scale-110 ${unreadCount > 0 ? 'text-primary fill-primary/10' : 'text-muted-foreground'}`} />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-red-500 text-white border-2 border-background animate-in zoom-in">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[380px] p-0 mr-0 sm:mr-4 border-border/60 shadow-2xl rounded-2xl overflow-hidden" align="end">
        <div className="p-4 border-b border-border/40 bg-muted/20 flex items-center justify-between shrink-0">
          <h4 className="font-bold text-sm tracking-tight">Notifications</h4>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{unreadCount} Unread</span>
          )}
        </div>
        <ScrollArea className="h-[max(300px,min(400px,60vh))]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-secondary/40 flex items-center justify-center">
                <Bell className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground/80">No notifications yet</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  We'll notify you when someone mentions you or invites you to a workspace.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`p-4 flex gap-4 transition-colors hover:bg-muted/30 relative group
                    ${!n.isRead ? 'bg-primary/[0.02]' : ''}`}
                  onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                >
                  <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0
                    ${!n.isRead ? 'bg-primary/10' : 'bg-secondary/60'}`}
                  >
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-8">
                    <p className={`text-[13px] leading-snug mb-1 ${!n.isRead ? 'font-bold text-foreground' : 'text-muted-foreground font-medium'}`}>
                      {n.message}
                    </p>
                    <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-tighter">
                      {formatDistanceToNow(toDate(n.createdAt) || new Date(), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="absolute right-3 top-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.isRead && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 rounded-full bg-background/80 hover:bg-emerald-50 text-emerald-600 shadow-sm border border-border"
                        onClick={(e) => { e.stopPropagation(); handleMarkAsRead(n.id); }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 rounded-full bg-background/80 hover:bg-red-50 text-red-600 shadow-sm border border-border"
                      onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {!n.isRead && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-3 bg-muted/5 border-t border-border/30">
            <Button 
              variant="ghost" 
              className="w-full text-[12px] font-bold text-muted-foreground hover:text-primary transition-colors"
              onClick={() => {
                onViewActivity?.();
                setIsOpen(false);
              }}
            >
              View all activity
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
