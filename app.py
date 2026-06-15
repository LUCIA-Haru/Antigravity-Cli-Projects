import os
import xml.etree.ElementTree as ET
import time
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_EXPIRY = 300  # Cache feed data for 5 minutes
feed_cache = {
    "data": None,
    "last_updated": 0
}

def parse_xml_feed(xml_content):
    """Parses the BigQuery release notes Atom feed XML."""
    root = ET.fromstring(xml_content)
    # The feed uses the Atom namespace
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    entries = []
    for entry in root.findall("atom:entry", ns):
        title_elem = entry.find("atom:title", ns)
        id_elem = entry.find("atom:id", ns)
        updated_elem = entry.find("atom:updated", ns)
        content_elem = entry.find("atom:content", ns)
        
        # Extract alternate link
        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        link = link_elem.attrib.get("href") if link_elem is not None else ""
        if not link:
            link_elem = entry.find("atom:link", ns)
            link = link_elem.attrib.get("href") if link_elem is not None else ""

        title = title_elem.text if title_elem is not None else ""
        entry_id = id_elem.text if id_elem is not None else ""
        updated = updated_elem.text if updated_elem is not None else ""
        content = content_elem.text if content_elem is not None else ""
        
        entries.append({
            "title": title,
            "id": entry_id,
            "updated": updated,
            "link": link,
            "content": content
        })
    return entries

def fetch_feed_data(force_refresh=False):
    """Fetches the feed from Google docs feed endpoint with caching."""
    now = time.time()
    if force_refresh or not feed_cache["data"] or (now - feed_cache["last_updated"] > CACHE_EXPIRY):
        try:
            # 10s timeout to keep app responsive
            response = requests.get(FEED_URL, timeout=10)
            response.raise_for_status()
            parsed_data = parse_xml_feed(response.content)
            feed_cache["data"] = parsed_data
            feed_cache["last_updated"] = now
            return parsed_data, None
        except Exception as e:
            # If fetch fails, return cached data if available, along with the error
            if feed_cache["data"]:
                return feed_cache["data"], f"Could not refresh: {str(e)}. Using cached data."
            return None, f"Failed to fetch feed: {str(e)}"
    return feed_cache["data"], None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/releases")
def get_releases():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    releases, error = fetch_feed_data(force_refresh=force_refresh)
    
    if releases is None:
        return jsonify({"success": False, "error": error}), 500
        
    return jsonify({
        "success": True,
        "releases": releases,
        "warning": error,
        "cached_at": feed_cache["last_updated"]
    })

if __name__ == "__main__":
    # Bind to 127.0.0.1 and use port 5000
    app.run(host="127.0.0.1", port=5000, debug=True)
