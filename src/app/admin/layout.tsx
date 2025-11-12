import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminGate } from './admin-gate';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const adminOk = cookieStore.get('admin_ok')?.value === '1';

  if (!adminOk) {
    return <AdminGate />;
  }

  return <>{children}</>;
}

