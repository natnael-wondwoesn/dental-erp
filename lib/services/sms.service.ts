// SMS service for Ethiopian clinics, with legacy Indian gateway compatibility.
// Twilio supports Ethiopian E.164 numbers; MSG91 behavior depends on the account.

import prisma from '@/lib/prisma'

export interface SMSConfig {
  gateway: 'MSG91' | 'TEXTLOCAL' | 'FAST2SMS' | 'TWILIO'
  apiKey: string
  senderId: string
  route?: string
  authKey?: string
  timezone?: string
}

export interface SMSPayload {
  hospitalId?: string
  phone: string
  message: string
  patientId?: string
  templateId?: string
  scheduledFor?: Date
  timezone?: string
}

class SMSService {
  private config: SMSConfig | null = null

  async initialize(hospitalId?: string) {
    // Load SMS configuration from settings
    const settings = await prisma.setting.findMany({
      where: {
        category: 'sms',
        ...(hospitalId ? { hospitalId } : {}),
      },
    })

    if (settings.length === 0) {
      throw new Error('SMS gateway not configured')
    }

    this.config = {
      gateway: (settings.find((s) => s.key === 'sms.gateway')?.value || 'MSG91') as any,
      apiKey: settings.find((s) => s.key === 'sms.apiKey')?.value || '',
      senderId: settings.find((s) => s.key === 'sms.senderId')?.value || '',
      route: settings.find((s) => s.key === 'sms.route')?.value,
      authKey: settings.find((s) => s.key === 'sms.authKey')?.value,
      timezone: settings.find((s) => s.key === 'sms.timezone')?.value || 'Africa/Addis_Ababa',
    }

    if (!this.config.apiKey) {
      throw new Error('SMS API key not configured')
    }
  }

  async sendSMS(payload: SMSPayload): Promise<string> {
    if (!this.isValidPhoneNumber(payload.phone)) {
      throw new Error('Invalid phone number format')
    }

    // Check DND registry if patient is provided
    if (payload.patientId) {
      const preference = await prisma.patientCommunicationPreference.findUnique({
        where: { patientId: payload.patientId },
      })

      if (preference?.dndRegistered) {
        throw new Error('Patient is on DND registry')
      }

      if (preference && !preference.smsEnabled) {
        throw new Error('Patient has disabled SMS communication')
      }
    }

    const timezone = payload.timezone || 'Africa/Addis_Ababa'
    if (!this.isWithinAllowedTime(timezone)) {
      throw new Error(`SMS cannot be sent outside 9 AM - 9 PM in ${timezone}`)
    }

    // Create SMS log entry
    const smsLog = await prisma.sMSLog.create({
      data: {
        hospitalId: payload.hospitalId || '',
        patientId: payload.patientId || null,
        phone: payload.phone,
        message: payload.message,
        templateId: payload.templateId || null,
        scheduledFor: payload.scheduledFor,
        status: payload.scheduledFor ? 'PENDING' : 'QUEUED',
        gateway: this.config?.gateway,
      },
    })

    // If scheduled for later, return
    if (payload.scheduledFor && payload.scheduledFor > new Date()) {
      return smsLog.id
    }

    // Send SMS immediately
    try {
      await this.initialize(payload.hospitalId)
      const result = await this.sendViaGateway(payload)

      // Update SMS log
      await prisma.sMSLog.update({
        where: { id: smsLog.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.messageId,
          cost: result.cost,
        },
      })

      return smsLog.id
    } catch (error: any) {
      // Update SMS log with error
      await prisma.sMSLog.update({
        where: { id: smsLog.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: error.message,
        },
      })

      throw error
    }
  }

  async sendBulkSMS(payloads: SMSPayload[]): Promise<string[]> {
    const results = await Promise.allSettled(payloads.map((payload) => this.sendSMS(payload)))

    return results.map((result, index) => (result.status === 'fulfilled' ? result.value : ''))
  }

  private async sendViaGateway(payload: SMSPayload): Promise<{ messageId: string; cost?: number }> {
    if (!this.config) {
      await this.initialize(payload.hospitalId)
    }

    switch (this.config?.gateway) {
      case 'MSG91':
        return this.sendViaMSG91(payload)
      case 'TEXTLOCAL':
        return this.sendViaTextLocal(payload)
      case 'FAST2SMS':
        return this.sendViaFast2SMS(payload)
      case 'TWILIO':
        return this.sendViaTwilio(payload)
      default:
        throw new Error('Unsupported SMS gateway')
    }
  }

