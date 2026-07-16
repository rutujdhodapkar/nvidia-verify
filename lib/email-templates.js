const SITE = 'devcraft.fennark.xyz';

export function welcomeEmail({ name, email }) {
  return {
    subject: `Welcome to DEV/CRAFT Virtual Internship, ${name}!`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 10px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
<tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 30px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:26px;letter-spacing:-.5px">Welcome to DEV/CRAFT</h1>
<p style="margin:10px 0 0;color:rgba(255,255,255,.9);font-size:15px">Your virtual internship starts now</p>
</td></tr>
<tr><td style="padding:35px 30px">
<p style="font-size:15px;line-height:1.6;color:#333">Hi ${name},</p>
<p style="font-size:15px;line-height:1.6;color:#333">Congratulations on taking the first step toward building real-world skills. You've been enrolled in the DEV/CRAFT Virtual Internship Program.</p>
<p style="font-size:15px;line-height:1.6;color:#333">Here's what happens next:</p>
<table cellpadding="0" cellspacing="0" style="margin:20px 0">
<tr><td style="padding:12px 16px;background:#f0fdf4;border-radius:8px;font-size:14px;color:#166534">✓ <strong>Select Your Domain</strong> — Choose from 20+ domains like Web Dev, Data Science, Cyber Security, UI/UX & more</td></tr>
<tr><td style="padding:12px 16px;background:#f0fdf4;border-radius:8px;font-size:14px;color:#166534;margin-top:8px">✓ <strong>Get Your Offer Letter</strong> — Instant offer letter with your Intern ID once you select a domain</td></tr>
<tr><td style="padding:12px 16px;background:#f0fdf4;border-radius:8px;font-size:14px;color:#166534;margin-top:8px">✓ <strong>Complete Projects</strong> — Work through 6 weeks of real projects at your own pace</td></tr>
<tr><td style="padding:12px 16px;background:#f0fdf4;border-radius:8px;font-size:14px;color:#166534;margin-top:8px">✓ <strong>Get Certified</strong> — Receive your completion certificate with live verification</td></tr>
</table>
<p style="font-size:15px;line-height:1.6;color:#333">Visit <a href="https://${SITE}" style="color:#6366f1">${SITE}</a> to select your domain and begin.</p>
<p style="font-size:15px;line-height:1.6;color:#333">If you have any questions, just reply to this email.</p>
<p style="font-size:15px;line-height:1.6;color:#333;margin-top:25px">Best,<br><strong>The DEV/CRAFT Team</strong></p>
</td></tr>
<tr><td style="padding:20px 30px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8">
&copy; 2026 DEV/CRAFT by Fennark. All rights reserved.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

export function offerLetterEmail({ name, email, internId, domain }) {
  return {
    subject: `Your DEV/CRAFT Offer Letter & Intern ID — ${name}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 10px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
<tr><td style="background:linear-gradient(135deg,#059669,#10b981);padding:40px 30px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:24px">Offer Letter Issued</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:15px">Your internship has been officially confirmed</p>
</td></tr>
<tr><td style="padding:35px 30px">
<p style="font-size:15px;line-height:1.6;color:#333">Dear ${name},</p>
<p style="font-size:15px;line-height:1.6;color:#333">We are pleased to confirm your enrollment in the <strong>DEV/CRAFT Virtual Internship Program</strong>.</p>
<table style="margin:25px 0;width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden">
<tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">Intern ID</td>
<td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:16px;font-weight:600;color:#059669">${internId}</td></tr>
<tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">Domain</td>
<td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:16px;font-weight:600;color:#333">${domain}</td></tr>
<tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">Program Duration</td>
<td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:16px;font-weight:600;color:#333">6 Weeks</td></tr>
<tr><td style="padding:14px 20px;font-size:14px;color:#64748b">Status</td>
<td style="padding:14px 20px;font-size:16px;font-weight:600;color:#059669">Active</td></tr>
</table>
<p style="font-size:15px;line-height:1.6;color:#333">Your offer letter is now available in your dashboard. You can download it anytime.</p>
<p style="font-size:15px;line-height:1.6;color:#333"><strong>Your First Task:</strong> Upload a screenshot of your offer letter on LinkedIn and submit the link in your dashboard to complete Task 1.</p>
<p style="font-size:15px;line-height:1.6;color:#333">Visit <a href="https://${SITE}" style="color:#059669">${SITE}</a> to view your tasks and get started.</p>
<p style="font-size:15px;line-height:1.6;color:#333;margin-top:25px">Best,<br><strong>The DEV/CRAFT Team</strong></p>
</td></tr>
<tr><td style="padding:20px 30px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8">
&copy; 2026 DEV/CRAFT by Fennark. All rights reserved.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

export function paymentConfirmationEmail({ name, email, amount, paymentId, internId, domain }) {
  return {
    subject: `Payment Confirmed — DEV/CRAFT Internship (${internId})`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 10px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
<tr><td style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:40px 30px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:24px">Payment Successful</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:15px">Thank you for your payment</p>
</td></tr>
<tr><td style="padding:35px 30px">
<p style="font-size:15px;line-height:1.6;color:#333">Hi ${name},</p>
<p style="font-size:15px;line-height:1.6;color:#333">Your payment has been successfully processed. Your internship is now fully active.</p>
<table style="margin:25px 0;width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden">
<tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">Intern ID</td>
<td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:16px;font-weight:600;color:#333">${internId}</td></tr>
<tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">Domain</td>
<td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:16px;font-weight:600;color:#333">${domain || 'N/A'}</td></tr>
${amount ? `<tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">Amount Paid</td>
<td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:16px;font-weight:600;color:#2563eb">₹${amount}</td></tr>` : ''}
${paymentId ? `<tr><td style="padding:14px 20px;font-size:14px;color:#64748b">Transaction ID</td>
<td style="padding:14px 20px;font-size:16px;font-weight:600;color:#333">${paymentId}</td></tr>` : ''}
</table>
<p style="font-size:15px;line-height:1.6;color:#333">You can now start working on your projects. Head to your dashboard to begin.</p>
<p style="font-size:15px;line-height:1.6;color:#333">Visit <a href="https://${SITE}" style="color:#2563eb">${SITE}</a></p>
<p style="font-size:15px;line-height:1.6;color:#333;margin-top:25px">Best,<br><strong>The DEV/CRAFT Team</strong></p>
</td></tr>
<tr><td style="padding:20px 30px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8">
&copy; 2026 DEV/CRAFT by Fennark. All rights reserved.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

export function taskReminderEmail({ name, email, pendingTasks, daysSinceLastActivity, internId }) {
  const count = pendingTasks || 'several';
  return {
    subject: `Reminder: You have pending tasks — DEV/CRAFT (${internId})`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 10px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
<tr><td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:40px 30px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:24px">Task Reminder</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:15px">You have ${count} pending ${count === 1 ? 'task' : 'tasks'} to complete</p>
</td></tr>
<tr><td style="padding:35px 30px">
<p style="font-size:15px;line-height:1.6;color:#333">Hi ${name},</p>
<p style="font-size:15px;line-height:1.6;color:#333">This is a gentle reminder that you have <strong>${count} pending ${count === 1 ? 'task' : 'tasks'}</strong> in your DEV/CRAFT internship program.</p>
${daysSinceLastActivity ? `<p style="font-size:15px;line-height:1.6;color:#64748b">It's been ${daysSinceLastActivity} days since your last activity. Stay on track to complete your internship on time.</p>` : ''}
<p style="font-size:15px;line-height:1.6;color:#333">Log in to your dashboard to view and submit your pending tasks:</p>
<p style="text-align:center;margin:25px 0"><a href="https://${SITE}" style="display:inline-block;background:#f59e0b;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">Go to Dashboard</a></p>
<p style="font-size:15px;line-height:1.6;color:#333;margin-top:25px">Keep up the great work!<br><strong>The DEV/CRAFT Team</strong></p>
</td></tr>
<tr><td style="padding:20px 30px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8">
&copy; 2026 DEV/CRAFT by Fennark. All rights reserved.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

export function preExpiryEmail({ name, email, internId, domain, endDate, remainingTasks }) {
  const taskCount = remainingTasks || 0;
  return {
    subject: `Your internship ends in 5 days — DEV/CRAFT (${internId})`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 10px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
<tr><td style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:40px 30px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:24px">Internship Ending Soon</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:15px">5 days remaining to complete your program</p>
</td></tr>
<tr><td style="padding:35px 30px">
<p style="font-size:15px;line-height:1.6;color:#333">Hi ${name},</p>
<p style="font-size:15px;line-height:1.6;color:#333">Your DEV/CRAFT internship in <strong>${domain}</strong> is ending on <strong>${endDate}</strong> — that's just 5 days away!</p>
<p style="font-size:15px;line-height:1.6;color:#333"><strong>Pending Tasks: ${taskCount}</strong></p>
<p style="font-size:15px;line-height:1.6;color:#333">Complete your remaining tasks now to ensure you receive your completion certificate with live verification.</p>
<p style="text-align:center;margin:25px 0"><a href="https://${SITE}" style="display:inline-block;background:#dc2626;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">Complete Tasks Now</a></p>
<p style="font-size:15px;line-height:1.6;color:#333">Don't miss this opportunity to earn your certificate!</p>
<p style="font-size:15px;line-height:1.6;color:#333;margin-top:25px">Best,<br><strong>The DEV/CRAFT Team</strong></p>
</td></tr>
<tr><td style="padding:20px 30px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8">
&copy; 2026 DEV/CRAFT by Fennark. All rights reserved.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

export function completionCertificateEmail({ name, email, internId, domain }) {
  return {
    subject: `Congratulations ${name}! Your DEV/CRAFT Certificate is Ready 🎉`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 10px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:40px 30px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:26px">Congratulations!</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:15px">You've completed your DEV/CRAFT internship</p>
</td></tr>
<tr><td style="padding:35px 30px">
<p style="font-size:15px;line-height:1.6;color:#333">Dear ${name},</p>
<p style="font-size:15px;line-height:1.6;color:#333">We are thrilled to inform you that you have successfully completed the <strong>DEV/CRAFT Virtual Internship Program</strong> in <strong>${domain}</strong>.</p>
<table style="margin:25px 0;width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden">
<tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">Intern ID</td>
<td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;font-size:16px;font-weight:600;color:#7c3aed">${internId}</td></tr>
<tr><td style="padding:14px 20px;font-size:14px;color:#64748b">Domain</td>
<td style="padding:14px 20px;font-size:16px;font-weight:600;color:#333">${domain}</td></tr>
</table>
<p style="font-size:15px;line-height:1.6;color:#333">Your completion certificate is now available in your dashboard with a live verification link that employers can check instantly.</p>
<p style="font-size:15px;line-height:1.6;color:#333">Share your achievement on LinkedIn and tag DEV/CRAFT to inspire others!</p>
<p style="text-align:center;margin:25px 0"><a href="https://${SITE}/certificate/${internId}" style="display:inline-block;background:#7c3aed;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">View Certificate</a></p>
<p style="font-size:15px;line-height:1.6;color:#333;margin-top:25px">Best,<br><strong>The DEV/CRAFT Team</strong></p>
</td></tr>
<tr><td style="padding:20px 30px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8">
&copy; 2026 DEV/CRAFT by Fennark. All rights reserved.</td></tr>
</table></td></tr></table></body></html>`,
  };
}
