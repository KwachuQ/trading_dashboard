import { useState, useMemo } from 'react';
import { Search, X, CheckSquare, Square } from 'lucide-react';

/**
 * TagFilter component for selecting multiple tags with search functionality
 * @param {Array} allTags - Array of all available tag strings
 * @param {Array} selectedTags - Array of currently selected tag strings
 * @param {Function} onTagsChange - Callback when tag selection changes
 * @param {Object} tagColors - Map of tag names to color hex codes
 */
const TagFilter = ({ allTags = [], selectedTags = [], onTagsChange, tagColors = {} }) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter tags based on search query
    const filteredTags = useMemo(() => {
        if (!searchQuery.trim()) return allTags;
        const query = searchQuery.toLowerCase();
        return allTags.filter(tag => tag.toLowerCase().includes(query));
    }, [allTags, searchQuery]);

    const handleToggleTag = (tag) => {
        if (selectedTags.includes(tag)) {
            onTagsChange(selectedTags.filter(t => t !== tag));
        } else {
            onTagsChange([...selectedTags, tag]);
        }
    };

    const handleSelectAll = () => {
        onTagsChange([...allTags]);
    };

    const handleClearAll = () => {
        onTagsChange([]);
    };

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Filter by Tags</h3>
                <div className="flex gap-2">
                    <button
                        onClick={handleSelectAll}
                        className="text-xs px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                    >
                        Select All
                    </button>
                    <button
                        onClick={handleClearAll}
                        className="text-xs px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                    >
                        Clear All
                    </button>
                </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <input
                    type="text"
                    placeholder="Search tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg outline-none focus:border-accent transition-all text-sm"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Selected Tags Summary */}
            {selectedTags.length > 0 && (
                <div className="mb-4 p-3 bg-accent/10 border border-accent/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-accent uppercase tracking-wider">
                            Active Filters ({selectedTags.length})
                        </span>
                        <button
                            onClick={handleClearAll}
                            className="text-xs text-accent hover:text-accent/80 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedTags.map(tag => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
                                style={{
                                    backgroundColor: (tagColors[tag] || '#64748b') + '20',
                                    color: tagColors[tag] || '#94a3b8',
                                    border: `1px solid ${tagColors[tag] || '#94a3b8'}40`
                                }}
                            >
                                {tag}
                                <button
                                    onClick={() => handleToggleTag(tag)}
                                    className="hover:opacity-70 transition-opacity"
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Tag List */}
            <div className="max-h-[400px] overflow-y-auto space-y-1">
                {filteredTags.length === 0 ? (
                    <div className="text-center py-8 text-secondary text-sm">
                        {searchQuery ? 'No tags match your search' : 'No tags available'}
                    </div>
                ) : (
                    filteredTags.map(tag => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                            <button
                                key={tag}
                                onClick={() => handleToggleTag(tag)}
                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all group"
                            >
                                <div className={`${isSelected ? 'text-accent' : 'text-secondary/50'} transition-colors`}>
                                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                </div>
                                <span
                                    className="flex-1 text-left px-3 py-1.5 rounded-md font-semibold text-sm"
                                    style={{
                                        backgroundColor: (tagColors[tag] || '#64748b') + '20',
                                        color: tagColors[tag] || '#94a3b8',
                                        border: `1px solid ${tagColors[tag] || '#94a3b8'}40`
                                    }}
                                >
                                    {tag}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default TagFilter;