  private async sendViaMSG91(payload: SMSPayload): Promise<{ messageId: string; cost?: number }> {
    const url = 'https://api.msg91.com/api/v5/flow/'
    const normalized = this.normalizePhoneNumber(payload.phone)
    const country = normalized.startsWith('+251') ? '251' : '91'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: this.config?.apiKey || '',
      },
      body: JSON.stringify({
        sender: this.config?.senderId,
        route: this.config?.route || '4',
        country,
        sms: [
          {
            message: payload.message,
            to: [normalized.slice(country.length + 1)],
          },
        ],
      }),
    })

    const data = await response.json()

    if (data.type === 'error') {
      throw new Error(data.message || 'Failed to send SMS via MSG91')
    }

    return {
      messageId: data.requestId || data.message_id || '',
      cost: data.cost,
    }
  }

  private async sendViaTextLocal(
    payload: SMSPayload
  ): Promise<{ messageId: string; cost?: number }> {
    const url = 'https://api.textlocal.in/send/'
    const normalized = this.normalizePhoneNumber(payload.phone)
    if (!normalized.startsWith('+91')) {
      throw new Error('TextLocal is only configured for Indian numbers; use Twilio for Ethiopia')
    }

    const params = new URLSearchParams({
      apikey: this.config?.apiKey || '',
      numbers: normalized.slice(3),
      sender: this.config?.senderId || '',
      message: payload.message,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    const data = await response.json()

    if (data.status !== 'success') {
      throw new Error(data.errors?.[0]?.message || 'Failed to send SMS via TextLocal')
    }

    return {
      messageId: data.messages?.[0]?.id || '',
      cost: data.cost,
    }
  }

  private async sendViaFast2SMS(
    payload: SMSPayload
  ): Promise<{ messageId: string; cost?: number }> {
    const url = 'https://www.fast2sms.com/dev/bulkV2'
    const normalized = this.normalizePhoneNumber(payload.phone)
    if (!normalized.startsWith('+91')) {
      throw new Error('Fast2SMS is only configured for Indian numbers; use Twilio for Ethiopia')
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: this.config?.apiKey || '',
      },
      body: JSON.stringify({
        sender_id: this.config?.senderId,
        message: payload.message,
        route: this.config?.route || 'v3',
        numbers: normalized.slice(3),
      }),
    })

    const data = await response.json()

    if (!data.return || data.status_code !== 200) {
      throw new Error(data.message || 'Failed to send SMS via Fast2SMS')
    }

    return {
      messageId: data.request_id || '',
    }
  }

  private async sendViaTwilio(payload: SMSPayload): Promise<{ messageId: string; cost?: number }> {
    // Twilio implementation
    const accountSid = this.config?.authKey
    const authToken = this.config?.apiKey
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const params = new URLSearchParams({
      To: this.normalizePhoneNumber(payload.phone),
      From: this.config?.senderId || '',
      Body: payload.message,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: params,
    })

    const data = await response.json()

    if (data.error_code) {
      throw new Error(data.error_message || 'Failed to send SMS via Twilio')
    }

    return {
      messageId: data.sid || '',
    }
  }

  private isValidPhoneNumber(phone: string): boolean {
    return this.normalizePhoneNumber(phone) !== ''
  }

  private normalizePhoneNumber(phone: string): string {
    const trimmed = phone.trim()
    const digits = trimmed.replace(/\D/g, '')

    // Ethiopian mobile formats: 09XXXXXXXX, 9XXXXXXXX, +2519XXXXXXXX.
    if (/^09\d{8}$/.test(digits)) return `+251${digits.slice(1)}`
    if (/^9\d{8}$/.test(digits)) return `+251${digits}`
    if (/^2519\d{8}$/.test(digits)) return `+${digits}`

    // Preserve existing Indian installations while Ethiopia is the product default.
    if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`

    // Explicit international E.164 input for other configured providers.
    if (trimmed.startsWith('+') && /^\d{10,15}$/.test(digits)) return `+${digits}`
    return ''
  }

  private isWithinAllowedTime(timezone: string): boolean {
    const hourPart = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'hour')
    const hours = Number(hourPart?.value)

    return hours >= 9 && hours < 21
  }

  async processTemplate(templateId: string, variables: Record<string, string>): Promise<string> {
    const template = await prisma.communicationTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template || !template.isActive) {
      throw new Error('Template not found or inactive')
    }

    let content = template.content

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }

    return content
  }

  async getDeliveryStatus(smsLogId: string): Promise<string> {
    const smsLog = await prisma.sMSLog.findUnique({
      where: { id: smsLogId },
    })

    if (!smsLog) {
      throw new Error('SMS log not found')
    }

    // In a real implementation, you would query the gateway API for delivery status
    return smsLog.status
  }

  async getSMSHistory(filters: {
    patientId?: string
    phone?: string
    status?: string
    from?: Date
    to?: Date
    limit?: number
  }) {
    const where: any = {}

    if (filters.patientId) where.patientId = filters.patientId
    if (filters.phone) where.phone = { contains: filters.phone }
    if (filters.status) where.status = filters.status
    if (filters.from || filters.to) {
      where.createdAt = {}
      if (filters.from) where.createdAt.gte = filters.from
      if (filters.to) where.createdAt.lte = filters.to
    }

    return prisma.sMSLog.findMany({
      where,
      include: {
        template: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: filters.limit || 100,
    })
  }

  async checkBalance(): Promise<{ balance: number; currency: string }> {
    // This would query the SMS gateway for current balance
    // Implementation depends on gateway
    return {
      balance: 0,
      currency: 'ETB',
    }
  }
}

export const smsService = new SMSService()
