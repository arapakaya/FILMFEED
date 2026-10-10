export default function SearchBar({ 
  value, 
  onChange 
}: { 
  value: string
  onChange: (value: string) => void 
}) {
  return (
    <div className="mb-8">
      <input
        type="text"
        placeholder="Search for movies..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-6 py-4 search-bar rounded-lg border border-gray-700 focus:border-primary focus:outline-none text-white placeholder-gray-400"
      />
    </div>
  )
}
