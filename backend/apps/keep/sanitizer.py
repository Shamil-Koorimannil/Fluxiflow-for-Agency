import re
from html.parser import HTMLParser

class SafeHTMLCleaner(HTMLParser):
    ALLOWED_TAGS = {
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'b', 'strong',
        'i', 'em', 'u', 's', 'strike', 'ul', 'ol', 'li', 'blockquote', 'pre',
        'code', 'hr', 'br', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'input', 'font', 'mark'
    }

    ALLOWED_ATTRS = {
        'a': {'href', 'title', 'target', 'rel'},
        'span': {'style', 'class'},
        'p': {'style', 'class', 'align'},
        'div': {'style', 'class', 'align'},
        'h1': {'style', 'class', 'align'},
        'h2': {'style', 'class', 'align'},
        'h3': {'style', 'class', 'align'},
        'table': {'style', 'class', 'border', 'cellpadding', 'cellspacing'},
        'td': {'colspan', 'rowspan', 'style', 'class'},
        'th': {'colspan', 'rowspan', 'style', 'class'},
        'input': {'type', 'checked', 'disabled'},
        'font': {'color', 'size', 'style', 'class'},
        'mark': {'style', 'class'},
    }

    def __init__(self):
        super().__init__()
        self.result = []

    def handle_starttag(self, tag, attrs):
        tag_lower = tag.lower()
        if tag_lower not in self.ALLOWED_TAGS:
            return

        clean_attrs = []
        allowed_attrs_for_tag = self.ALLOWED_ATTRS.get(tag_lower, set())

        for attr, value in attrs:
            attr_lower = attr.lower()
            # Strip all inline event handlers (e.g. onclick, onerror, onload)
            if attr_lower.startswith('on'):
                continue
            if attr_lower not in allowed_attrs_for_tag:
                continue

            # Strip javascript: URLs
            if attr_lower in ('href', 'src'):
                val_lower = value.strip().lower()
                if val_lower.startswith(('javascript:', 'data:', 'vbscript:')):
                    continue

            clean_attrs.append(f'{attr}="{value}"')

        attr_str = ' ' + ' '.join(clean_attrs) if clean_attrs else ''
        if tag_lower in ('br', 'hr', 'input'):
            self.result.append(f'<{tag_lower}{attr_str} />')
        else:
            self.result.append(f'<{tag_lower}{attr_str}>')

    def handle_endtag(self, tag):
        tag_lower = tag.lower()
        if tag_lower in self.ALLOWED_TAGS and tag_lower not in ('br', 'hr', 'input'):
            self.result.append(f'</{tag_lower}>')

    def handle_data(self, data):
        self.result.append(data)


def sanitize_html(raw_html: str) -> str:
    if not raw_html:
        return ''
    
    # Strip script blocks and comments using regex first
    cleaned = re.sub(r'<script[^>]*>.*?</script>', '', raw_html, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r'<style[^>]*>.*?</style>', '', cleaned, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r'<!--.*?-->', '', cleaned, flags=re.DOTALL)

    parser = SafeHTMLCleaner()
    parser.feed(cleaned)
    return ''.join(parser.result)
