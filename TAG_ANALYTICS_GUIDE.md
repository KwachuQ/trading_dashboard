# Tag Analytics - User Guide

## Quick Start

### 1. Upload Your Trading Data
- Click **"Upload New File"** button
- Select your CSV file with trading data
- Wait for processing to complete

### 2. Tag Your Trades
Navigate to the **"Trades Table"** tab:
- Click the **+ button** next to any trade's tag column
- Type a tag name (e.g., "Breakout", "Morning Session")
- Press **Enter** to add
- Add up to 5 tags per trade per column
- Tags autocomplete from existing tags

**Pro Tips:**
- Use **Setup Tag** for strategy types (Breakout, Reversal, etc.)
- Use **Additional Tag** for context (Time of day, Market conditions, etc.)
- Click the **color circle** next to any tag to customize its color
- Click the **X** to remove a tag

### 3. Analyze by Tags
Navigate to the **"Tag Analytics"** tab:

#### Filter Trades
1. **Search** for tags using the search box
2. **Click checkboxes** to select tags you want to analyze
3. **Choose filter mode**: Click AND or OR button
   - **AND mode**: Shows trades with ALL selected tags
   - **OR mode**: Shows trades with ANY selected tag
4. **View statistics** for filtered trades

#### Active Filters
- Selected tags appear in the **blue chip summary** at the top
- Click the **X** on any chip to remove that filter
- Click **"Clear All"** to reset all filters

#### Statistics Display
The page shows **16 key performance indicators** for your filtered trades:

**Row 1: Overview**
- Total PnL
- Total Trades
- Total Fees
- Profit Factor (with gauge)

**Row 2: Averages**
- Avg Win
- Avg Loss
- Win/Loss Ratio
- Expected Value

**Row 3: Records**
- Best Trade
- Worst Trade
- Win Rate (with gauge)
- Long/Short % (color-coded)

**Row 4: Duration**
- Avg Win Duration
- Avg Loss Duration
- Avg Duration
- Avg PnL per Trade

---

## Use Cases

### Example 1: Analyze Your Best Strategy
**Goal**: Find which setup performs best

1. Go to **Tag Analytics**
2. Select tag: "Breakout"
3. Review statistics
4. Note the Win Rate and Profit Factor
5. Compare with other setups (select "Reversal" instead)

### Example 2: Morning vs Afternoon Performance
**Goal**: Compare performance by time of day

1. Tag trades with "Morning" or "Afternoon" in **Trades Table**
2. Go to **Tag Analytics**
3. Select "Morning" → Review stats
4. Clear, then select "Afternoon" → Compare

### Example 3: Multi-Tag Analysis
**Goal**: Analyze specific strategy in specific conditions

1. Go to **Tag Analytics**
2. Select multiple tags: "Breakout" + "High Volume"
3. View stats for trades that have BOTH tags
4. This helps identify your edge in specific scenarios

---

## Filter Logic: AND vs OR

You can switch between two filtering modes using the toggle button:

### AND Mode (Default)
Shows trades that have **ALL** selected tags.

**Example:**
- You have 100 trades total
- 50 trades tagged "Breakout"
- 30 trades tagged "Morning"
- 15 trades tagged BOTH "Breakout" AND "Morning"

**Result when selecting both tags in AND mode**: 15 trades (only those with both tags)

### OR Mode
Shows trades that have **ANY** of the selected tags.

**Example (same data as above):**
- 50 trades tagged "Breakout"
- 30 trades tagged "Morning"
- 15 trades tagged BOTH

**Result when selecting both tags in OR mode**: 65 trades (50 + 30 - 15 overlap)

### When to Use Each Mode

**Use AND mode when:**
- You want to find specific combinations (e.g., "Breakout" + "High Volume")
- You're analyzing a narrow, specific scenario
- You want to see your edge in particular conditions

**Use OR mode when:**
- You want to compare multiple strategies together
- You're looking at broader categories
- You want to see total performance across related tags

---

## Data Persistence

### What Gets Saved?
- ✅ **Tag selections** in Tag Analytics (saved to browser localStorage)
- ✅ **Filter mode** (AND/OR) (saved to browser localStorage)
- ✅ **Tag colors** (saved in app state)
- ✅ **Trade tags** (saved in app state)

### What Doesn't Persist?
- ❌ Tags are NOT saved when you close the browser (unless you export CSV)
- ❌ Uploading a new CSV resets all tags

### How to Save Tags Permanently?
1. Go to **Trades Table**
2. Click **"Export CSV"** button
3. Save the file with your tags included
4. Re-upload this file next time to restore your tags

---

## Keyboard Shortcuts

### In Trades Table (Tag Editing)
- **Enter** - Add tag
- **Escape** - Cancel tag editing
- **Tab** - Navigate between fields

### In Tag Analytics (Filter Panel)
- **Type** in search box to filter tags
- **Click** checkboxes to select/deselect

---

## Performance Tips

### For Large Datasets (1000+ trades)
- The system is optimized for <100ms response time
- Tag operations are debounced and memoized
- Filtering happens instantly with no lag

### Best Practices
1. **Use consistent tag names** (avoid "breakout" vs "Breakout")
2. **Limit to 3-5 tags per trade** for clarity
3. **Use colors** to visually group related tags
4. **Export regularly** to save your tagging work

---

## Troubleshooting

### "No Matching Trades" Message
**Cause**: No trades match the current filter criteria

**Solution**:
- **In AND mode**: Remove some tags to broaden the filter, or switch to OR mode
- **In OR mode**: Try different tags or switch to AND mode
- Check if you've tagged trades with those exact tag names
- Use the search box to verify tag names

### Tags Not Appearing in Filter
**Cause**: Tags must be added to trades first

**Solution**:
1. Go to **Trades Table**
2. Add tags to your trades
3. Return to **Tag Analytics**
4. Tags will now appear in the filter panel

### Selected Tags Disappeared After Refresh
**Cause**: This is expected behavior for security

**Solution**:
- Your tag selections are saved in localStorage
- They should persist across page refreshes
- If they don't, check browser privacy settings (localStorage must be enabled)

---

## Advanced Features

### Color Coding
- Click the **color circle** next to any tag
- Choose from 10 preset colors
- Colors apply globally across all views
- Use colors to categorize tags visually

### Undo/Redo
- Available in **Trades Table**
- Click the **↶** (undo) or **↷** (redo) buttons
- Tracks all tag additions, removals, and edits

### Merge Trades
- Select multiple trades (checkboxes)
- Click **"Merge"** button
- Tags from all trades are combined
- Useful for analyzing multi-leg positions

---

## FAQ

**Q: Can I filter by "Tag A OR Tag B" instead of AND?**
A: Yes! Use the AND/OR toggle button at the top of the Tag Analytics page. Click "OR" to show trades with ANY selected tag.

**Q: How many tags can I select at once?**
A: Unlimited! Select as many as needed. Use AND mode for specific combinations or OR mode for broader analysis.

**Q: Can I edit tags in the Tag Analytics page?**
A: No, tag editing is only available in the Trades Table. Tag Analytics is read-only for analysis.

**Q: Do tags affect the main Stats Overview page?**
A: No, the Stats Overview shows all trades. Use Tag Analytics for filtered views.

**Q: Can I export filtered data?**
A: Not directly from Tag Analytics. Export from Trades Table includes all trades with tags.

---

## Support

For issues or feature requests, refer to the main README.md file.

**Enjoy analyzing your trading performance!** 📊
