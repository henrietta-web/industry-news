import os
import feedparser
import cloudscraper
from datetime import datetime
from time import mktime
from dotenv import load_dotenv
from supabase import create_client, Client
from bs4 import BeautifulSoup # Added this!

scraper = cloudscraper.create_scraper()
load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Strictly Curated List - BroadcastNow is removed from here!
RSS_FEEDS = [
    "https://www.televisual.com/feed/",
    "https://rss.app/feeds/scEXmUvxZHjOt9Dq.xml"  # Radio Times Custom Feed
]

def fetch_and_store_news():
    print("Starting news scrape...")
    
    # DEDUPLICATION: Keep track of titles to block clones across different publications
    seen_titles = set()
    
    # ---------------------------------------------------------
    # 1. SCRAPE BROADCASTNOW DIRECTLY (Bypassing RSS.app)
    # ---------------------------------------------------------
    print("\nChecking Direct HTML: https://www.broadcastnow.co.uk")
    try:
        response = scraper.get("https://www.broadcastnow.co.uk/")
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # BroadcastNow usually puts their headlines in <h3> or <h2> tags inside links
        # Let's grab all links that have a headline tag inside them
        headlines = soup.find_all(['h2', 'h3'])
        
        for hl in headlines:
            link_tag = hl.find_parent('a') or hl.find('a')
            if not link_tag or not link_tag.has_attr('href'):
                continue
                
            title = hl.get_text(strip=True)
            if not title or len(title) < 10: # Skip tiny UI text
                continue
                
            raw_link = link_tag['href']
            article_url = raw_link if raw_link.startswith('http') else f"https://www.broadcastnow.co.uk{raw_link}"
            
            clean_title = title.strip().lower()
            if clean_title in seen_titles:
                continue
            seen_titles.add(clean_title)
            
            # Categorize
            text_to_check = title.lower()
            if 'documentary' in text_to_check or 'docuseries' in text_to_check or 'non-fiction' in text_to_check:
                category = 'DOCUMENTARY'
            elif ' tv' in text_to_check or 'television' in text_to_check or 'series' in text_to_check or 'season ' in text_to_check or 'hbo' in text_to_check or 'netflix' in text_to_check:
                category = 'TELEVISION'
            else:
                category = 'FILM' 
                
            article_data = {
                "title": title,
                "url": article_url.split('?')[0],
                "summary": "Full article available on BroadcastNow.", # Direct scrape doesn't always have summary
                "published_at": datetime.now().isoformat(),
                "image_url": None, # Complex to grab images accurately without knowing exact classes
                "category": category 
            }
            
            try:
                supabase.table("industry_news").upsert(article_data, on_conflict="url").execute()
                print(f"  -> Added/Updated: [{category}] {title}")
            except Exception as e:
                print(f"  -> Error: {e}")
                
    except Exception as e:
        print(f"  -> Error connecting to BroadcastNow: {e}")

    # ---------------------------------------------------------
    # 2. SCRAPE THE REMAINING RSS FEEDS
    # ---------------------------------------------------------
    for feed_url in RSS_FEEDS:
        print(f"\nChecking: {feed_url}")
        try:
            response = scraper.get(feed_url)
            feed = feedparser.parse(response.text)
            
            if not feed.entries:
                continue
            
            for entry in feed.entries:
                title = entry.title
                
                clean_title = title.strip().lower()
                if clean_title in seen_titles:
                    print(f"  -> Skipping duplicate headline: {title}")
                    continue
                seen_titles.add(clean_title)

                link = entry.link.split('?')[0]
                summary = entry.get('summary', 'No summary available.')
                
                published_at = datetime.now().isoformat()
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    dt = datetime.fromtimestamp(mktime(entry.published_parsed))
                    published_at = dt.isoformat()

                image_url = None
                if 'media_thumbnail' in entry and len(entry.media_thumbnail) > 0:
                    image_url = entry.media_thumbnail[0].get('url')
                elif 'media_content' in entry and len(entry.media_content) > 0:
                    image_url = entry.media_content[0].get('url')

                text_to_check = (title + " " + summary).lower()
                if 'documentary' in text_to_check or 'docuseries' in text_to_check or 'non-fiction' in text_to_check:
                    category = 'DOCUMENTARY'
                elif ' tv' in text_to_check or 'television' in text_to_check or 'series' in text_to_check or 'season ' in text_to_check or 'hbo' in text_to_check or 'netflix' in text_to_check:
                    category = 'TELEVISION'
                else:
                    category = 'FILM' 

                article_data = {
                    "title": title,
                    "url": link,
                    "summary": summary,
                    "published_at": published_at,
                    "image_url": image_url,
                    "category": category 
                }

                try:
                    supabase.table("industry_news").upsert(article_data, on_conflict="url").execute()
                    print(f"  -> Added/Updated: [{category}] {title}")
                except Exception as e:
                    print(f"  -> Error: {e}")
                    
        except Exception as e:
             print(f"  -> Error connecting: {e}")

if __name__ == "__main__":
    fetch_and_store_news()