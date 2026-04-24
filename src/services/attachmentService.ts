import { Attachment } from '../types';
import { localService } from './localService';
import { api } from './api';

export const attachmentService = {
  async uploadAttachment(taskId: string, file: File): Promise<Attachment> {
    if (localService.isDemoMode()) {
      const url = URL.createObjectURL(file);
      const attachment: Attachment = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        url,
        type: file.type,
        size: file.size,
        createdAt: new Date()
      };
      
      const tasks = localService.getData<any>('kanban_tasks');
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx >= 0) {
        tasks[idx].attachments = [...(tasks[idx].attachments || []), attachment];
        localService.setData('kanban_tasks', tasks);
      }
      return attachment;
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  async deleteAttachment(taskId: string, attachment: Attachment) {
    if (localService.isDemoMode()) {
      const tasks = localService.getData<any>('kanban_tasks');
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx >= 0) {
        tasks[idx].attachments = (tasks[idx].attachments || []).filter((a: any) => a.id !== attachment.id);
        localService.setData('kanban_tasks', tasks);
      }
      return;
    }

    // We can add a delete attachment endpoint if needed
    // For now we'll just update the task by removing the attachment from the array
    await api.patch(`/tasks/${taskId}`, {
      $pull: { attachments: { id: attachment.id } }
    });
  }
};
