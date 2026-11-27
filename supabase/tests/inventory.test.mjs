#!/usr/bin/env node

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { localOrigin } from './local-origin.mjs';
const supabaseUrl = localOrigin(process.env.SUPABASE_URL);
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

assert.ok(anonKey && serviceRoleKey, 'SUPABASE_ANON_KEY and SERVICE_ROLE_KEY are required');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = [];
const createdItemIds = [];
let testFailure;


function report(name) {
  console.log(`PASS ${name}`);
}

function expectDenied(result, label) {
  assert.ok(result.error || !result.data?.length, `${label} unexpectedly succeeded`);
  report(label);
}

async function createAccount(role, label) {
  const email = `mcare-inv-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `M-Care Inventory Test ${label}` },
  });
  if (error) throw error;
  const userId = data.user.id;
  createdUserIds.push(userId);

  if (role !== 'patient') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', userId);
    if (roleError) throw roleError;
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: loginError } = await client.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  return { id: userId, client };
}

try {
  const clinicAdmin = await createAccount('admin', 'Clinic Admin');
  const patient = await createAccount('patient', 'Patient');
  const receptionist = await createAccount('receptionist', 'Receptionist');

  // Unauthenticated client: anon key, no sign-in.
  const anonymous = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- Item creation through the admin-only function ---
  const { data: itemAId, error: itemAError } = await clinicAdmin.client.rpc('create_inventory_item', {
    p_name: `Test Gloves ${randomUUID().slice(0, 8)}`,
    p_category: 'PPE',
    p_unit: 'box',
    p_current_stock: 12,
    p_minimum_stock: 5,
    p_location: 'Cabinet A',
    p_batch_number: 'BATCH-TEST-1',
    p_expiry_date: '2030-06-30',
  });
  if (itemAError) throw itemAError;
  createdItemIds.push(itemAId);
  report('clinic admin adds an inventory item through the function');

  const { data: itemARow, error: itemAReadError } = await clinicAdmin.client
    .from('inventory_items')
    .select('*')
    .eq('id', itemAId)
    .single();
  if (itemAReadError) throw itemAReadError;
  assert.equal(itemARow.current_stock, 12, 'Opening stock was not stored');
  assert.equal(itemARow.created_by, clinicAdmin.id, 'created_by was not the calling admin');
  assert.equal(itemARow.category, 'PPE');
  report('admin can read the inventory table and created_by records the caller');

  const { data: openingMovements, error: openingMovementsError } = await clinicAdmin.client
    .from('stock_movements')
    .select('*')
    .eq('item_id', itemAId);
  if (openingMovementsError) throw openingMovementsError;
  assert.equal(openingMovements?.length, 1, 'Opening stock did not write exactly one ledger row');
  assert.equal(openingMovements[0].movement_type, 'in');
  assert.equal(openingMovements[0].quantity, 12);
  assert.equal(openingMovements[0].created_by, clinicAdmin.id, 'Ledger row did not record the caller from auth.uid()');
  report('opening stock above zero is written as the first ledger row with the caller recorded');

  const { data: itemBId, error: itemBError } = await clinicAdmin.client.rpc('create_inventory_item', {
    p_name: `Test Swabs ${randomUUID().slice(0, 8)}`,
    p_current_stock: 0,
    p_minimum_stock: 0,
  });
  if (itemBError) throw itemBError;
  createdItemIds.push(itemBId);
  const { data: itemBMovements, error: itemBMovementsError } = await clinicAdmin.client
    .from('stock_movements')
    .select('id')
    .eq('item_id', itemBId);
  if (itemBMovementsError) throw itemBMovementsError;
  assert.equal(itemBMovements?.length, 0, 'Zero opening stock wrote a ledger row');
  report('item with zero opening stock creates no ledger row');

  // --- Creation denied for non-admins ---
  const patientCreate = await patient.client.rpc('create_inventory_item', { p_name: 'Nope' });
  assert.ok(patientCreate.error, 'Patient created an inventory item through the function');
  report('patient item-creation RPC is rejected');

  const receptionistCreate = await receptionist.client.rpc('create_inventory_item', { p_name: 'Nope' });
  assert.ok(receptionistCreate.error, 'Receptionist created an inventory item through the function');
  report('non-admin staff item-creation RPC is rejected');

  const anonCreate = await anonymous.rpc('create_inventory_item', { p_name: 'Nope' });
  assert.ok(anonCreate.error, 'Unauthenticated caller created an inventory item');
  report('unauthenticated item-creation RPC is rejected');

  // --- Reads: patients, non-admin staff, and anonymous users read nothing ---
  const patientRead = await patient.client.from('inventory_items').select('id').eq('id', itemAId);
  expectDenied(patientRead, 'patient inventory read returns nothing');

  const patientMovementRead = await patient.client.from('stock_movements').select('id').eq('item_id', itemAId);
  expectDenied(patientMovementRead, 'patient stock-movement read returns nothing');

  const receptionistRead = await receptionist.client.from('inventory_items').select('id').eq('id', itemAId);
  expectDenied(receptionistRead, 'non-admin staff inventory read returns nothing');

  const receptionistMovementRead = await receptionist.client.from('stock_movements').select('id').eq('item_id', itemAId);
  expectDenied(receptionistMovementRead, 'non-admin staff stock-movement read returns nothing');

  const anonRead = await anonymous.from('inventory_items').select('id');
  expectDenied(anonRead, 'unauthenticated inventory read is rejected');

  const anonMovementRead = await anonymous.from('stock_movements').select('id');
  expectDenied(anonMovementRead, 'unauthenticated stock-movement read is rejected');

  // --- Movement recording: denied for non-admins ---
  const patientRpc = await patient.client.rpc('record_stock_movement', {
    p_item_id: itemAId,
    p_movement_type: 'out',
    p_quantity: 1,
    p_reason: 'Automated test',
  });
  assert.ok(patientRpc.error, 'Patient recorded a stock movement through the RPC');
  report('patient stock-movement RPC is rejected');

  const receptionistRpc = await receptionist.client.rpc('record_stock_movement', {
    p_item_id: itemAId,
    p_movement_type: 'out',
    p_quantity: 1,
    p_reason: 'Automated test',
  });
  assert.ok(receptionistRpc.error, 'Receptionist recorded a stock movement through the RPC');
  report('non-admin staff stock-movement RPC is rejected');

  const anonRpc = await anonymous.rpc('record_stock_movement', {
    p_item_id: itemAId,
    p_movement_type: 'out',
    p_quantity: 1,
    p_reason: 'Automated test',
  });
  assert.ok(anonRpc.error, 'Unauthenticated caller recorded a stock movement');
  report('unauthenticated stock-movement RPC is rejected');

  // --- Movement validation ---
  const zeroQty = await clinicAdmin.client.rpc('record_stock_movement', {
    p_item_id: itemAId, p_movement_type: 'out', p_quantity: 0, p_reason: 'Automated test',
  });
  assert.ok(zeroQty.error, 'Quantity of zero was not rejected');
  const negativeQty = await clinicAdmin.client.rpc('record_stock_movement', {
    p_item_id: itemAId, p_movement_type: 'out', p_quantity: -3, p_reason: 'Automated test',
  });
  assert.ok(negativeQty.error, 'Negative quantity was not rejected');
  report('quantity of zero or less is rejected');

  const overspend = await clinicAdmin.client.rpc('record_stock_movement', {
    p_item_id: itemAId, p_movement_type: 'out', p_quantity: 999, p_reason: 'Automated test',
  });
  assert.match(overspend.error?.message ?? '', /insufficient stock/i, 'Out movement above stock was not rejected');
  report('out movement above the current stock is rejected');

  const badType = await clinicAdmin.client.rpc('record_stock_movement', {
    p_item_id: itemAId, p_movement_type: 'sideways', p_quantity: 1, p_reason: 'Automated test',
  });
  assert.ok(badType.error, 'Unknown movement type was not rejected');
  report('unknown movement type is rejected');

  // --- Stock in ---
  const { error: inError } = await clinicAdmin.client.rpc('record_stock_movement', {
    p_item_id: itemAId,
    p_movement_type: 'in',
    p_quantity: 5,
    p_reason: 'Weekly restock',
  });
  if (inError) throw inError;
  const { data: afterIn, error: afterInError } = await clinicAdmin.client
    .from('inventory_items')
    .select('current_stock')
    .eq('id', itemAId)
    .single();
  if (afterInError) throw afterInError;
  assert.equal(afterIn.current_stock, 17, 'Stock in did not add to the current stock');
  report('clinic admin records stock in and the stock level updates');

  // --- Adjustment sets the stock to the counted value ---
  const { error: adjustError } = await clinicAdmin.client.rpc('record_stock_movement', {
    p_item_id: itemAId,
    p_movement_type: 'adjustment',
    p_quantity: 9,
    p_reason: 'Physical count correction',
  });
  if (adjustError) throw adjustError;
  const { data: afterAdjust, error: afterAdjustError } = await clinicAdmin.client
    .from('inventory_items')
    .select('current_stock')
    .eq('id', itemAId)
    .single();
  if (afterAdjustError) throw afterAdjustError;
  assert.equal(afterAdjust.current_stock, 9, 'Adjustment did not set the counted stock value');
  report('adjustment sets the stock to the counted value');

  // --- Concurrent overspend attempts can never drive stock negative ---
  const [raceOne, raceTwo] = await Promise.all([
    clinicAdmin.client.rpc('record_stock_movement', {
      p_item_id: itemAId, p_movement_type: 'out', p_quantity: 8, p_reason: 'Concurrent request one',
    }),
    clinicAdmin.client.rpc('record_stock_movement', {
      p_item_id: itemAId, p_movement_type: 'out', p_quantity: 8, p_reason: 'Concurrent request two',
    }),
  ]);
  const raceFailures = [raceOne, raceTwo].filter((r) => r.error);
  assert.ok(raceFailures.length >= 1, 'Two concurrent outs above stock both succeeded');
  assert.ok(raceFailures.length <= 1, `Both concurrent outs failed unexpectedly: ${raceFailures.map((r) => r.error?.message).join(' | ')}`);
  const { data: afterRace, error: afterRaceError } = await clinicAdmin.client
    .from('inventory_items')
    .select('current_stock')
    .eq('id', itemAId)
    .single();
  if (afterRaceError) throw afterRaceError;
  assert.equal(afterRace.current_stock, 1, 'Concurrent overspend left the stock at an unexpected level');
  assert.ok(afterRace.current_stock >= 0, 'Stock went negative under concurrent requests');
  report('two concurrent out requests are serialized and stock never goes negative');

  // --- No direct writes for anyone, including the admin ---
  const adminDirectInsert = await clinicAdmin.client.from('inventory_items').insert({
    name: 'Direct insert attempt', created_by: clinicAdmin.id,
  }).select('id');
  expectDenied(adminDirectInsert, 'admin direct insert into inventory_items is rejected');

  const patientDirectInsert = await patient.client.from('inventory_items').insert({
    name: 'Patient insert attempt', created_by: patient.id,
  }).select('id');
  expectDenied(patientDirectInsert, 'patient direct insert into inventory_items is rejected');

  const adminDirectInsertMovement = await clinicAdmin.client.from('stock_movements').insert({
    item_id: itemAId, movement_type: 'out', quantity: 1, reason: 'Direct', stock_after: 0, created_by: clinicAdmin.id,
  }).select('id');
  expectDenied(adminDirectInsertMovement, 'admin direct insert into stock_movements is rejected');

  const adminDirectUpdate = await clinicAdmin.client.from('inventory_items')
    .update({ current_stock: 999 }).eq('id', itemAId).select('id');
  expectDenied(adminDirectUpdate, 'admin direct update of inventory_items is rejected');

  const adminDirectDelete = await clinicAdmin.client.from('inventory_items')
    .delete().eq('id', itemBId).select('id');
  expectDenied(adminDirectDelete, 'admin direct delete of inventory_items is rejected');

  // --- Movement history can never be updated or deleted ---
  const adminMovementUpdate = await clinicAdmin.client.from('stock_movements')
    .update({ quantity: 999 }).eq('item_id', itemAId).select('id');
  expectDenied(adminMovementUpdate, 'movement history update is rejected');

  const adminMovementDelete = await clinicAdmin.client.from('stock_movements')
    .delete().eq('item_id', itemAId).select('id');
  expectDenied(adminMovementDelete, 'movement history delete is rejected');

  const patientMovementDelete = await patient.client.from('stock_movements')
    .delete().eq('item_id', itemAId).select('id');
  expectDenied(patientMovementDelete, 'patient movement history delete is rejected');

  // --- Ledger integrity at the end of the run ---
  const { data: finalLedger, error: finalLedgerError } = await clinicAdmin.client
    .from('stock_movements')
    .select('movement_type, quantity, stock_after, created_at')
    .eq('item_id', itemAId)
    .order('created_at', { ascending: true });
  if (finalLedgerError) throw finalLedgerError;
  assert.equal(finalLedger.length, 4, 'Unexpected number of ledger rows for the test item');
  assert.deepEqual(
    finalLedger.map((row) => [row.movement_type, row.stock_after]),
    [['in', 12], ['in', 17], ['adjustment', 9], ['out', 1]],
    'Ledger rows do not match the recorded movements',
  );
  report('ledger rows record every accepted movement in order with stock_after');
} catch (error) {
  testFailure = error;
} finally {
  const cleanupErrors = [];
  if (createdItemIds.length) {
    const { error } = await admin.from('audit_logs')
      .delete().eq('table_name', 'inventory_items').in('record_id', createdItemIds);
    if (error) cleanupErrors.push(error.message);
    // The ledger trigger allows deletes only under the service key, which the
    // admin client uses; the FK is RESTRICT, so movements go before items.
    const { error: movementError } = await admin.from('stock_movements')
      .delete().in('item_id', createdItemIds);
    if (movementError) cleanupErrors.push(movementError.message);
    const { error: itemError } = await admin.from('inventory_items')
      .delete().in('id', createdItemIds);
    if (itemError) cleanupErrors.push(itemError.message);
  }
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) cleanupErrors.push(error.message);
  }
  if (cleanupErrors.length) {
    console.error('Test cleanup failed for one or more temporary fixtures.');
    for (const message of cleanupErrors) console.error(message);
    testFailure ??= new Error('Temporary fixture cleanup failed');
  } else if (createdUserIds.length || createdItemIds.length) {
    report('temporary users, inventory items, movements, and audit rows cleaned up');
  }
}

if (testFailure) {
  console.error(`FAIL ${testFailure.message}`);
  process.exitCode = 1;
} else {
  console.log('All inventory security checks passed.');
}
