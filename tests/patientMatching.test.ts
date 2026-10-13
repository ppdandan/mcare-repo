import { prisma } from '../src/lib/prisma';
import { normalizePhoneNumber, normalizeName } from '../src/utils/phone';
import {
  findReturningPatient,
  linkPatientAccount,
  createNewPatientAccount,
} from '../src/services/patientMatching';
import { getPatientProfile, updatePatientProfile } from '../src/services/patientProfile';
import * as bcrypt from 'bcryptjs';

async function runTests() {
  console.log('--- Starting Patient Matching & Profile Test Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Phone normalization tests
    console.log('\n[Test Group 1: Phone Normalization]');
    assert(normalizePhoneNumber('+639171234567') === '09171234567', 'Format +639171234567 -> 09171234567');
    assert(normalizePhoneNumber('0917-123-4567') === '09171234567', 'Format 0917-123-4567 -> 09171234567');
    assert(normalizePhoneNumber('+63 917 123 4567') === '09171234567', 'Format +63 917 123 4567 -> 09171234567');
    assert(normalizePhoneNumber('9171234567') === '09171234567', 'Format 9171234567 -> 09171234567');
    assert(normalizePhoneNumber('09181234568') === '09181234568', 'Format 09181234568 -> 09181234568');

    let threwForInvalid = false;
    try {
      normalizePhoneNumber('12345');
    } catch {
      threwForInvalid = true;
    }
    assert(threwForInvalid, 'Invalid phone number throws error');

    // 2. Name normalization tests
    console.log('\n[Test Group 2: Name Normalization]');
    assert(normalizeName('  Maria   Santos  ') === 'maria santos', 'Normalizes extra spaces and lowercase');
    assert(normalizeName('CORAZON') === 'corazon', 'Converts uppercase to lowercase');

    // 3. Returning patient matching tests against seeded DB
    console.log('\n[Test Group 3: Returning Patient Matching]');
    const initialCount = await prisma.patient.count();
    console.log(`  Initial DB patient count: ${initialCount}`);

    // Exact match for seeded patient MC-0001 (Maria Santos, 09171234567) using +63 format
    const match1 = await findReturningPatient({
      firstName: 'MARIA',
      lastName: 'santos',
      contactNumber: '+63 917-123-4567',
    });

    assert(match1.matchFound === true, 'Exact match found for seeded Maria Santos');
    assert(match1.patient?.patientId === 'MC-0001', 'Matched correct patientId MC-0001');
    assert(match1.reason === 'EXACT_MATCH', 'Reason is EXACT_MATCH');

    // Phone match but different name -> NAME_MISMATCH
    const matchMismatchName = await findReturningPatient({
      firstName: 'Juana',
      lastName: 'Dela Cruz',
      contactNumber: '09171234567',
    });
    assert(matchMismatchName.matchFound === false, 'Different name with same phone returns false');
    assert(matchMismatchName.reason === 'NAME_MISMATCH', 'Reason is NAME_MISMATCH');

    // Name match but different phone -> PHONE_MISMATCH
    const matchMismatchPhone = await findReturningPatient({
      firstName: 'Maria',
      lastName: 'Santos',
      contactNumber: '09990001111',
    });
    assert(matchMismatchPhone.matchFound === false, 'Same name with different phone returns false');
    assert(matchMismatchPhone.reason === 'PHONE_MISMATCH', 'Reason is PHONE_MISMATCH');

    // Completely new person -> NOT_FOUND
    const matchNotFound = await findReturningPatient({
      firstName: 'Glenda',
      lastName: 'Manalo',
      contactNumber: '09995554444',
    });
    assert(matchNotFound.matchFound === false, 'Unregistered patient returns false');
    assert(matchNotFound.reason === 'NOT_FOUND', 'Reason is NOT_FOUND');

    // 4. Account linking tests
    console.log('\n[Test Group 4: Account Linking]');
    const passwordHash = await bcrypt.hash('secretPass123', 10);
    const linked = await linkPatientAccount({
      patientId: 'MC-0001',
      passwordHash,
    });

    assert(linked.isAppUser === true, 'Patient MC-0001 is now an app user');
    assert(linked.verificationStatus === 'VERIFIED', 'Verification status is VERIFIED');
    assert(linked.patientId === 'MC-0001', 'Patient ID remains MC-0001 (no duplicate generated)');

    const countAfterLink = await prisma.patient.count();
    assert(countAfterLink === initialCount, 'Total patient count did not increase after linking');

    // 5. Patient profile retrieval and update tests
    console.log('\n[Test Group 5: Profile Retrieval & Update]');
    const profile = await getPatientProfile('MC-0001');
    assert(profile !== null, 'Retrieved profile for MC-0001');
    assert(profile?.firstName === 'Maria', 'Profile firstName is Maria');
    assert(profile?.patientId === 'MC-0001', 'Profile has patientId MC-0001');
    assert(!('passwordHash' in (profile || {})), 'Profile strictly excludes passwordHash');

    // Update profile contact
    const updated = await updatePatientProfile('MC-0001', {
      address: 'Diamond Subd., Balibago, Angeles City',
      emergencyContact: 'Juan Santos (Spouse) - 09179998888',
    });
    assert(updated.address === 'Diamond Subd., Balibago, Angeles City', 'Updated address saved correctly');

    // 6. First-time new patient registration test
    console.log('\n[Test Group 6: New Patient Creation]');
    const newPatient = await createNewPatientAccount({
      firstName: 'Kaye',
      lastName: 'Rivera',
      contactNumber: '09201112222',
      address: 'Angeles City',
      passwordHash,
    });

    assert(newPatient.patientId.startsWith('MC-'), 'New patient received MC-XXXX identifier');
    assert(newPatient.isAppUser === true, 'New patient is marked as app user');
    console.log(`  Created new patient ID: ${newPatient.patientId}`);

    console.log(`\n--- Test Suite Summary: ${passed} PASSED, ${failed} FAILED ---`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test execution error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
