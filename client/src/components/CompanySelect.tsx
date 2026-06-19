import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

const COMPANIES = [
    'Google', 'Microsoft', 'Amazon', 'Apple', 'Meta', 'Netflix', 'Adobe', 'Salesforce',
    'Oracle', 'IBM', 'Intel', 'NVIDIA', 'Uber', 'Airbnb', 'Spotify', 'LinkedIn',
    'Zoho', 'Infosys', 'TCS', 'Wipro', 'Accenture', 'Cognizant', 'HCLTech', 'Capgemini',
    'Flipkart', 'Swiggy', 'Zomato', 'Paytm', 'Freshworks', 'Atlassian', 'Stripe', 'ServiceNow',
];

interface CompanySelectProps {
    value: string;
    onChange: (value: string) => void;
}

export default function CompanySelect({ value, onChange }: CompanySelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filtered = COMPANIES.filter((c) => c.toLowerCase().includes(search.toLowerCase()));
    const exactMatch = filtered.some((c) => c.toLowerCase() === search.trim().toLowerCase());

    const select = (c: string) => {
        onChange(c);
        setOpen(false);
        setSearch('');
    };

    return (
        <div ref={boxRef} className="relative">
            <label className="block text-sm font-medium mb-1.5">
                Target Company <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <button
                type="button"
                onClick={() => { setOpen((v) => !v); setSearch(''); }}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
            >
                <span className={value ? 'font-medium' : 'text-muted-foreground'}>
                    {value || 'Select a company...'}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-20 mt-2 w-full rounded-lg border border-border bg-card shadow-2xl overflow-hidden">
                    <input
                        autoFocus
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="w-full px-4 py-2.5 text-sm border-b border-border bg-background focus:outline-none"
                    />
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => select(c)}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition"
                            >
                                {c}
                            </button>
                        ))}
                        {search.trim() && !exactMatch && (
                            <button
                                type="button"
                                onClick={() => select(search.trim())}
                                className="w-full text-left px-4 py-2.5 text-sm text-primary font-medium hover:bg-muted transition border-t border-border"
                            >
                                Use &quot;{search.trim()}&quot;
                            </button>
                        )}
                        {filtered.length === 0 && !search.trim() && (
                            <div className="px-4 py-3 text-sm text-muted-foreground">Start typing to search…</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}