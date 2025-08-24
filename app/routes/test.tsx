export function meta() {
  return [
    { title: 'Test - Tsukkomi V2' },
    { name: 'description', content: 'Test route working' },
  ];
}

export default function TestRoute() {
  return (
    <div className="p-4 space-y-2">
      <h1 className="text-xl font-semibold">Test Route</h1>
      <p className="text-sm text-gray-500">File-based routing is active.</p>
    </div>
  );
}
