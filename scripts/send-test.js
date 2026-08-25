import 'dotenv/config';
import { sendInboxEmail, verifySmtp, gmailAddress } from '../lib/gmailer.js';

const TEST_TO = process.argv[2] || 'rutujdhodapkar@gmail.com';
const TEST_NAME = process.argv[3] || 'Rutuj';

async function main() {
  console.log(`[inbox-test] sender: ${gmailAddress()}`);
  await verifySmtp();
  console.log('[inbox-test] SMTP OK');

  const subject = 'Your DEV/CRAFT seat — quick question';
  const text = [
    `Hi ${TEST_NAME},`,
    '',
    'This is a deliverability test for our new mail pipeline.',
    '',
    'If you are reading this in your Primary inbox, it worked.',
    '',
    'One favor: hit reply and just say "got it". Replies tell Gmail',
    'this address belongs in Primary, which keeps every future mail',
    'out of Promotions and Spam.',
    '',
    '— Rutuj, DEV/CRAFT',
  ].join('\n');

  const result = await sendInboxEmail({ to: TEST_TO, toName: TEST_NAME, subject, text });
  console.log(`[inbox-test] sent to ${TEST_TO}`);
  console.log(`[inbox-test] messageId: ${result.messageId}`);
}

main().catch((err) => {
  console.error(`[inbox-test] FAILED: ${err.message}`);
  if (err.message.includes('GMAIL_USER')) {
    console.error('Create an app password at Google Account > Security > 2-Step Verification > App passwords');
    console.error('Then add GMAIL_USER + GMAIL_APP_PASSWORD to .env');
  }
  process.exit(1);
});
