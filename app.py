import os
import re
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Simple in-memory cache to avoid rate-limiting and speed up response times
FEED_CACHE = {
    "data": None,
    "last_fetched": None
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
ATOM_NS = {'atom': 'http://www.w3.org/2005/Atom'}

def clean_html_to_plain_text(html_content):
    """
    Converts HTML release note body to clean plain text for tweeting,
    removing tags and consolidating spacing.
    """
    if not html_content:
        return ""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', html_content)
    # Consolidate whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def fetch_and_parse_release_notes():
    """
    Fetches the BigQuery release notes XML feed and parses it into a structured JSON-like format.
    """
    try:
        response = requests.get(FEED_URL, timeout=10)
        if response.status_code != 200:
            return {"error": f"Failed to retrieve feed: HTTP {response.status_code}"}, 500
        
        xml_content = response.content
        root = ET.fromstring(xml_content)
        
        parsed_entries = []
        entries = root.findall('atom:entry', ATOM_NS)
        
        for entry in entries:
            title = entry.find('atom:title', ATOM_NS).text if entry.find('atom:title', ATOM_NS) is not None else "Unknown Date"
            entry_id = entry.find('atom:id', ATOM_NS).text if entry.find('atom:id', ATOM_NS) is not None else ""
            updated = entry.find('atom:updated', ATOM_NS).text if entry.find('atom:updated', ATOM_NS) is not None else ""
            
            link_elem = entry.find('atom:link', ATOM_NS)
            link = link_elem.attrib.get('href') if link_elem is not None else "https://docs.cloud.google.com/bigquery/docs/release-notes"
            
            content_elem = entry.find('atom:content', ATOM_NS)
            content_html = content_elem.text if content_elem is not None else ""
            
            # Split the content by H3 tags to extract individual updates (Feature, Issue, Announcement, etc.)
            # The XML content looks like:
            # <h3>Feature</h3><p>...</p><h3>Announcement</h3><p>...</p>
            updates = []
            if content_html:
                parts = re.split(r'(?i)<h3>(.*?)</h3>', content_html)
                # If there's content before any H3, it will be in parts[0]
                preamble = parts[0].strip()
                if preamble and not preamble.startswith('\n'):
                    # Preamble without a specific header
                    plain = clean_html_to_plain_text(preamble)
                    updates.append({
                        "id": f"{entry_id}_preamble",
                        "type": "General",
                        "html": preamble,
                        "plain_text": plain
                    })
                
                # Iterate over the pairs of (header, body)
                update_index = 0
                for idx in range(1, len(parts), 2):
                    header = parts[idx].strip()
                    body = parts[idx+1].strip() if idx + 1 < len(parts) else ""
                    
                    plain = clean_html_to_plain_text(body)
                    updates.append({
                        "id": f"{entry_id}_{update_index}",
                        "type": header,
                        "html": body,
                        "plain_text": plain
                    })
                    update_index += 1
            
            parsed_entries.append({
                "id": entry_id,
                "date": title,
                "updated": updated,
                "link": link,
                "updates": updates
            })
            
        return parsed_entries, 200
        
    except ET.ParseError as pe:
        return {"error": f"XML parsing error: {str(pe)}"}, 500
    except requests.RequestException as re_err:
        return {"error": f"Network error fetching feed: {str(re_err)}"}, 500
    except Exception as e:
        return {"error": f"An unexpected error occurred: {str(e)}"}, 500

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    # Return from cache if available and not forcing refresh
    if not force_refresh and FEED_CACHE["data"] is not None:
        return jsonify({
            "source": "cache",
            "data": FEED_CACHE["data"]
        })
        
    data, status = fetch_and_parse_release_notes()
    if status == 200:
        FEED_CACHE["data"] = data
        return jsonify({
            "source": "network",
            "data": data
        })
    else:
        # If network fetch failed but we have cached data, fall back to cache
        if FEED_CACHE["data"] is not None:
            return jsonify({
                "source": "stale_cache",
                "warning": "Network fetch failed; returning cached data.",
                "data": FEED_CACHE["data"]
            })
        return jsonify(data), status

if __name__ == '__main__':
    # Run server locally
    app.run(host='127.0.0.1', port=5000, debug=True)
