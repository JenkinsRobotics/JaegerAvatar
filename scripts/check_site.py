#!/usr/bin/env python3
"""Check the static site and maintained product-document links without dependencies."""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'docs'


class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.duplicates = set()
        self.references = []
        self.h1_count = 0
        self.has_title = False
        self.has_description = False
        self.missing_alt = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1':
            self.h1_count += 1
        if tag == 'title':
            self.has_title = True
        if tag == 'meta' and attrs.get('name') == 'description':
            self.has_description = bool(attrs.get('content'))
        if tag == 'img' and 'alt' not in attrs:
            self.missing_alt += 1
        if 'id' in attrs:
            identity = attrs['id']
            if identity in self.ids:
                self.duplicates.add(identity)
            self.ids.add(identity)
        for attr in ('href', 'src'):
            if attr in attrs:
                self.references.append(attrs[attr])


def local_target(source, value):
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return None
    return source.parent / unquote(parsed.path) if parsed.path else source


def main():
    errors = []
    html_file = SITE / 'index.html'
    html = html_file.read_text()
    parser = SiteParser()
    parser.feed(html)
    if re.search(r'\{\{[A-Z_]+\}\}', html):
        errors.append('Unresolved template placeholder in public website')
    if not parser.has_title or not parser.has_description or parser.h1_count != 1:
        errors.append('Website needs a title, description and one main heading')
    if parser.duplicates:
        errors.append(f'Duplicate HTML IDs: {sorted(parser.duplicates)}')
    if parser.missing_alt:
        errors.append('Image missing alt attribute')
    for value in parser.references:
        target = local_target(html_file, value)
        if target is None:
            continue
        if not target.exists():
            errors.append(f'Missing website target: {value}')
        parsed = urlsplit(value)
        if target.resolve() == html_file.resolve() and parsed.fragment not in parser.ids and parsed.fragment:
            errors.append(f'Missing website anchor: {value}')
    maintained = [ROOT / 'README.md', ROOT / 'AGENTS.md', SITE / 'SITE.md']
    maintained.extend((ROOT / 'dev/docs').rglob('*.md'))
    maintained.extend((ROOT / 'avatar-packs').glob('README.md'))
    maintained.extend((ROOT / 'avatar-packs').glob('*/README.md'))
    for source in maintained:
        text = source.read_text()
        if re.search(r'\{\{(?:REPO_NAME|DESCRIPTION|DATE)\}\}', text):
            errors.append(f'Unresolved product template field: {source.relative_to(ROOT)}')
        for value in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
            target = local_target(source, value)
            if target is not None and not target.exists():
                errors.append(f'Missing document target: {source.relative_to(ROOT)} → {value}')
    if not (SITE / '.nojekyll').is_file():
        errors.append('Missing docs/.nojekyll for static branch deployment')
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'Site metadata, IDs, assets, anchors and {len(maintained)} document link sets checked.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
