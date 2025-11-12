export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <main className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Renewal Reminders
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Manage customer renewals and send automated reminders
        </p>
        <a
          href="/admin"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Admin Dashboard
        </a>
      </main>
    </div>
  );
}
