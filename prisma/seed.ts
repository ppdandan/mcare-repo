import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const Role = {
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  RECEPTIONIST: 'RECEPTIONIST',
} as const;

export const VerificationStatus = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
} as const;

export const AppointmentType = {
  CHECKUP: 'CHECKUP',
  ULTRASOUND: 'ULTRASOUND',
} as const;

export const AppointmentStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export const PaymentStatus = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
} as const;

export const NotificationType = {
  STATUS_UPDATE: 'STATUS_UPDATE',
  REMINDER: 'REMINDER',
  GENERAL: 'GENERAL',
} as const;

async function main() {
  console.log('Seeding M-Care database...');

  // 1. Seed Clinic Settings
  const settings = await prisma.clinicSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      clinicName: 'M-Care OB-GYNE Clinic & Ultrasound',
      doctorName: 'Dr. Maria Corazon',
      specialization: 'Obstetrics & Gynecology, Ultrasound Specialist',
      contactNumber: '0917-555-0199',
      email: 'info@mcareclinic.ph',
      address: 'MacArthur Highway, Balibago, Angeles City, Pampanga',
      operatingDays: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
      operatingHoursOpen: '09:00',
      operatingHoursClose: '17:00',
      appointmentInterval: 30,
      latitude: 15.1685,
      longitude: 120.5901,
    },
  });
  console.log('Clinic Settings seeded:', settings.clinicName);

  // 2. Seed Staff Accounts
  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash('admin123', salt);
  const doctorHash = await bcrypt.hash('doctor123', salt);
  const recepHash = await bcrypt.hash('recep123', salt);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: 'System Administrator',
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });

  const doctor = await prisma.user.upsert({
    where: { username: 'doctor' },
    update: {},
    create: {
      username: 'doctor',
      name: 'Dr. Maria Corazon',
      passwordHash: doctorHash,
      role: Role.DOCTOR,
    },
  });

  const receptionist = await prisma.user.upsert({
    where: { username: 'receptionist' },
    update: {},
    create: {
      username: 'receptionist',
      name: 'Elena Cruz',
      passwordHash: recepHash,
      role: Role.RECEPTIONIST,
    },
  });
  console.log('Staff accounts seeded:', { admin: admin.username, doctor: doctor.username, receptionist: receptionist.username });

  // 3. Seed Sample Existing Patients (Phase 1 records)
  const patient1 = await prisma.patient.upsert({
    where: { patientId: 'MC-0001' },
    update: {},
    create: {
      patientId: 'MC-0001',
      firstName: 'Maria',
      lastName: 'Santos',
      middleName: 'Dela Cruz',
      contactNumber: '09171234567',
      email: 'maria.santos@gmail.com',
      address: 'Balibago, Angeles City, Pampanga',
      birthDate: new Date('1992-05-14'),
      emergencyContact: 'Juan Santos - 09179998888',
      isAppUser: false,
      verificationStatus: VerificationStatus.UNVERIFIED,
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { patientId: 'MC-0002' },
    update: {},
    create: {
      patientId: 'MC-0002',
      firstName: 'Ana',
      lastName: 'Reyes',
      middleName: 'Morales',
      contactNumber: '09181234568',
      email: 'ana.reyes@yahoo.com',
      address: 'Malabanias, Angeles City, Pampanga',
      birthDate: new Date('1995-10-22'),
      emergencyContact: 'Pedro Reyes - 09187776666',
      isAppUser: false,
      verificationStatus: VerificationStatus.UNVERIFIED,
    },
  });
  console.log('Sample patients seeded:', [patient1.patientId, patient2.patientId]);

  // 4. Seed Existing Appointments
  const appointment1 = await prisma.appointment.upsert({
    where: { appointmentId: 'AP-0001' },
    update: {},
    create: {
      appointmentId: 'AP-0001',
      patientId: patient1.id,
      doctorId: doctor.id,
      appointmentDate: new Date('2026-09-15T09:00:00Z'),
      timeSlot: '09:00 AM',
      appointmentType: AppointmentType.CHECKUP,
      status: AppointmentStatus.COMPLETED,
      notes: 'Initial prenatal consultation',
    },
  });

  const appointment2 = await prisma.appointment.upsert({
    where: { appointmentId: 'AP-0002' },
    update: {},
    create: {
      appointmentId: 'AP-0002',
      patientId: patient2.id,
      doctorId: doctor.id,
      appointmentDate: new Date('2026-10-20T10:00:00Z'),
      timeSlot: '10:00 AM',
      appointmentType: AppointmentType.ULTRASOUND,
      status: AppointmentStatus.APPROVED,
      notes: 'Pelvic ultrasound requested',
    },
  });
  console.log('Sample appointments seeded:', [appointment1.appointmentId, appointment2.appointmentId]);

  // 5. Seed Payments
  await prisma.payment.upsert({
    where: { appointmentId: appointment1.id },
    update: {},
    create: {
      paymentId: 'PAY-0001',
      appointmentId: appointment1.id,
      patientId: patient1.id,
      totalAmount: 500.0,
      amountPaid: 500.0,
      balance: 0.0,
      status: PaymentStatus.PAID,
      paymentMethod: 'Cash',
    },
  });

  await prisma.payment.upsert({
    where: { appointmentId: appointment2.id },
    update: {},
    create: {
      paymentId: 'PAY-0002',
      appointmentId: appointment2.id,
      patientId: patient2.id,
      totalAmount: 1200.0,
      amountPaid: 500.0,
      balance: 700.0,
      status: PaymentStatus.PARTIAL,
      paymentMethod: 'GCash',
    },
  });
  console.log('Sample payments seeded for AP-0001 and AP-0002');

  // 6. Seed Medical Record (for completed visit AP-0001)
  await prisma.medicalRecord.upsert({
    where: { recordId: 'MR-0001' },
    update: {},
    create: {
      recordId: 'MR-0001',
      patientId: patient1.id,
      doctorId: doctor.id,
      visitDate: new Date('2026-09-15T09:00:00Z'),
      diagnosis: 'Normal intrauterine pregnancy, 8 weeks gestation',
      prescription: 'Folic acid 400mcg once daily, Ferrous sulfate once daily',
      clinicalNotes: 'Uterine size compatible with dates. Heartbeat regular at 155 bpm. Advised balanced nutrition.',
    },
  });
  console.log('Sample medical record seeded for MC-0001');

  console.log('Database seeding successfully finished.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
