'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { MessageSquare, Mail, FileText, MessageCircle, Send } from 'lucide-react'

export default function CommunicationsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // SMS State
  const [smsPhone, setSmsPhone] = useState('')
  const [smsMessage, setSmsMessage] = useState('')

  // Email State
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [smsHistory, setSmsHistory] = useState<any[]>([])
  const [emailHistory, setEmailHistory] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [surveys, setSurveys] = useState<any[]>([])

  const loadCommunicationData = async () => {
    const endpoints = ['sms', 'email', 'templates', 'surveys']
    const results = await Promise.allSettled(
      endpoints.map((endpoint) =>
        fetch(`/api/communications/${endpoint}?limit=20`).then((response) => {
          if (!response.ok) throw new Error(`Failed to load ${endpoint}`)
          return response.json()
        })
      )
    )
    if (results[0].status === 'fulfilled') setSmsHistory(results[0].value.data || [])
    if (results[1].status === 'fulfilled') setEmailHistory(results[1].value.data || [])
    if (results[2].status === 'fulfilled') setTemplates(results[2].value.data || [])
    if (results[3].status === 'fulfilled') setSurveys(results[3].value.data || [])
  }

  useEffect(() => {
    void loadCommunicationData()
  }, [])

  const handleSendSMS = async () => {
    if (!smsPhone || !smsMessage) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/communications/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: smsPhone,
          message: smsMessage,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'SMS sent successfully',
        })
        setSmsPhone('')
        setSmsMessage('')
        void loadCommunicationData()
      } else {
        throw new Error(data.error || 'Failed to send SMS')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!emailTo || !emailSubject || !emailBody) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/communications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Email sent successfully',
        })
        setEmailTo('')
        setEmailSubject('')
        setEmailBody('')
        void loadCommunicationData()
      } else {
        throw new Error(data.error || 'Failed to send email')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-0 py-2 sm:p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Communication Center</h1>
        <p className="text-muted-foreground">Manage SMS, Email, Templates, and Patient Feedback</p>
      </div>

      <Tabs defaultValue="sms" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="sms" className="min-w-0 whitespace-normal py-2">
            <MessageSquare className="w-4 h-4 mr-2" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="email" className="min-w-0 whitespace-normal py-2">
            <Mail className="w-4 h-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="templates" className="min-w-0 whitespace-normal py-2">
            <FileText className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="surveys" className="min-w-0 whitespace-normal py-2">
            <MessageCircle className="w-4 h-4 mr-2" />
            Surveys
          </TabsTrigger>
        </TabsList>

        {/* SMS Tab */}
        <TabsContent value="sms">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Send SMS</CardTitle>
                <CardDescription>Send individual or bulk SMS messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="sms-phone">Phone Number</Label>
                  <Input
                    id="sms-phone"
                    placeholder="10-digit mobile number"
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="sms-message">Message</Label>
                  <Textarea
                    id="sms-message"
                    placeholder="Type your message here (max 500 characters)"
                    rows={5}
                    maxLength={500}
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {smsMessage.length}/500 characters
                  </p>
                </div>

                <Button onClick={handleSendSMS} disabled={loading} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Send SMS
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SMS History</CardTitle>
                <CardDescription>Recent SMS communications</CardDescription>
              </CardHeader>
              <CardContent>
                {smsHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No SMS messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {smsHistory.map((item) => (
                      <div key={item.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex justify-between gap-3 font-medium">
                          <span>{item.phone}</span>
                          <span>{item.status}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-muted-foreground">{item.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Email</CardTitle>
                <CardDescription>Compose and send emails to patients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="email-to">To (Email Address)</Label>
                  <Input
                    id="email-to"
                    type="email"
                    placeholder="patient@example.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="email-subject">Subject</Label>
                  <Input
                    id="email-subject"
                    placeholder="Email subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="email-body">Message</Label>
                  <Textarea
                    id="email-body"
                    placeholder="Type your email message here"
                    rows={8}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                </div>

                <Button onClick={handleSendEmail} disabled={loading} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email History</CardTitle>
                <CardDescription>Recent email communications</CardDescription>
              </CardHeader>
              <CardContent>
                {emailHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No email messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {emailHistory.map((item) => (
                      <div key={item.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex justify-between gap-3 font-medium">
                          <span className="truncate">{item.email}</span>
                          <span>{item.status}</span>
                        </div>
                        <p className="mt-1 truncate text-muted-foreground">{item.subject}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Communication Templates</CardTitle>
              <CardDescription>
                Manage SMS and Email templates for automated communications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">Available Templates</h3>
                    <p className="text-sm text-muted-foreground">
                      Create and manage reusable message templates
                    </p>
                  </div>
                </div>

                {templates.length === 0 ? (
                  <div className="border rounded-lg p-4 text-sm text-muted-foreground">
                    No templates yet.
                  </div>
                ) : (
                  templates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium">{template.name}</span>
                        <span className="text-sm text-muted-foreground">{template.channel}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {template.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Surveys Tab */}
        <TabsContent value="surveys">
          <Card>
            <CardHeader>
              <CardTitle>Patient Surveys & Feedback</CardTitle>
              <CardDescription>Create and manage patient satisfaction surveys</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">Active Surveys</h3>
                    <p className="text-sm text-muted-foreground">Collect feedback from patients</p>
                  </div>
                </div>

                {surveys.length === 0 ? (
                  <div className="border rounded-lg p-4 text-sm text-muted-foreground">
                    No surveys yet.
                  </div>
                ) : (
                  surveys.map((survey) => (
                    <div key={survey.id} className="border rounded-lg p-4">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium">{survey.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {survey._count?.responses || 0} responses
                        </span>
                      </div>
                      {survey.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{survey.description}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
