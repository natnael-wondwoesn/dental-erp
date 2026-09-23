import { prisma } from '@/lib/prisma'
import type { PrescriptionPaperData } from './prescription-paper'

export async function loadPrescriptionPaper(id: string, hospitalId: string) {
  const prescription = await prisma.prescription.findFirst({
    where: { id, hospitalId },
    include: {
      patient: true,
      doctor: true,
      medications: true,
    },
  })
  if (!prescription) return null
  const clinic = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: {
      name: true,
      logo: true,
      address: true,
      city: true,
      phone: true,
      alternatePhone: true,
      email: true,
      registrationNo: true,
    },
  })
  const age =
    prescription.patient.age ??
    (prescription.patient.dateOfBirth
      ? Math.floor((Date.now() - prescription.patient.dateOfBirth.getTime()) / 31557600000)
      : undefined)
  const data: PrescriptionPaperData = {
    prescriptionNo: prescription.prescriptionNo,
    createdAt: prescription.createdAt.toISOString(),
    patient: {
      fullName: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
      patientId: prescription.patient.patientId,
      sex: prescription.patient.gender || '',
      age: age ? String(age) : '',
      phone: prescription.patient.phone,
      email: prescription.patient.email || '',
      region: prescription.patient.state || '',
      town: prescription.patient.city || '',
      houseNo: prescription.patient.address || '',
    },
    diagnosis: prescription.diagnosis || '',
    notes: prescription.notes || '',
    medications: prescription.medications.map((medication) => ({
      name: medication.medicationName,
      dosage: medication.dosage,
      frequency: medication.frequency,
      duration: medication.duration,
      route: medication.route,
      timing: medication.timing || '',
      instructions: medication.instructions || '',
      quantity: medication.quantity ? String(medication.quantity) : '',
    })),
    prescriber: {
      name: `${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
      qualification:
        prescription.doctor.qualification || prescription.doctor.specialization || 'Dental Surgeon',
      registration: prescription.doctor.licenseNumber || '',
    },
  }
  return { prescription, clinic: clinic || { name: 'D/R Lemlem Special Dental Clinic' }, data }
}
