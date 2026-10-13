import { prisma } from '../lib/prisma';
import { normalizePhoneNumber, normalizeName } from '../utils/phone';
import { Patient } from '@prisma/client';

export interface MatchingResult {
  matchFound: boolean;
  alreadyLinked?: boolean;
  reason?: 'EXACT_MATCH' | 'NAME_MISMATCH' | 'PHONE_MISMATCH' | 'NOT_FOUND';
  patient?: Patient;
  candidatePatientId?: string;
}

/**
 * Searches existing Patient records by Name and Phone Number to identify returning patients.
 * Prevents duplicating MC-XXXX IDs while flagging partial mismatches for staff triage.
 */
export async function findReturningPatient(params: {
  firstName: string;
  lastName: string;
  contactNumber: string;
}): Promise<MatchingResult> {
  const normalizedPhone = normalizePhoneNumber(params.contactNumber);
  const inputFirst = normalizeName(params.firstName);
  const inputLast = normalizeName(params.lastName);

  // 1. Check for patients with matching contact number
  const phoneCandidates = await prisma.patient.findMany({
    where: {
      contactNumber: normalizedPhone,
    },
  });

  for (const candidate of phoneCandidates) {
    const candidateFirst = normalizeName(candidate.firstName);
    const candidateLast = normalizeName(candidate.lastName);

    if (candidateFirst === inputFirst && candidateLast === inputLast) {
      return {
        matchFound: true,
        alreadyLinked: candidate.isAppUser,
        reason: 'EXACT_MATCH',
        patient: candidate,
      };
    }
  }

  // If phone matches someone else, flag for receptionist review
  if (phoneCandidates.length > 0) {
    return {
      matchFound: false,
      reason: 'NAME_MISMATCH',
      candidatePatientId: phoneCandidates[0].patientId,
    };
  }

  // 2. Check if a patient with the exact name exists under a different contact number
  const allPatients = await prisma.patient.findMany({
    select: {
      id: true,
      patientId: true,
      firstName: true,
      lastName: true,
      contactNumber: true,
    },
  });

  const nameCandidate = allPatients.find(
    (p) => normalizeName(p.firstName) === inputFirst && normalizeName(p.lastName) === inputLast
  );

  if (nameCandidate) {
    return {
      matchFound: false,
      reason: 'PHONE_MISMATCH',
      candidatePatientId: nameCandidate.patientId,
    };
  }

  return {
    matchFound: false,
    reason: 'NOT_FOUND',
  };
}

/**
 * Links an app registration to an existing Patient record (MC-XXXX),
 * setting credentials without duplicating the patient entity.
 */
export async function linkPatientAccount(params: {
  patientId: string;
  passwordHash: string;
}): Promise<Patient> {
  const existing = await prisma.patient.findUnique({
    where: { patientId: params.patientId },
  });

  if (!existing) {
    throw new Error(`Patient record ${params.patientId} does not exist`);
  }

  return await prisma.patient.update({
    where: { patientId: params.patientId },
    data: {
      isAppUser: true,
      passwordHash: params.passwordHash,
      verificationStatus: 'VERIFIED',
      appRegisteredAt: new Date(),
    },
  });
}

/**
 * Generates the next sequential MC-XXXX patient ID for new patients.
 */
export async function generateNextPatientId(): Promise<string> {
  const patients = await prisma.patient.findMany({
    select: { patientId: true },
  });

  let maxNum = 0;
  for (const p of patients) {
    const match = p.patientId.match(/^MC-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `MC-${nextNum.toString().padStart(4, '0')}`;
}

/**
 * Creates a brand new Patient record for first-time patients who are not in the system.
 */
export async function createNewPatientAccount(params: {
  firstName: string;
  lastName: string;
  middleName?: string;
  contactNumber: string;
  address?: string;
  birthDate?: Date;
  emergencyContact?: string;
  passwordHash: string;
}): Promise<Patient> {
  const normalizedPhone = normalizePhoneNumber(params.contactNumber);
  const nextId = await generateNextPatientId();

  return await prisma.patient.create({
    data: {
      patientId: nextId,
      firstName: params.firstName.trim(),
      lastName: params.lastName.trim(),
      middleName: params.middleName?.trim(),
      contactNumber: normalizedPhone,
      address: params.address?.trim(),
      birthDate: params.birthDate,
      emergencyContact: params.emergencyContact?.trim(),
      isAppUser: true,
      passwordHash: params.passwordHash,
      verificationStatus: 'VERIFIED',
      appRegisteredAt: new Date(),
    },
  });
}
