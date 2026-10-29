// Executed inside the root-approved Dental ERP application container.
// The worker binds tenantId from its protected installation registry; this
// adapter cannot choose a clinic or execute arbitrary SQL.
const { PrismaClient } = require('@prisma/client')
const crypto = require('node:crypto')
const fs = require('node:fs')

const prisma = new PrismaClient()
const input = JSON.parse(fs.readFileSync(0, 'utf8'))
const tenantId = input.tenantId
const tenantToken = crypto.createHash('sha256').update(tenantId).digest('hex').slice(0, 10)
const prefix = `demo_seed_${tenantToken}_`
const id = (name) => `${prefix}${name}`
const days = (amount) => new Date(Date.now() + amount * 86400000)

async function reset(tx) {
  const scoped = { hospitalId: tenantId, id: { startsWith: prefix } }
  const counts = {}
  const remove = async (name, model, where = scoped) => {
    const result = await tx[model].deleteMany({ where })
    counts[name] = result.count
  }

  await remove('smsLogs', 'sMSLog')
  await remove('notifications', 'notification')
  await remove('recalls', 'patientRecall')
  await remove('payments', 'payment')
  await remove('invoices', 'invoice')
  await remove('labOrders', 'labOrder')
  await remove('labVendors', 'labVendor')
  await remove('prescriptions', 'prescription')
  await remove('treatments', 'treatment')
  await remove('appointments', 'appointment')
  await remove('dentalChartEntries', 'dentalChartEntry')
  await remove('sterilizationLogs', 'sterilizationLog')
  await remove('instruments', 'instrument')
  await remove('stockAlerts', 'stockAlert')
  await remove('stockTransactions', 'stockTransaction')
  await remove('inventoryItems', 'inventoryItem')
  await remove('inventoryCategories', 'inventoryCategory')
  await remove('suppliers', 'supplier')
  await remove('procedures', 'procedure')
  await remove('patients', 'patient')
  await remove('staff', 'staff')
  await remove('users', 'user')
  await remove('templates', 'communicationTemplate')
  return counts
}

