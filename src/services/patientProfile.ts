import { prisma } from '../lib/prisma';
import { normalizePhoneNumber } from '../utils/phone';

export interface PatientProfileDTO {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  contactNumber: string;
  email: string | null;
  address: string | null;
  birthDate: Date | null;
  emergencyContact: string | null;
  isAppUser: boolean;
  verificationStatus: string;
  createdAt: Date;
}

/**
 * Retrieves the patient's public profile and contact information,
 * strictly excluding sensitive internal authentication secrets.
 */
export async function getPatientProfile(patientId: string): Promise<PatientProfileDTO | null> {
  const patient = await prisma.patient.findUnique({
    where: { patientId },
    select: {
      id: true,
      patientId: true,
      firstName: true,
      lastName: true,
      middleName: true,
      contactNumber: true,
      email: true,
      address: true,
      birthDate: true,
      emergencyContact: true,
      isAppUser: true,
      verificationStatus: true,
      createdAt: true,
    },
  });

  return patient;
}

/**
 * Allows a patient to update their own contact information.
 */
export async function updatePatientProfile(
  patientId: string,
  updates: {
    contactNumber?: string;
    email?: string;
    address?: string;
    emergencyContact?: string;
  }
): Promise<PatientProfileDTO> {
  const data: {
    contactNumber?: string;
    email?: string | null;
    address?: string | null;
    emergencyContact?: string | null;
  } = {};

  if (updates.contactNumber) {
    data.contactNumber = normalizePhoneNumber(updates.contactNumber);
  }
  if (updates.email !== undefined) {
    data.email = updates.email?.trim() || null;
  }
  if (updates.address !== undefined) {
    data.address = updates.address?.trim() || null;
  }
  if (updates.emergencyContact !== undefined) {
    data.emergencyContact = updates.emergencyContact?.trim() || null;
  }

  const updated = await prisma.patient.update({
    where: { patientId },
    data,
    select: {
      id: true,
      patientId: true,
      firstName: true,
      lastName: true,
      middleName: true,
      contactNumber: true,
      email: true,
      address: true,
      birthDate: true,
      emergencyContact: true,
      isAppUser: true,
      verificationStatus: true,
      createdAt: true,
    },
  });

  return updated;
}
