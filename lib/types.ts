export type CustomerRow = {
  id: number;
  // Legacy fields (kept for backward compatibility)
  company_name: string | null;
  contact_name: string | null;
  primary_email: string;
  cc_emails: string[] | null;
  plan_name: string | null;
  renew_link: string | null;
  // New distributor/reseller/end-user structure
  distributor_name: string | null;
  distributor_contact_name: string | null;
  distributor_primary_email: string | null;
  reseller_name: string | null;
  reseller_contact_name: string | null;
  reseller_primary_email: string | null;
  reseller_cc_emails: string[] | null;
  end_user_company_name: string | null;
  end_user_contact_name: string | null;
  end_user_primary_email: string | null;
  end_user_cc_emails: string[] | null;
  edition: string | null;
  licensing: string | null;
  expires_on: string | null; // "YYYY-MM-DD"
  paused: boolean;
  last_reminder_status: string | null;
  last_reminder_sent_at: string | null; // ISO
};

export type CustomerInput = {
  // Legacy fields
  company_name?: string;
  contact_name?: string;
  primary_email?: string;
  cc_emails?: string[];
  plan_name?: string;
  renew_link?: string;
  // New fields
  distributor_name?: string;
  distributor_contact_name?: string;
  distributor_primary_email?: string;
  reseller_name?: string;
  reseller_contact_name?: string;
  reseller_primary_email?: string;
  reseller_cc_emails?: string[];
  end_user_company_name?: string;
  end_user_contact_name?: string;
  end_user_primary_email?: string;
  end_user_cc_emails?: string[];
  edition?: string;
  licensing?: string;
  expires_on: string; // "YYYY-MM-DD"
  paused?: boolean;
};

// Helper to determine the recipient based on the relationship structure
export function getRecipientInfo(customer: CustomerRow): {
  email: string;
  name: string | null;
  company: string | null;
  cc: string[] | null;
  relationship: 'distributor' | 'reseller' | 'end_user';
} {
  // If distributor exists and is not "Not Applicable"
  if (
    customer.distributor_primary_email &&
    customer.distributor_primary_email.toLowerCase() !== 'not applicable' &&
    customer.distributor_primary_email.trim() !== ''
  ) {
    return {
      email: customer.distributor_primary_email,
      name: customer.distributor_contact_name,
      company: customer.distributor_name,
      cc: null,
      relationship: 'distributor',
    };
  }
  
  // If reseller exists and is not "Not Applicable"
  if (
    customer.reseller_primary_email &&
    customer.reseller_primary_email.toLowerCase() !== 'not applicable' &&
    customer.reseller_primary_email.trim() !== ''
  ) {
    return {
      email: customer.reseller_primary_email,
      name: customer.reseller_contact_name,
      company: customer.reseller_name,
      cc: customer.reseller_cc_emails,
      relationship: 'reseller',
    };
  }
  
  // Default to end_user (direct sale)
  return {
    email: customer.end_user_primary_email || customer.primary_email,
    name: customer.end_user_contact_name || customer.contact_name,
    company: customer.end_user_company_name || customer.company_name,
    cc: customer.end_user_cc_emails || customer.cc_emails,
    relationship: 'end_user',
  };
}





