export type CustomerRow = {
  id: number;
  company_name: string | null;
  contact_name: string | null;
  primary_email: string;
  cc_emails: string[] | null;
  plan_name: string | null;
  renew_link: string | null;
  expires_on: string | null; // "YYYY-MM-DD"
  paused: boolean;
  last_reminder_status: string | null;
  last_reminder_sent_at: string | null; // ISO
};

export type CustomerInput = {
  company_name?: string;
  contact_name?: string;
  primary_email: string;
  cc_emails?: string[];
  plan_name?: string;
  renew_link?: string;
  expires_on: string; // "YYYY-MM-DD"
  paused?: boolean;
};

