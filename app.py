import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    try:
        # Create request with User-Agent to avoid potential blocking
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        entries = root.findall('atom:entry', namespaces)
        
        notes = []
        for entry in entries:
            title_el = entry.find('atom:title', namespaces)
            updated_el = entry.find('atom:updated', namespaces)
            content_el = entry.find('atom:content', namespaces)
            id_el = entry.find('atom:id', namespaces)
            
            # Find link href
            link_el = entry.find("atom:link[@rel='alternate']", namespaces)
            if link_el is None:
                link_el = entry.find("atom:link", namespaces)
            
            link = ""
            if link_el is not None:
                link = link_el.attrib.get('href', '')
            else:
                # Fallback link using Google Cloud documentation base
                link = "https://cloud.google.com/bigquery/docs/release-notes"
                
            title = title_el.text if title_el is not None else ""
            updated = updated_el.text if updated_el is not None else ""
            content = content_el.text if content_el is not None else ""
            entry_id = id_el.text if id_el is not None else ""
            
            notes.append({
                "id": entry_id,
                "title": title,
                "updated": updated,
                "content": content,
                "link": link
            })
            
        return jsonify({"success": True, "data": notes})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
