from flask import Flask, render_template, request, send_file, jsonify
from flask_cors import CORS  # You'll need to install this: pip install flask-cors
import pandas as pd
from io import BytesIO
import concurrent.futures
import functools
import time
import random
import logging
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import quote_plus, parse_qs, urlparse
import backoff
import json



# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Enable CORS for all routes - adjust origin if needed
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://192.168.27.96:3000"]}})

# Global variable to store processed data
processed_data = None

# Simple cache to avoid duplicate searches
faculty_cache = {}
CACHE_TIMEOUT = 3600  # Cache timeout in seconds (1 hour)

# User agent rotation list
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
]

# Session management
def get_session():
    """Create a new session with randomized user agent"""
    session = requests.Session()
    session.headers.update({
        'User-Agent': random.choice(USER_AGENTS),
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Referer': 'https://scholar.google.com/'
    })
    return session

def retry_on_error(max_retries=3, delay=2):
    """Decorator to retry functions on error with exponential backoff"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            retries = 0
            while retries < max_retries:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    retries += 1
                    wait_time = delay * (2 ** retries) + random.uniform(0, 1)
                    logger.warning(f"Error in {func.__name__}: {e}. Retrying in {wait_time:.2f}s ({retries}/{max_retries})")
                    time.sleep(wait_time)
            
            # If we get here, all retries failed
            logger.error(f"All retries failed for {func.__name__}")
            return None, None
        return wrapper
    return decorator

def cache_result(func):
    @functools.wraps(func)
    def wrapper(name, institution=None):
        cache_key = f"{name}:{institution}"
        current_time = time.time()
        
        # Check if result exists in cache and is not expired
        if cache_key in faculty_cache:
            cache_time, profile, df = faculty_cache[cache_key]
            if current_time - cache_time < CACHE_TIMEOUT:
                logger.info(f"Cache hit for {name}")
                return profile, df
        
        # Call the original function if not in cache or expired
        profile, df = func(name, institution)
        
        # Cache the result with current timestamp
        if profile and df is not None and not df.empty:
            faculty_cache[cache_key] = (current_time, profile, df)
            logger.info(f"Cached result for {name}")
        
        return profile, df
    return wrapper

@backoff.on_exception(backoff.expo, 
                     (requests.exceptions.RequestException, requests.exceptions.HTTPError),
                     max_tries=3)
def fetch_url(url, session=None):
    """Fetch URL with backoff and random delays to avoid detection"""
    if session is None:
        session = get_session()
    
    # Add random delay to mimic human behavior
    time.sleep(random.uniform(1, 3))
    
    response = session.get(url, timeout=15)
    response.raise_for_status()
    return response.text

@retry_on_error(max_retries=3, delay=2)
def fetch_author(name, institution=None):
    """Fetch author profile using custom scraping, with fallback to name-only search if institution match fails"""
    try:
        # First attempt: search with name and institution
        if institution:
            search_query = quote_plus(f"{name} {institution}")
            url = f"https://scholar.google.com/citations?view_op=search_authors&mauthors={search_query}&hl=en"
            
            logger.info(f"Searching for author: '{name}' with institution: '{institution}'")
            logger.info(f"Search URL: {url}")
            
            session = get_session()
            html = fetch_url(url, session)
            soup = BeautifulSoup(html, 'html.parser')
            
            # Find all author results
            author_elements = soup.select('.gsc_1usr')
            
            # If we found results with institution, process them
            if author_elements:
                logger.info(f"Found {len(author_elements)} potential authors for '{name}' with institution")
                
                # Select author with institution match
                selected_author = select_best_author_match(author_elements, name, institution)
                
                if selected_author:
                    logger.info(f"Selected author with institution match: {selected_author['name']}")
                    # Continue with existing code to fetch profile
                    return get_author_profile(selected_author, session)
            
            # If we reach here, no suitable match was found with institution
            logger.warning(f"No suitable author found for {name} with institution {institution}. Trying name-only search...")
        
        # Second attempt: search with name only
        search_query = quote_plus(f"{name}")
        url = f"https://scholar.google.com/citations?view_op=search_authors&mauthors={search_query}&hl=en"
        
        logger.info(f"Searching for author using name only: '{name}'")
        logger.info(f"Search URL: {url}")
        
        session = get_session()
        html = fetch_url(url, session)
        soup = BeautifulSoup(html, 'html.parser')
        
        # Find all author results
        author_elements = soup.select('.gsc_1usr')
        
        if not author_elements:
            logger.warning(f"No author results found for {name}")
            return None
        
        logger.info(f"Found {len(author_elements)} potential authors for '{name}' (name-only search)")
        
        # Select the most relevant author
        selected_author = select_best_author_match(author_elements, name, None)
        
        if not selected_author:
            logger.warning(f"No suitable author found for {name}")
            return None
            
        # Log the selected author
        logger.info(f"Final selection for '{name}': {selected_author['name']} from {selected_author['affiliation']} (name-only search)")
        
        return get_author_profile(selected_author, session)
        
    except Exception as e:
        logger.error(f"Error fetching author {name}: {e}")
        raise

def select_best_author_match(author_elements, name, institution=None):
    """Helper function to select the best author match from a list of author elements"""
    selected_author = None
    
    for i, author in enumerate(author_elements[:5]):  # Check top 5 results
        # Extract author information
        author_name_elem = author.select_one('.gs_ai_name a')
        if not author_name_elem:
            continue
            
        author_name = author_name_elem.text.strip()
        author_id = re.search(r'user=([^&]+)', author_name_elem['href']).group(1) if 'href' in author_name_elem.attrs else None
        
        if not author_id:
            continue
            
        # Extract affiliation
        affiliation_elem = author.select_one('.gs_ai_aff')
        affiliation = affiliation_elem.text.strip() if affiliation_elem else "N/A"
        
        logger.info(f"Candidate {i+1}: {author_name} from {affiliation}")
        
        # Institution matching if provided
        if institution:
            # Try various matching approaches
            inst_words = institution.lower().split()
            affiliation_lower = affiliation.lower()
            
            # Check if any significant words from institution match
            match_score = sum(1 for word in inst_words if len(word) > 2 and word in affiliation_lower)
            match_percentage = match_score / len(inst_words) if inst_words else 0
            
            logger.info(f"Institution match score: {match_score}/{len(inst_words)} ({match_percentage:.2%})")
            
            if match_percentage > 0.3:  # If more than 30% of words match
                selected_author = {
                    'name': author_name,
                    'id': author_id,
                    'affiliation': affiliation,
                    'match_quality': match_percentage
                }
                logger.info(f"Selected author with institution match: {author_name}")
                break
        
        # If no selection yet, use this one
        if selected_author is None:
            selected_author = {
                'name': author_name,
                'id': author_id,
                'affiliation': affiliation,
                'match_quality': 0
            }
    
    return selected_author

def get_author_profile(selected_author, session):
    """Helper function to get detailed author profile"""
    # Fetch the author's profile page to get more details
    author_url = f"https://scholar.google.com/citations?user={selected_author['id']}&hl=en"
    profile_html = fetch_url(author_url, session)
    profile_soup = BeautifulSoup(profile_html, 'html.parser')
    
    # Extract h-index and i10-index
    h_index = "N/A"
    i10_index = "N/A"
    
    index_elements = profile_soup.select('td.gsc_rsb_std')
    if len(index_elements) >= 2:
        h_index = index_elements[2].text.strip()
        i10_index = index_elements[4].text.strip()
    
    # Extract photo URL
    photo_elem = profile_soup.select_one('#gsc_prf_pup-img')
    photo_url = photo_elem['src'] if photo_elem and 'src' in photo_elem.attrs else ""
    
    # Complete author profile
    author_profile = {
        'name': selected_author['name'],
        'id': selected_author['id'],
        'affiliation': selected_author['affiliation'],
        'h_index': h_index,
        'i10_index': i10_index,
        'photo': photo_url
    }
    
    return author_profile

def extract_publications_from_html(html):
    """Extract publication information from HTML page"""
    publications = []
    soup = BeautifulSoup(html, 'html.parser')
    
    # Find all publication rows
    pub_elements = soup.select('tr.gsc_a_tr')
    
    for pub in pub_elements:
        try:
            # Extract publication title
            title_elem = pub.select_one('.gsc_a_t a')
            if not title_elem:
                continue
            title = title_elem.text.strip()
            
            # Extract authors and venue
            authors_venue_elem = pub.select('.gsc_a_t .gs_gray')
            authors = authors_venue_elem[0].text.strip() if len(authors_venue_elem) > 0 else "N/A"
            venue = authors_venue_elem[1].text.strip() if len(authors_venue_elem) > 1 else "N/A"
            
            # Extract year
            year_elem = pub.select_one('.gsc_a_y span')
            year = year_elem.text.strip() if year_elem else "N/A"
            
            # Determine publication type based on venue
            pub_type = "Other"
            venue_lower = venue.lower()
            
            if any(k in venue_lower for k in ["journal", "transactions"]):
                pub_type = "Journal"
            elif any(k in venue_lower for k in ["conference", "proceedings", "symposium"]):
                pub_type = "Conference"
            
            publications.append({
                "Title": title,
                "Year": year if year != "" else "N/A",
                "Type": pub_type,
                "Venue": venue,
                "Authors": authors
            })
            
        except Exception as e:
            logger.error(f"Error processing publication: {e}")
            continue
    
    return publications

@retry_on_error(max_retries=2, delay=1)
def fetch_all_publications(author_id, max_pages=10):
    """Fetch all publications for an author by paginating through results"""
    try:
        all_publications = []
        session = get_session()
        page_size = 100  # Maximum page size Google Scholar allows
        
        for page in range(max_pages):  # Limit to max_pages to prevent infinite loops
            start_index = page * page_size
            url = f"https://scholar.google.com/citations?user={author_id}&hl=en&cstart={start_index}&pagesize={page_size}"
            
            logger.info(f"Fetching publications page {page+1} for author {author_id} (starting at {start_index})")
            
            html = fetch_url(url, session)
            
            # Extract publications from this page
            page_publications = extract_publications_from_html(html)
            
            # If no publications found, we've reached the end
            if not page_publications:
                break
                
            all_publications.extend(page_publications)
            
            # Check if there's a "Show more" button indicating more pages
            soup = BeautifulSoup(html, 'html.parser')
            show_more_button = soup.select_one('#gsc_bpf_more')
            
            # If button is disabled or doesn't exist, we've reached the end
            if not show_more_button or 'disabled' in show_more_button.attrs:
                break
                
            # Add a delay between pagination requests
            time.sleep(random.uniform(2, 4))
        
        logger.info(f"Retrieved a total of {len(all_publications)} publications for author {author_id}")
        return all_publications
        
    except Exception as e:
        logger.error(f"Error fetching all publications: {e}")
        raise

@cache_result
def get_faculty_publications(name, institution=None):
    try:
        # Fetch author profile
        author = fetch_author(name, institution)
        
        if not author:
            logger.warning(f"No author found for {name}")
            return None, None
        
        # Extract faculty details
        profile = {
            "name": author["name"],
            "affiliation": author.get("affiliation", "N/A"),
            "h_index": author.get("h_index", "N/A"),
            "i10_index": author.get("i10_index", "N/A"),
            "photo": author.get("photo", ""),
        }
        
        # Fetch all publications (not just first 50)
        publications = fetch_all_publications(author["id"])
        
        if not publications:
            logger.warning(f"No publications found for {name}")
            return profile, pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame(publications)
        
        # Sort by year if not empty
        if not df.empty:
            # Create temporary numeric column for sorting
            df['sort_year'] = pd.to_numeric(df['Year'], errors='coerce').fillna(9999)
            df = df.sort_values(by='sort_year', ascending=False)  # Newest first
            df = df.drop('sort_year', axis=1)
        
        return profile, df
    
    except Exception as e:
        logger.error(f"Error in get_faculty_publications: {e}")
        return None, None

def process_faculty(faculty_info):
    """Process a single faculty member - used in parallel processing"""
    name = faculty_info['name']
    institution = faculty_info.get('institution')
    
    logger.info(f"Processing faculty: {name}")
    profile, pub_df = get_faculty_publications(name, institution)
    
    if profile and pub_df is not None:
        return {
            'profile': profile,
            'publications': pub_df.to_dict(orient="records") if not pub_df.empty else []
        }
    return None

def process_excel_file(file):
    try:
        # Read Excel file
        df = pd.read_excel(file)
        
        # Print the actual columns for debugging
        logger.info(f"Excel columns: {df.columns.tolist()}")
        
        # Validate required columns
        if 'Name' not in df.columns:
            return None, "Excel file must contain a 'Name' column"
        
        # Determine the institution column if it exists
        institution_col = None
        for col in df.columns:
            if col.lower() == 'institution':
                institution_col = col
                break
                
        logger.info(f"Institution column found: {institution_col}")
        
        # Prepare faculty info list for processing
        faculty_list = []
        for idx, row in df.iterrows():
            name = row['Name']
            institution = row[institution_col] if institution_col and pd.notna(row[institution_col]) else None
            faculty_list.append({
                'name': name,
                'institution': institution
            })
            logger.info(f"Added faculty to process: '{name}' with institution '{institution}'")

        # Limit concurrency for bulk processing to avoid rate limits
        max_workers = min(3, len(faculty_list))  # Conservative limit

        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_faculty = {
                executor.submit(process_faculty, faculty): faculty for faculty in faculty_list
            }

            for future in concurrent.futures.as_completed(future_to_faculty):
                faculty = future_to_faculty[future]
                try:
                    faculty_result = future.result()
                    if faculty_result:
                        pub_count = len(faculty_result.get('publications', []))
                        logger.info(f"Processed {faculty['name']} (Institution: {faculty['institution']}) - {pub_count} publications found")
                        results.append(faculty_result)
                    else:
                        logger.warning(f"No publications found for {faculty['name']} (Institution: {faculty['institution']})")
                except Exception as e:
                    logger.error(f"Error processing {faculty['name']} (Institution: {faculty['institution']}): {e}")

                # Add a slightly longer delay to prevent rate limiting
                time.sleep(random.uniform(3, 5))

        return results, None

    except Exception as e:
        logger.error(f"Error processing Excel file: {e}")
        return None, f"Error processing Excel file: {e}"

@app.route("/", methods=["GET", "POST"])
def index():
    global processed_data
    
    if request.method == "POST":
        # Check if this is an API request looking for JSON (from Next.js)
        want_json = request.headers.get('Accept', '').find('application/json') != -1
        
        # Check if file was uploaded
        if 'file' in request.files and request.files['file'].filename:
            file = request.files['file']
            
            # Process Excel file
            results, error = process_excel_file(file)
            
            if error:
                if want_json:
                    return jsonify({"error": error}), 400
                return f"Error: {error}"
            
            if results:
                # Store combined publication data for download
                all_pubs = []
                for faculty in results:
                    # Add faculty name and institution to each publication
                    for pub in faculty.get('publications', []):
                        pub['Faculty'] = faculty['profile']['name']
                        pub['Faculty_Institution'] = faculty['profile']['affiliation']
                    
                    all_pubs.extend(faculty.get('publications', []))
                
                if all_pubs:
                    processed_data = pd.DataFrame(all_pubs)
                else:
                    processed_data = pd.DataFrame(columns=['Title', 'Year', 'Type', 'Venue', 'Authors', 'Faculty', 'Faculty_Institution'])
                
                # Return JSON format for Next.js
                if want_json:
                    return jsonify({"faculty_results": results})
                
                # Or render template for direct browser access
                return render_template(
                    "index.html", 
                    faculty_results=results
                )
            else:
                if want_json:
                    return jsonify({"error": "No data found for any faculty in the uploaded file."}), 404
                return "No data found for any faculty in the uploaded file."
        
        else:
            # Get individual faculty search
            if request.is_json:
                data = request.get_json()
                name = data.get("name")
                institution = data.get("institution")
            else:
                name = request.form.get("name")
                institution = request.form.get("institution")
            
            if not name:
                if want_json:
                    return jsonify({"error": "Please enter a faculty name."}), 400
                return "Please enter a faculty name."
            
            profile, df = get_faculty_publications(name, institution)
            
            if profile:
                processed_data = df if df is not None and not df.empty else pd.DataFrame()
                
                # Return JSON for API requests
                if want_json:
                    return jsonify({
                        "profile": profile,
                        "results": df.to_dict(orient="records") if not df.empty else []
                    })
                
                # Or render template for direct browser access
                return render_template(
                    "results.html", 
                    profile=profile, 
                    results=df.to_dict(orient="records") if not df.empty else []
                )
            else:
                if want_json:
                    return jsonify({"error": "No data found for the given professor. Please check the name and institution."}), 404
                return "No data found for the given professor. Please check the name and institution."

    # GET request - return the form
    if request.headers.get('Accept', '').find('application/json') != -1:
        return jsonify({"message": "Use POST method to search for publications"})
    return render_template("index.html")

@app.route("/download")
def download():
    global processed_data
    if processed_data is None or processed_data.empty:
        # Check if this is an API request
        if request.headers.get('Accept', '').find('application/json') != -1:
            return jsonify({"error": "No data available for download"}), 400
        return "No data available for download", 400

    # Determine format (default to Excel)
    format_type = request.args.get('format', 'excel') 
    
    if format_type == 'json':
        # Return JSON directly
        return jsonify(processed_data.to_dict(orient="records"))
    
    elif format_type == 'csv':
        # Return CSV
        output = BytesIO()
        processed_data.to_csv(output, index=False)
        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name="faculty_publications.csv",
            mimetype="text/csv",
        )
    
    else:  # Default to Excel
        output = BytesIO()
        with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
            processed_data.to_excel(writer, index=False, sheet_name="Publications")

        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name="faculty_publications.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=5000)