'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mail, Sparkles } from 'lucide-react'
import { SmtpSettingsSection } from '@/components/settings/smtp-settings-section'
import { AiSettingsSection } from '@/components/settings/ai-settings-section'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: 'email' | 'ai'
  onChanged?: () => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  defaultTab = 'ai',
  onChanged,
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'ai'>(defaultTab)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure the AI provider for parsing events and the SMTP server for sending reminder
            emails. The AI provider needs a free API key (Groq recommended) — see the AI Provider tab.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'email' | 'ai')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI Provider
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email (SMTP)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-4">
            <AiSettingsSection onChanged={onChanged} />
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <SmtpSettingsSection onChanged={onChanged} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
