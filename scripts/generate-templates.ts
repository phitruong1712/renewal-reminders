import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.join(__dirname, '..', 'Email Templates');

const roles = ['end_user', 'reseller', 'distributor'];
const stages = [
    { name: '2nd', offset: '-30 days', subjectSuffix: 'Reminder: Renewal Due in 30 Days' },
    { name: '3rd', offset: '-7 days', subjectSuffix: 'Urgent: Renewal Due in 7 Days' },
    { name: '4th', offset: 'Today', subjectSuffix: 'Action Required: License Expires Today' },
    { name: '5th', offset: '+7 days', subjectSuffix: 'Notice: License Has Expired' },
];

const baseContent = `MIME-Version: 1.0
Date: [DATE]
Subject: NAKIVO - [SUBJECT]
From: Phillip Truong <phillip.truong@nakivo.com>
To: [TO_EMAIL]
Content-Type: text/plain; charset="UTF-8"

Hello [CONTACT_NAME],

This is the [STAGE] reminder regarding the NAKIVO license for [COMPANY_NAME].

Current Status: [OFFSET_DESC] ([EXPIRES_ON])

Could you please provide an update on the renewal decision?

[RENEW_LINK_SECTION]

Best regards,

Phillip Truong | Install Base Manager
Phone: +44 20 3885 3318 | Email: phillip.truong@nakivo.com
NAKIVO Inc. | www.nakivo.com
`;

function generateTemplates() {
    if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir);
    }

    stages.forEach(stage => {
        roles.forEach(role => {
            const filename = `${stage.name}_${role}_reminder.eml`;
            const filePath = path.join(templatesDir, filename);

            let content = baseContent
                .replace('[STAGE]', stage.name)
                .replace('[OFFSET_DESC]', stage.offset)
                .replace('[DATE]', new Date().toUTCString());

            // Role-specific replacements
            if (role === 'end_user') {
                content = content
                    .replace('[SUBJECT]', `License Renewal - ${stage.subjectSuffix}`)
                    .replace('[TO_EMAIL]', '[end_user_primary_email]')
                    .replace('[CONTACT_NAME]', '[end_user_contact_name]')
                    .replace('[COMPANY_NAME]', '[end_user_company_name]')
                    .replace('[RENEW_LINK_SECTION]', 'If you wish to renew, please contact your reseller or click here: [renew_link]');
            } else if (role === 'reseller') {
                content = content
                    .replace('[SUBJECT]', `Renewal Opportunity - [end_user_company_name] - ${stage.subjectSuffix}`)
                    .replace('[TO_EMAIL]', '[reseller_primary_email]')
                    .replace('[CONTACT_NAME]', '[reseller_contact_name]')
                    .replace('[COMPANY_NAME]', '[end_user_company_name]')
                    .replace('[RENEW_LINK_SECTION]', 'Please follow up with the customer and let us know if you need a quote.');
            } else if (role === 'distributor') {
                content = content
                    .replace('[SUBJECT]', `Renewal Update - [end_user_company_name] - ${stage.subjectSuffix}`)
                    .replace('[TO_EMAIL]', '[distributor_primary_email]')
                    .replace('[CONTACT_NAME]', '[distributor_contact_name]')
                    .replace('[COMPANY_NAME]', '[end_user_company_name]')
                    .replace('[RENEW_LINK_SECTION]', 'Please check with the reseller [reseller_company_name] regarding this opportunity.');
            }

            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, content);
                console.log(`Created: ${filename}`);
            } else {
                console.log(`Skipped (exists): ${filename}`);
            }
        });
    });
}

generateTemplates();
