#!/usr/bin/env node
// DynamoDB setup script for Meturferse donation totals
// Usage: node scripts/setup-dynamodb.js [--dry|--warn|--commit]

import 'dotenv/config';
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists
} from '@aws-sdk/client-dynamodb';

const region = process.env.AWS_REGION || 'us-east-1';
const client = new DynamoDBClient({ region });

const TABLE_NAME = process.env.DDB_DONATION_TOTALS || 'ntc_donation_totals';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const WARN = argv.includes('--warn');
const COMMIT = argv.includes('--commit');

async function tableExists(name) {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch (e) {
    if (e.name === 'ResourceNotFoundException') return false;
    throw e;
  }
}

async function createDonationTotals() {
  const exists = await tableExists(TABLE_NAME);
  if (exists) {
    console.log(`skip: ${TABLE_NAME} exists`);
    return;
  }
  if (DRY) {
    console.log(`[dry] create ${TABLE_NAME} (currency HASH)`);
    return;
  }
  if (WARN && !COMMIT) {
    console.warn(`[warn] ${TABLE_NAME} missing (no create in warn mode)`);
    return;
  }

  console.log(`Creating table: ${TABLE_NAME}...`);
  await client.send(new CreateTableCommand({
    TableName: TABLE_NAME,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'currency', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'currency', KeyType: 'HASH' }
    ]
  }));

  console.log(`Waiting for table to be active...`);
  await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: TABLE_NAME });
  console.log(`created: ${TABLE_NAME}`);
}

async function main() {
  console.log(`Region: ${region}`);
  console.log(`Mode: ${DRY ? 'dry-run' : (COMMIT ? 'commit' : (WARN ? 'warn' : 'create-missing'))}`);
  console.log(`Table: ${TABLE_NAME}`);
  console.log('');
  await createDonationTotals();
  console.log('');
  console.log('Done.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
