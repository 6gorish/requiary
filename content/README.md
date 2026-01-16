# Content Management

> **Note:** The `site-metadata.json` and `navigation.json` files in this directory are future CMS infrastructure and are not currently implemented in the application. The navigation in `app/layout.tsx` and metadata in page files are currently hardcoded. These JSON files serve as documentation and will be integrated in a future update.

This directory contains all editable website copy. Update content here without touching code.

## Structure

```
content/
├── home.md             # Homepage content
├── about.md            # About page content
├── participate.md      # Submission page content
├── site-metadata.json  # SEO, site title, contact info
└── navigation.json     # Menu structure
```

---

## How to Update Content

### Page Copy (Markdown Files)

**Files**: `*.md`

Each markdown file has two parts:

1. **Frontmatter** (between `---`): Metadata like title, description
2. **Content**: The actual copy using markdown formatting

**Example**:
```markdown
---
title: "About Requiary"
description: "A contemplative space for collective witness..."
---

# The Heart of the Wise

Content goes here...
```

**To update**:
1. Open the `.md` file
2. Edit the text
3. Save the file
4. Commit to git
5. Push to GitHub
6. Vercel auto-deploys the changes

**Markdown formatting**:
- `# Heading` - Large heading
- `## Subheading` - Smaller heading
- `**bold**` - Bold text
- `*italic*` - Italic text
- `[Link text](url)` - Hyperlink
- Blank line = new paragraph

---

### Site Metadata (JSON)

**File**: `site-metadata.json`

Contains:
- Site title and description (for SEO)
- Contact information
- Social media links
- Analytics settings

**To update**:
1. Open `site-metadata.json`
2. Find the key you want to change
3. Update the value (keep quotes for text)
4. Save and commit

---

### Navigation (JSON)

**File**: `navigation.json`

Controls the main menu and footer links.

**To add a page**:
```json
{
  "label": "Archive",
  "href": "/archive",
  "order": 6
}
```

**To highlight a link** (like "Share Your Grief"):
```json
{
  "label": "Share Your Grief",
  "href": "/participate",
  "highlight": true
}
```

---

## Workflow

### Making Changes

1. **Edit locally** using any text editor
2. **Preview** by running `npm run dev`
3. **Commit** changes to git
4. **Push** to GitHub
5. **Deploy** happens automatically via Vercel

### Version Control

Git tracks all changes:
- See who changed what and when
- Revert mistakes easily
- Work on changes without affecting live site

---

## Tips

### Markdown Best Practices

**DO**:
- Use blank lines between paragraphs
- Use descriptive headings
- Keep lines under 100 characters for readability

**DON'T**:
- Mix heading levels (#, ##, ###)
- Use HTML in markdown (unless necessary)
- Forget the frontmatter `---` delimiters

### JSON Best Practices

**DO**:
- Keep formatting consistent (use 2-space indent)
- Use quotes around text values
- Check for syntax errors (trailing commas, missing brackets)

**DON'T**:
- Add comments (JSON doesn't support them)
- Use single quotes (must be double quotes)
- Forget commas between items

---

## Validation

Before committing changes:

1. **Markdown files**: Open in preview mode to check formatting
2. **JSON files**: Use a JSON validator (jsonlint.com)
3. **Links**: Verify all URLs are correct
