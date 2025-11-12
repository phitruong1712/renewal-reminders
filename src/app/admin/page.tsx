'use client';

import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/lib/toast';
import { fetchJson } from '@/lib/fetchJson';
import { Search, Plus, Upload, RefreshCw, Edit, Pause, Play } from 'lucide-react';
import type { CustomerRow } from '@/lib/types';

const PAGE_SIZE = 20;

export default function AdminPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRenewDialog, setShowRenewDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    primary_email: '',
    cc_emails: '',
    plan_name: '',
    renew_link: '',
    expires_on: '',
    paused: false,
  });
  const [importData, setImportData] = useState('');
  const { toast } = useToast();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
      });
      if (debouncedQuery) {
        params.append('q', debouncedQuery);
      }
      const data = await fetchJson<{ rows: CustomerRow[]; total: number }>(
        `/api/customers?${params}`
      );
      setCustomers(data.rows);
      setTotal(data.total);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to fetch customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page, toast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ccEmails = formData.cc_emails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      await fetchJson('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cc_emails: ccEmails,
        }),
      });
      toast('Customer added successfully', 'success');
      setShowAddDialog(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to add customer', 'error');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      const ccEmails = formData.cc_emails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      await fetchJson('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cc_emails: ccEmails,
        }),
      });
      toast('Customer updated successfully', 'success');
      setShowEditDialog(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to update customer', 'error');
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const lines = importData.split('\n').filter((line) => line.trim());
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      
      const rows = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return {
          company_name: row.company_name || row.company,
          contact_name: row.contact_name || row.contact,
          primary_email: row.primary_email || row.email,
          cc_emails: row.cc_emails ? row.cc_emails.split(',').map((e: string) => e.trim()).filter(Boolean) : [],
          plan_name: row.plan_name || row.plan,
          renew_link: row.renew_link || row.link,
          expires_on: row.expires_on || row.expires,
          paused: row.paused === 'true' || row.paused === '1',
        };
      }).filter((row) => row.primary_email && row.expires_on);

      const result = await fetchJson<{ inserted: number; updated: number; reminders: number }>(
        '/api/customers/import',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        }
      );
      toast(`Imported ${result.inserted} new, ${result.updated} updated`, 'success');
      setShowImportDialog(false);
      setImportData('');
      fetchCustomers();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to import customers', 'error');
    }
  };

  const handleRenew = async (term: string) => {
    if (!selectedCustomer) return;
    try {
      await fetchJson(`/api/customers/${selectedCustomer.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term }),
      });
      toast('Customer renewed successfully', 'success');
      setShowRenewDialog(false);
      fetchCustomers();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to renew customer', 'error');
    }
  };

  const handleRenewCustom = async (date: string) => {
    if (!selectedCustomer) return;
    try {
      await fetchJson(`/api/customers/${selectedCustomer.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      toast('Customer renewed successfully', 'success');
      setShowRenewDialog(false);
      fetchCustomers();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to renew customer', 'error');
    }
  };

  const handlePause = async (customer: CustomerRow, paused: boolean) => {
    try {
      await fetchJson(`/api/customers/${customer.id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused }),
      });
      toast(`Customer ${paused ? 'paused' : 'unpaused'} successfully`, 'success');
      fetchCustomers();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to update customer', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      contact_name: '',
      primary_email: '',
      cc_emails: '',
      plan_name: '',
      renew_link: '',
      expires_on: '',
      paused: false,
    });
    setSelectedCustomer(null);
  };

  const openEditDialog = (customer: CustomerRow) => {
    setSelectedCustomer(customer);
    setFormData({
      company_name: customer.company_name || '',
      contact_name: customer.contact_name || '',
      primary_email: customer.primary_email,
      cc_emails: customer.cc_emails?.join(', ') || '',
      plan_name: customer.plan_name || '',
      renew_link: customer.renew_link || '',
      expires_on: customer.expires_on || '',
      paused: customer.paused,
    });
    setShowEditDialog(true);
  };

  const openRenewDialog = (customer: CustomerRow) => {
    setSelectedCustomer(customer);
    setShowRenewDialog(true);
  };

  const getExpiryStatus = (expiresOn: string | null) => {
    if (!expiresOn) return { text: 'Unknown', class: 'bg-gray-100 text-gray-800' };
    const days = dayjs(expiresOn).diff(dayjs(), 'day');
    if (days < 0) return { text: 'Expired', class: 'bg-red-100 text-red-800' };
    if (days === 0) return { text: 'Today', class: 'bg-red-100 text-red-800' };
    if (days <= 3) return { text: `${days}d`, class: 'bg-orange-100 text-orange-800' };
    if (days <= 7) return { text: `${days}d`, class: 'bg-yellow-100 text-yellow-800' };
    return { text: `${days}d`, class: 'bg-green-100 text-green-800' };
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage customer renewals</p>
          </div>
          <div className="flex gap-4">
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
            <Button onClick={() => setShowImportDialog(true)} variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={fetchCustomers} variant="ghost">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
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
                    Last Reminder
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paused
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => {
                    const status = getExpiryStatus(customer.expires_on);
                    return (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {customer.company_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.contact_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.primary_email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.plan_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.expires_on ? dayjs(customer.expires_on).format('MMM D, YYYY') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.last_reminder_sent_at
                            ? dayjs(customer.last_reminder_sent_at).format('MMM D, YYYY')
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.class}`}>
                            {status.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePause(customer, !customer.paused)}
                          >
                            {customer.paused ? (
                              <Play className="w-4 h-4" />
                            ) : (
                              <Pause className="w-4 h-4" />
                            )}
                          </Button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(customer)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openRenewDialog(customer)}
                          >
                            Renew
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, total)} of {total} customers
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Add Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>Add a new customer to the system</DialogDescription>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name
                </label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Email *
                </label>
                <Input
                  type="email"
                  required
                  value={formData.primary_email}
                  onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CC Emails (comma-separated)
                </label>
                <Input
                  value={formData.cc_emails}
                  onChange={(e) => setFormData({ ...formData, cc_emails: e.target.value })}
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Name
                </label>
                <Input
                  value={formData.plan_name}
                  onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Renew Link (URL)
                </label>
                <Input
                  type="url"
                  value={formData.renew_link}
                  onChange={(e) => setFormData({ ...formData, renew_link: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires On (YYYY-MM-DD) *
                </label>
                <Input
                  type="date"
                  required
                  value={formData.expires_on}
                  onChange={(e) => setFormData({ ...formData, expires_on: e.target.value })}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="paused"
                  checked={formData.paused}
                  onChange={(e) => setFormData({ ...formData, paused: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="paused" className="text-sm font-medium text-gray-700">
                  Paused
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Customer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update customer information</DialogDescription>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name
                </label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Email *
                </label>
                <Input
                  type="email"
                  required
                  value={formData.primary_email}
                  onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CC Emails (comma-separated)
                </label>
                <Input
                  value={formData.cc_emails}
                  onChange={(e) => setFormData({ ...formData, cc_emails: e.target.value })}
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Name
                </label>
                <Input
                  value={formData.plan_name}
                  onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Renew Link (URL)
                </label>
                <Input
                  type="url"
                  value={formData.renew_link}
                  onChange={(e) => setFormData({ ...formData, renew_link: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires On (YYYY-MM-DD) *
                </label>
                <Input
                  type="date"
                  required
                  value={formData.expires_on}
                  onChange={(e) => setFormData({ ...formData, expires_on: e.target.value })}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="paused-edit"
                  checked={formData.paused}
                  onChange={(e) => setFormData({ ...formData, paused: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="paused-edit" className="text-sm font-medium text-gray-700">
                  Paused
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Customer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Renew Dialog */}
        <Dialog open={showRenewDialog} onOpenChange={setShowRenewDialog}>
          <DialogContent>
            <DialogTitle>Renew Customer</DialogTitle>
            <DialogDescription>
              Renew {selectedCustomer?.company_name || selectedCustomer?.primary_email}
            </DialogDescription>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handleRenew('+6m')} variant="outline">
                  +6 Months
                </Button>
                <Button onClick={() => handleRenew('+12m')} variant="outline">
                  +12 Months
                </Button>
                <Button onClick={() => handleRenew('+24m')} variant="outline">
                  +24 Months
                </Button>
                <Button onClick={() => handleRenew('+1y')} variant="outline">
                  +1 Year
                </Button>
              </div>
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Date (YYYY-MM-DD)
                </label>
                <Input
                  type="date"
                  id="custom-date"
                  className="mb-2"
                />
                <Button
                  onClick={() => {
                    const dateInput = document.getElementById('custom-date') as HTMLInputElement;
                    if (dateInput?.value) {
                      handleRenewCustom(dateInput.value);
                    }
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Renew to Custom Date
                </Button>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowRenewDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-2xl">
            <DialogTitle>Import CSV</DialogTitle>
            <DialogDescription>
              Paste CSV data with headers: company_name, contact_name, primary_email, cc_emails, plan_name, renew_link, expires_on
            </DialogDescription>
            <form onSubmit={handleImport} className="space-y-4">
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="company_name,contact_name,primary_email,cc_emails,plan_name,renew_link,expires_on&#10;Acme,John Doe,john@acme.com,ops@acme.com,Pro,https://pay.example.com/acme,2025-11-12"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Import</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
