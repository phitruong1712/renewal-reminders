'use client';

import { useState, useEffect } from 'react';
import dayjs from 'dayjs';

interface Customer {
  id: string;
  company_name: string;
  contact_name: string;
  primary_email: string;
  cc_emails: string[];
  plan_name: string;
  renew_link: string;
  expires_on: string;
  created_at?: string;
  updated_at?: string;
}

export default function AdminPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    primary_email: '',
    cc_emails: '',
    plan_name: '',
    renew_link: '',
    expires_on: '',
  });
  const [importData, setImportData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (res.ok) {
        setCustomers(data.customers || []);
      } else {
        setError(data.error || 'Failed to fetch customers');
      }
    } catch (err) {
      setError('Failed to fetch customers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const ccEmails = formData.cc_emails
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cc_emails: ccEmails,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('Customer added successfully');
        setFormData({
          company_name: '',
          contact_name: '',
          primary_email: '',
          cc_emails: '',
          plan_name: '',
          renew_link: '',
          expires_on: '',
        });
        setShowAddForm(false);
        fetchCustomers();
      } else {
        setError(data.error || 'Failed to add customer');
      }
    } catch (err) {
      setError('Failed to add customer');
      console.error(err);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const lines = importData.split('\n').filter((line) => line.trim());
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      
      let successCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        const customer: any = {};
        
        headers.forEach((header, index) => {
          customer[header] = values[index] || '';
        });

        try {
          const ccEmails = customer.cc_emails
            ? customer.cc_emails.split(';').map((e: string) => e.trim()).filter(Boolean)
            : [];

          const res = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_name: customer.company_name || customer.company,
              contact_name: customer.contact_name || customer.contact,
              primary_email: customer.primary_email || customer.email,
              cc_emails: ccEmails,
              plan_name: customer.plan_name || customer.plan,
              renew_link: customer.renew_link || customer.link,
              expires_on: customer.expires_on || customer.expires,
            }),
          });

          if (res.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          errorCount++;
        }
      }

      setSuccess(`Imported ${successCount} customers. ${errorCount} failed.`);
      setImportData('');
      setShowImportForm(false);
      fetchCustomers();
    } catch (err) {
      setError('Failed to import customers');
      console.error(err);
    }
  };

  const handleRenew = (customer: Customer) => {
    window.open(customer.renew_link, '_blank');
  };

  const getDaysUntilExpiry = (expiresOn: string) => {
    const days = dayjs(expiresOn).diff(dayjs(), 'day');
    return days;
  };

  const getExpiryStatus = (expiresOn: string) => {
    const days = getDaysUntilExpiry(expiresOn);
    if (days < 0) return { text: 'Expired', class: 'bg-red-100 text-red-800' };
    if (days === 0) return { text: 'Expires Today', class: 'bg-red-100 text-red-800' };
    if (days <= 3) return { text: `${days} days`, class: 'bg-orange-100 text-orange-800' };
    if (days <= 7) return { text: `${days} days`, class: 'bg-yellow-100 text-yellow-800' };
    return { text: `${days} days`, class: 'bg-green-100 text-green-800' };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage customer renewals</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setShowAddForm(true);
                setShowImportForm(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Customer
            </button>
            <button
              onClick={() => {
                setShowImportForm(true);
                setShowAddForm(false);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Import CSV
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Home
            </a>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {showAddForm && (
          <div className="mb-8 p-6 bg-white rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Add Customer</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.primary_email}
                    onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CC Emails (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.cc_emails}
                    onChange={(e) => setFormData({ ...formData, cc_emails: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email1@example.com, email2@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.plan_name}
                    onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expires On (YYYY-MM-DD) *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expires_on}
                    onChange={(e) => setFormData({ ...formData, expires_on: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Renew Link (URL) *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.renew_link}
                    onChange={(e) => setFormData({ ...formData, renew_link: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Customer
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showImportForm && (
          <div className="mb-8 p-6 bg-white rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Import CSV</h2>
            <p className="text-sm text-gray-600 mb-4">
              Format: company_name,contact_name,primary_email,cc_emails,plan_name,renew_link,expires_on
            </p>
            <form onSubmit={handleImport} className="space-y-4">
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="company_name,contact_name,primary_email,cc_emails,plan_name,renew_link,expires_on&#10;Acme,John Doe,john@acme.com,ops@acme.com,Pro,https://pay.example.com/acme,2025-11-12"
              />
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Import
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportForm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Customers</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-600">Loading...</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-gray-600">No customers found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires On
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer) => {
                    const status = getExpiryStatus(customer.expires_on);
                    return (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {customer.company_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.contact_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.primary_email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.plan_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {dayjs(customer.expires_on).format('MMM D, YYYY')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.class}`}>
                            {status.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleRenew(customer)}
                            className="text-blue-600 hover:text-blue-900 font-semibold"
                          >
                            Renew
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