async function seed(tx) {
  const clinic = await tx.hospital.findUnique({ where: { id: tenantId }, select: { id: true } })
  if (!clinic) throw new Error('Clinic binding not found')

  const demoUser = await tx.user.create({
    data: {
      id: id('user_doctor'),
      hospitalId: tenantId,
      email: `demo-doctor-${tenantToken}@seed.invalid`,
      password: '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7zWwYeA9oV1W9U4xJHoI6w7dQzDVLHe',
      name: 'Dr. Hana Demo',
      phone: '0900000000',
      role: 'DOCTOR',
      isActive: false,
      mustChangePassword: true,
    },
  })
  const doctor = await tx.staff.create({
    data: {
      id: id('staff_doctor'),
      hospitalId: tenantId,
      userId: demoUser.id,
      employeeId: `DEMO-${tenantToken}`,
      firstName: 'Hana',
      lastName: 'Demo',
      phone: '0900000000',
      email: demoUser.email,
      specialization: 'General Dentistry',
      qualification: 'DDS',
      licenseNumber: `DEMO-${tenantToken}`,
      isActive: true,
    },
  })

  const patientData = [
    ['patient_almaz', 'DEMO-001', 'Almaz', 'Tesfaye', '0911000001', 'FEMALE', 34],
    ['patient_dawit', 'DEMO-002', 'Dawit', 'Bekele', '0911000002', 'MALE', 42],
    ['patient_sara', 'DEMO-003', 'Sara', 'Kebede', '0911000003', 'FEMALE', 27],
  ]
  const patients = {}
  for (const [key, patientId, firstName, lastName, phone, gender, age] of patientData) {
    patients[key] = await tx.patient.create({
      data: {
        id: id(key),
        hospitalId: tenantId,
        patientId: `${patientId}-${tenantToken}`,
        firstName,
        lastName,
        phone,
        gender,
        age,
        city: 'Addis Ababa',
        state: 'Addis Ababa',
        occupation: 'Demo patient',
        address: 'Synthetic demonstration record',
      },
    })
  }

  await tx.medicalHistory.create({
    data: {
      id: id('history_almaz'),
      patientId: patients.patient_almaz.id,
      hasHypertension: true,
      currentMedications: 'Amlodipine 5 mg',
      additionalNotes: 'Synthetic medical history for demonstration.',
    },
  })

  const cleaning = await tx.procedure.create({
    data: {
      id: id('procedure_cleaning'),
      hospitalId: tenantId,
      code: `DEMO-CLEAN-${tenantToken}`,
      name: 'Demo Scaling and Polishing',
      category: 'PREVENTIVE',
      defaultDuration: 45,
      basePrice: 1800,
    },
  })
  const rootCanal = await tx.procedure.create({
    data: {
      id: id('procedure_rct'),
      hospitalId: tenantId,
      code: `DEMO-RCT-${tenantToken}`,
      name: 'Demo Root Canal Treatment',
      category: 'ENDODONTIC',
      defaultDuration: 90,
      basePrice: 7500,
    },
  })
  const crown = await tx.procedure.create({
    data: {
      id: id('procedure_crown'),
      hospitalId: tenantId,
      code: `DEMO-CROWN-${tenantToken}`,
      name: 'Demo Zirconia Crown',
      category: 'PROSTHODONTIC',
      defaultDuration: 60,
      basePrice: 12000,
    },
  })

  const appointmentOne = await tx.appointment.create({
    data: {
      id: id('appointment_upcoming'),
      hospitalId: tenantId,
      appointmentNo: `DEMO-APT-001-${tenantToken}`,
      patientId: patients.patient_almaz.id,
      doctorId: doctor.id,
      scheduledDate: days(1),
      scheduledTime: '09:30',
      duration: 45,
      appointmentType: 'CHECK_UP',
      status: 'CONFIRMED',
      chiefComplaint: 'Sensitivity to cold drinks',
    },
  })
  await tx.appointment.create({
    data: {
      id: id('appointment_completed'),
      hospitalId: tenantId,
      appointmentNo: `DEMO-APT-002-${tenantToken}`,
      patientId: patients.patient_dawit.id,
      doctorId: doctor.id,
      scheduledDate: days(-5),
      scheduledTime: '11:00',
      duration: 60,
      appointmentType: 'PROCEDURE',
      status: 'COMPLETED',
      chiefComplaint: 'Pain in lower molar',
      checkedInAt: days(-5),
      checkedOutAt: days(-5),
    },
  })
  await tx.appointment.create({
    data: {
      id: id('appointment_noshow'),
      hospitalId: tenantId,
      appointmentNo: `DEMO-APT-003-${tenantToken}`,
      patientId: patients.patient_sara.id,
      doctorId: doctor.id,
      scheduledDate: days(-10),
      scheduledTime: '14:00',
      appointmentType: 'CONSULTATION',
      status: 'NO_SHOW',
    },
  })

  const treatment = await tx.treatment.create({
    data: {
      id: id('treatment_rct'),
      hospitalId: tenantId,
      treatmentNo: `DEMO-TRT-001-${tenantToken}`,
      patientId: patients.patient_dawit.id,
      procedureId: rootCanal.id,
      doctorId: doctor.id,
      toothNumbers: '36',
      diagnosis: 'Symptomatic irreversible pulpitis',
      findings: 'Deep carious lesion',
      procedureNotes: 'Access opening and canal preparation completed.',
      status: 'IN_PROGRESS',
      startTime: days(-5),
      followUpRequired: true,
      followUpDate: days(7),
      cost: 7500,
    },
  })
  await tx.dentalChartEntry.create({
    data: {
      id: id('chart_dawit'),
      hospitalId: tenantId,
      patientId: patients.patient_dawit.id,
      toothNumber: 36,
      toothNotation: '36',
      occlusal: true,
      condition: 'CARIES',
      severity: 'MODERATE',
      notes: 'Demo carious lesion.',
    },
  })

  await tx.prescription.create({
    data: {
      id: id('prescription_dawit'),
      hospitalId: tenantId,
      prescriptionNo: `DEMO-RX-001-${tenantToken}`,
      patientId: patients.patient_dawit.id,
      doctorId: doctor.id,
      diagnosis: 'Post endodontic pain',
      validUntil: days(14),
      medications: {
        create: [
          {
            id: id('prescription_med_amox'),
            medicationName: 'Amoxicillin',
            dosage: '500 mg',
            frequency: 'Three times daily',
            duration: '5 days',
            quantity: 15,
            instructions: 'Take after food.',
          },
          {
            id: id('prescription_med_ibu'),
            medicationName: 'Ibuprofen',
            dosage: '400 mg',
            frequency: 'As needed',
            duration: '3 days',
            quantity: 9,
            instructions: 'Take after food.',
          },
        ],
      },
    },
  })

  const partialInvoice = await tx.invoice.create({
    data: {
      id: id('invoice_partial'),
      hospitalId: tenantId,
      invoiceNo: `DEMO-INV-001-${tenantToken}`,
      patientId: patients.patient_dawit.id,
      subtotal: 7500,
      discountAmount: 0,
      taxableAmount: 7500,
      cgstRate: 0,
      sgstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalAmount: 7500,
      paidAmount: 2500,
      balanceAmount: 5000,
      status: 'PARTIALLY_PAID',
      dueDate: days(7),
      notes: 'Demo six-month balance reminder case.',
      items: {
        create: [
          {
            id: id('invoice_item_rct'),
            treatmentId: treatment.id,
            description: 'Root canal treatment – first visit',
            quantity: 1,
            unitPrice: 7500,
            amount: 7500,
            taxable: false,
          },
        ],
      },
    },
  })
  await tx.payment.create({
    data: {
      id: id('payment_partial'),
      hospitalId: tenantId,
      paymentNo: `DEMO-PAY-001-${tenantToken}`,
      invoiceId: partialInvoice.id,
      amount: 2500,
      paymentMethod: 'CASH',
      paymentDate: days(-5),
      status: 'COMPLETED',
      recordedById: demoUser.id,
      notes: 'Synthetic partial payment.',
    },
  })
  await tx.invoice.create({
    data: {
      id: id('invoice_overdue'),
      hospitalId: tenantId,
      invoiceNo: `DEMO-INV-002-${tenantToken}`,
      patientId: patients.patient_almaz.id,
      subtotal: 1800,
      discountAmount: 0,
      taxableAmount: 1800,
      cgstRate: 0,
      sgstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalAmount: 1800,
      paidAmount: 0,
      balanceAmount: 1800,
      status: 'OVERDUE',
      dueDate: days(-12),
      items: {
        create: [
          {
            id: id('invoice_item_clean'),
            description: 'Scaling and polishing',
            quantity: 1,
            unitPrice: 1800,
            amount: 1800,
            taxable: false,
          },
        ],
      },
    },
  })
  const paidInvoice = await tx.invoice.create({
    data: {
      id: id('invoice_paid'),
      hospitalId: tenantId,
      invoiceNo: `DEMO-INV-003-${tenantToken}`,
      patientId: patients.patient_sara.id,
      subtotal: 1200,
      discountAmount: 0,
      taxableAmount: 1200,
      cgstRate: 0,
      sgstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalAmount: 1200,
      paidAmount: 1200,
      balanceAmount: 0,
      status: 'PAID',
      dueDate: days(-2),
      items: {
        create: [
          {
            id: id('invoice_item_consult'),
            description: 'Dental consultation',
            quantity: 1,
            unitPrice: 1200,
            amount: 1200,
            taxable: false,
          },
        ],
      },
    },
  })
  await tx.payment.create({
    data: {
      id: id('payment_paid'),
      hospitalId: tenantId,
      paymentNo: `DEMO-PAY-002-${tenantToken}`,
      invoiceId: paidInvoice.id,
      amount: 1200,
      paymentMethod: 'TELEBIRR',
      paymentDate: days(-2),
      status: 'COMPLETED',
      recordedById: demoUser.id,
      transactionId: 'DEMO-TELEBIRR-001',
    },
  })

  const vendor = await tx.labVendor.create({
    data: {
      id: id('lab_vendor'),
      hospitalId: tenantId,
      code: `DEMO-LAB-${tenantToken}`,
      name: 'Demo Addis Dental Laboratory',
      contactPerson: 'Meron Demo',
      phone: '0900000010',
      city: 'Addis Ababa',
      specializations: 'Crowns, bridges and dentures',
      avgTurnaround: 7,
      rating: 5,
    },
  })
  const labOrders = [
    ['lab_overdue', '001', patients.patient_dawit.id, 'CROWN', 'SENT_TO_LAB', -2, 'URGENT'],
    ['lab_due_soon', '002', patients.patient_almaz.id, 'BRIDGE', 'IN_PROGRESS', 2, 'NORMAL'],
    ['lab_ready', '003', patients.patient_sara.id, 'RETAINER', 'READY', 5, 'NORMAL'],
  ]
  for (const [key, number, patientId, workType, status, expectedDays, priority] of labOrders) {
    await tx.labOrder.create({
      data: {
        id: id(key),
        hospitalId: tenantId,
        orderNumber: `DEMO-LAB-${number}-${tenantToken}`,
        patientId,
        labVendorId: vendor.id,
        workType,
        description: 'Synthetic laboratory work order',
        toothNumbers: number === '001' ? '36' : '11,12',
        shadeGuide: 'A2',
        orderDate: days(-7),
        expectedDate: days(expectedDays),
        sentDate: days(-6),
        estimatedCost: number === '001' ? 4500 : 3000,
        status,
        priority,
        qualityCheck: 'PENDING',
        createdBy: demoUser.id,
      },
    })
  }

  const supplier = await tx.supplier.create({
    data: {
      id: id('supplier'),
      hospitalId: tenantId,
      code: `DEMO-SUP-${tenantToken}`,
      name: 'Demo Medical Supply',
      contactPerson: 'Abel Demo',
      phone: '0900000020',
      city: 'Addis Ababa',
      paymentTerms: '30 days',
      rating: 4,
    },
  })
  const category = await tx.inventoryCategory.create({
    data: {
      id: id('inventory_category'),
      hospitalId: tenantId,
      name: `[Demo ${tenantToken}] Dental Materials`,
      description: 'Synthetic category for owner-managed demo data.',
    },
  })
  const gloves = await tx.inventoryItem.create({
    data: {
      id: id('inventory_gloves'),
      hospitalId: tenantId,
      sku: `DEMO-GLOVE-${tenantToken}`,
      name: 'Demo Examination Gloves',
      categoryId: category.id,
      preferredSupplierId: supplier.id,
      itemType: 'CONSUMABLE',
      unit: 'box',
      currentStock: 8,
      minimumStock: 10,
      reorderLevel: 20,
      purchasePrice: 650,
      sellingPrice: 800,
      storageLocation: 'Store A',
    },
  })
  await tx.inventoryItem.create({
    data: {
      id: id('inventory_composite'),
      hospitalId: tenantId,
      sku: `DEMO-COMP-${tenantToken}`,
      name: 'Demo Composite Resin A2',
      categoryId: category.id,
      preferredSupplierId: supplier.id,
      itemType: 'DENTAL_MATERIAL',
      unit: 'syringe',
      currentStock: 24,
      minimumStock: 5,
      reorderLevel: 10,
      purchasePrice: 1400,
      sellingPrice: 1800,
      storageLocation: 'Clinical Store',
    },
  })
  await tx.stockTransaction.create({
    data: {
      id: id('stock_transaction'),
      hospitalId: tenantId,
      itemId: gloves.id,
      type: 'CONSUMPTION',
      quantity: 2,
      previousStock: 10,
      newStock: 8,
      unitPrice: 650,
      totalPrice: 1300,
      notes: 'Synthetic consumption record.',
      performedBy: demoUser.id,
    },
  })
  await tx.stockAlert.create({
    data: {
      id: id('stock_alert'),
      hospitalId: tenantId,
      itemId: gloves.id,
      alertType: 'LOW_STOCK',
      notes: 'Demo low-stock alert.',
    },
  })

  const instrument = await tx.instrument.create({
    data: {
      id: id('instrument'),
      hospitalId: tenantId,
      name: 'Demo Extraction Forceps',
      category: 'Surgical',
      serialNumber: `DEMO-INS-${tenantToken}`,
      status: 'AVAILABLE',
      location: 'Sterilization Room',
      lastSterilizedAt: days(-1),
      sterilizationCycleCount: 14,
    },
  })
  await tx.sterilizationLog.create({
    data: {
      id: id('sterilization_log'),
      hospitalId: tenantId,
      instrumentId: instrument.id,
      cycleNumber: 14,
      method: 'AUTOCLAVE',
      machineId: 'AUTOCLAVE-01',
      temperature: 134,
      pressure: 2.1,
      duration: 30,
      operatorId: demoUser.id,
      result: 'PASS',
      biologicalIndicator: true,
      chemicalIndicator: true,
      startedAt: days(-1),
      completedAt: days(-1),
      notes: 'Synthetic sterilization cycle.',
    },
  })

  await tx.patientRecall.create({
    data: {
      id: id('recall'),
      hospitalId: tenantId,
      patientId: patients.patient_dawit.id,
      treatmentId: treatment.id,
      createdById: demoUser.id,
      lastTreatmentDate: days(-5),
      followUpDate: days(7),
      reminderDate: days(0),
      reminderLeadDays: 7,
      status: 'SCHEDULED',
      smsStatus: 'PENDING',
      notes: 'Demo follow-up recall.',
    },
  })
  const template = await tx.communicationTemplate.create({
    data: {
      id: id('template_payment'),
      hospitalId: tenantId,
      name: 'Demo outstanding balance reminder',
      category: 'PAYMENT',
      channel: 'SMS',
      content:
        'Hello {{patientName}}, your outstanding balance is ETB {{amount}}. Payment deadline: {{dueDate}}.',
      variables: JSON.stringify(['patientName', 'amount', 'dueDate']),
      isActive: true,
      isDefault: false,
    },
  })
  await tx.sMSLog.create({
    data: {
      id: id('sms_log'),
      hospitalId: tenantId,
      patientId: patients.patient_dawit.id,
      phone: patients.patient_dawit.phone,
      templateId: template.id,
      message: 'Demo only: payment reminder delivery record.',
      gateway: 'DEMO',
      status: 'FAILED',
      failedAt: days(-1),
      errorMessage: 'Synthetic demo delivery failure',
      metadata: JSON.stringify({
        kind: 'six_month_balance_reminder',
        invoiceId: partialInvoice.id,
        demo: true,
      }),
    },
  })
  await tx.notification.create({
    data: {
      id: id('notification'),
      hospitalId: tenantId,
      userId: demoUser.id,
      title: 'Demo lab order overdue',
      message: 'A synthetic lab order is overdue for follow-up.',
      type: 'WARNING',
      entityType: 'LabOrder:Overdue',
      entityId: id('lab_overdue'),
    },
  })

  return {
    patients: 3,
    appointments: 3,
    treatments: 1,
    prescriptions: 1,
    invoices: 3,
    payments: 2,
    labOrders: 3,
    inventoryItems: 2,
    recalls: 1,
    sterilizationLogs: 1,
  }
}

;(async () => {
  if (!['DEMO_SEED', 'DEMO_RESET'].includes(input.action))
    throw new Error('Demo data operation failed')
  const result = await prisma.$transaction(
    async (tx) => {
      const removed = await reset(tx)
      if (input.action === 'DEMO_RESET')
        return {
          removed: true,
          counts: removed,
          message: 'Demo data removed; clinic records preserved',
        }
      const counts = await seed(tx)
      return { seeded: true, counts, message: 'Demo data seeded across clinic modules' }
    },
    { timeout: 120000 }
  )
  console.log(JSON.stringify(result))
})()
  .catch((error) => {
    const safe =
      error && error.message === 'Clinic binding not found'
        ? error.message
        : input.action === 'DEMO_RESET'
          ? 'Demo data reset failed'
          : 'Demo data seed failed'
    console.error(safe)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
